// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

interface IXirecToken {
    function mint(address to, uint256 amount) external;
}

/**
 * @title RewardDistributor
 * @dev Distributes Xirec tokens based on off-chain signed authorizations (EIP-712).
 * Backend holds a private key and signs reward messages that users submit to this contract.
 * The contract verifies signature and nonces to prevent replay.
 */
contract RewardDistributor {
    using ECDSA for bytes32;

    address public owner;
    IXirecToken public immutable token;
    address public authorizedSigner;
    bytes32 public immutable DOMAIN_SEPARATOR;

    // nonces per recipient to prevent replay
    mapping(address => uint256) public nonces;
    bool private _locked;

    bytes32 public constant EIP712_DOMAIN_TYPEHASH =
        keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)");
    bytes32 public constant REWARD_TYPEHASH = keccak256("Reward(address to,uint256 amount,uint256 nonce)");

    event RewardDistributed(address indexed to, uint256 amount, uint256 nonce, bytes signature);
    event AuthorizedSignerChanged(address indexed oldSigner, address indexed newSigner);
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

    constructor(address tokenAddress, address signer) {
        require(tokenAddress != address(0), "token zero");
        owner = msg.sender;
        token = IXirecToken(tokenAddress);
        authorizedSigner = signer;
        DOMAIN_SEPARATOR = keccak256(
            abi.encode(
                EIP712_DOMAIN_TYPEHASH,
                keccak256(bytes("XirecReward")),
                keccak256(bytes("1")),
                block.chainid,
                address(this)
            )
        );
    }

    /**
     * @notice Distribute reward to `to` if signature is valid and nonce matches.
     * @param to recipient
     * @param amount amount of Xirec tokens to mint
     * @param nonce expected nonce for `to`
     * @param signature backend signature over EIP-712 typed data
     */
    function distributeReward(address to, uint256 amount, uint256 nonce, bytes calldata signature) external nonReentrant {
        require(to != address(0), "to zero");
        require(amount > 0, "amount>0");

        // check nonce
        require(nonces[to] == nonce, "invalid nonce");

        bytes32 structHash = keccak256(abi.encode(REWARD_TYPEHASH, to, amount, nonce));
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR, structHash));
        address signer = ECDSA.recover(digest, signature);
        require(signer == authorizedSigner, "invalid signer");

        // mint tokens (RewardDistributor should have MINTER_ROLE on XirecToken)
        token.mint(to, amount);

        // increment nonce
        nonces[to] = nonces[to] + 1;

        emit RewardDistributed(to, amount, nonce, signature);
    }

    /// @notice Owner can update the authorized signer (rotate keys)
    function setAuthorizedSigner(address newSigner) external onlyOwner {
        emit AuthorizedSignerChanged(authorizedSigner, newSigner);
        authorizedSigner = newSigner;
    }

    /// @notice Transfer contract ownership.
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "zero owner");
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    /// @notice Emergency: owner can mint manually via token if needed (for admin recovery). Use carefully.
    function ownerMint(address to, uint256 amount) external onlyOwner {
        token.mint(to, amount);
    }
}
