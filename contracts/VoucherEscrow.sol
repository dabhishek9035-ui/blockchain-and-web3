// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IReputationManager {
    function increaseReputation(address who, uint256 amount) external;
    function decreaseReputation(address who, uint256 amount) external;
}

/**
 * @title VoucherEscrow
 * @dev Marketplace escrow contract for voucher listings.
 * - Stores only voucher hashes (bytes32) on-chain.
 * - Manages escrow deposits, purchases, confirmations, disputes, and refunds.
 * - Removes purchased vouchers from active listing storage while preserving escrow records.
 */
contract VoucherEscrow {
    using SafeERC20 for IERC20;

    address public owner;
    IERC20 public xirec;
    IReputationManager public reputation;

    uint256 public listingCounter;
    uint256 public disputePenaltyRateBP = 1000; // 10%
    bool private _locked;

    enum ListingState { Listed, Sold, Disputed, Resolved, Cancelled, Expired }

    struct Listing {
        address seller;
        address buyer;
        bytes32 voucherHash;
        uint256 price;
        uint256 escrowAmount;
        uint256 expiryTimestamp;
        ListingState state;
        uint256 createdAt;
    }

    struct PurchaseEscrow {
        address seller;
        address buyer;
        bytes32 voucherHash;
        uint256 price;
        uint256 escrowAmount;
        ListingState state;
        uint256 createdAt;
    }

    mapping(uint256 => Listing) public listings;
    mapping(uint256 => PurchaseEscrow) public purchaseEscrows;
    mapping(bytes32 => bool) public activeVoucherHash;

    event ListingCreated(uint256 indexed listingId, address indexed seller, bytes32 voucherHash, uint256 price, uint256 escrowAmount, uint256 expiry);
    event ListingPurchased(uint256 indexed listingId, address indexed buyer);
    event ListingConfirmed(uint256 indexed listingId);
    event DisputeRaised(uint256 indexed listingId, address indexed buyer, string reason);
    event DisputeResolved(uint256 indexed listingId, bool buyerWins, uint256 penaltyAmount);
    event ListingCancelled(uint256 indexed listingId);
    event ListingExpired(uint256 indexed listingId);
    event OwnershipTransferred(address indexed oldOwner, address indexed newOwner);

    modifier onlyOwner() {
        require(msg.sender == owner, "not owner");
        _;
    }

    modifier nonReentrant() {
        require(!_locked, "reentrant");
        _locked = true;
        _;
        _locked = false;
    }

    constructor(address _xirecToken, address _reputationManager) {
        require(_xirecToken != address(0), "token zero");
        owner = msg.sender;
        xirec = IERC20(_xirecToken);
        reputation = IReputationManager(_reputationManager);
    }

    function createListing(bytes32 voucherHash, uint256 price, uint256 escrowAmount, uint256 expiryTimestamp) external nonReentrant returns (uint256) {
        require(voucherHash != bytes32(0), "empty hash");
        require(!activeVoucherHash[voucherHash], "duplicate voucher");
        require(price > 0, "price>0");
        require(escrowAmount > 0, "escrow>0");
        require(expiryTimestamp > block.timestamp, "expiry in past");

        xirec.safeTransferFrom(msg.sender, address(this), escrowAmount);

        listingCounter++;
        listings[listingCounter] = Listing({
            seller: msg.sender,
            buyer: address(0),
            voucherHash: voucherHash,
            price: price,
            escrowAmount: escrowAmount,
            expiryTimestamp: expiryTimestamp,
            state: ListingState.Listed,
            createdAt: block.timestamp
        });

        activeVoucherHash[voucherHash] = true;

        emit ListingCreated(listingCounter, msg.sender, voucherHash, price, escrowAmount, expiryTimestamp);
        return listingCounter;
    }

    function buyListing(uint256 listingId) external nonReentrant {
        Listing storage L = listings[listingId];
        require(L.seller != address(0), "listing missing");
        require(L.state == ListingState.Listed, "not listed");
        require(block.timestamp < L.expiryTimestamp, "voucher expired");

        xirec.safeTransferFrom(msg.sender, address(this), L.price);

        purchaseEscrows[listingId] = PurchaseEscrow({
            seller: L.seller,
            buyer: msg.sender,
            voucherHash: L.voucherHash,
            price: L.price,
            escrowAmount: L.escrowAmount,
            state: ListingState.Sold,
            createdAt: block.timestamp
        });

        delete listings[listingId];

        emit ListingPurchased(listingId, msg.sender);
    }

    function confirmReceived(uint256 listingId) external nonReentrant {
        PurchaseEscrow storage P = purchaseEscrows[listingId];
        require(P.seller != address(0), "purchase missing");
        require(P.state == ListingState.Sold, "not sold");
        require(msg.sender == P.buyer, "only buyer");

        P.state = ListingState.Resolved;

        xirec.safeTransfer(P.seller, P.price);
        xirec.safeTransfer(P.seller, P.escrowAmount);

        activeVoucherHash[P.voucherHash] = false;

        try reputation.increaseReputation(P.seller, 1) {} catch {}

        emit ListingConfirmed(listingId);
    }

    function raiseDispute(uint256 listingId, string calldata reason) external nonReentrant {
        PurchaseEscrow storage P = purchaseEscrows[listingId];
        require(P.seller != address(0), "purchase missing");
        require(P.state == ListingState.Sold, "not sold");
        require(msg.sender == P.buyer, "only buyer");

        P.state = ListingState.Disputed;
        emit DisputeRaised(listingId, msg.sender, reason);
    }

    function resolveDispute(uint256 listingId, bool buyerWins) external onlyOwner nonReentrant {
        PurchaseEscrow storage P = purchaseEscrows[listingId];
        require(P.seller != address(0), "purchase missing");
        require(P.state == ListingState.Disputed, "not disputed");

        uint256 penalty = (P.escrowAmount * disputePenaltyRateBP) / 10000;
        if (buyerWins) {
            xirec.safeTransfer(P.buyer, P.price);
            if (penalty > 0) {
                xirec.safeTransfer(P.buyer, penalty);
                uint256 refundToSeller = P.escrowAmount > penalty ? (P.escrowAmount - penalty) : 0;
                if (refundToSeller > 0) {
                    xirec.safeTransfer(P.seller, refundToSeller);
                }
            } else {
                xirec.safeTransfer(P.seller, P.escrowAmount);
            }
            try reputation.decreaseReputation(P.seller, 1) {} catch {}
        } else {
            xirec.safeTransfer(P.seller, P.price);
            xirec.safeTransfer(P.seller, P.escrowAmount);
            try reputation.increaseReputation(P.seller, 1) {} catch {}
        }

        P.state = ListingState.Resolved;
        activeVoucherHash[P.voucherHash] = false;

        emit DisputeResolved(listingId, buyerWins, penalty);
    }

    function cancelListing(uint256 listingId) external nonReentrant {
        Listing storage L = listings[listingId];
        require(L.seller != address(0), "listing missing");
        require(L.state == ListingState.Listed, "not listed");
        require(msg.sender == L.seller, "only seller");

        L.state = ListingState.Cancelled;
        xirec.safeTransfer(L.seller, L.escrowAmount);
        activeVoucherHash[L.voucherHash] = false;

        emit ListingCancelled(listingId);
    }

    function expireListing(uint256 listingId) external nonReentrant {
        Listing storage L = listings[listingId];
        require(L.seller != address(0), "listing missing");
        require(L.state == ListingState.Listed, "not listed");
        require(block.timestamp >= L.expiryTimestamp, "not expired yet");

        L.state = ListingState.Expired;
        xirec.safeTransfer(L.seller, L.escrowAmount);
        activeVoucherHash[L.voucherHash] = false;

        emit ListingExpired(listingId);
    }

    function setDisputePenaltyRateBP(uint256 bp) external onlyOwner {
        require(bp <= 10000, "bp<=10000");
        disputePenaltyRateBP = bp;
    }

    function emergencyWithdraw(address token, address to, uint256 amount) external onlyOwner {
        IERC20(token).safeTransfer(to, amount);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "zero owner");
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }
}
