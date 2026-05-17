# Xirec Remix Deployment Guide

This guide matches the current contract versions in `contracts/` and the Sepolia setup already used in the app.

## 1. What to deploy
Deploy these contracts in Remix, in this order:

1. `XirecToken`
2. `ReputationManager`
3. `RewardDistributor`
4. `VoucherEscrow`

## 2. Constructor arguments

### XirecToken
Constructor:
```solidity
constructor(string memory name_, string memory symbol_, address admin)
```
Use:
- `name_` = `Xirec`
- `symbol_` = `XRC`
- `admin` = your wallet address

### ReputationManager
Constructor:
```solidity
constructor(address admin)
```
Use:
- `admin` = your wallet address

### RewardDistributor
Constructor:
```solidity
constructor(address tokenAddress, address signer)
```
Use:
- `tokenAddress` = deployed `XirecToken` address
- `signer` = backend signing wallet address for reward authorizations

### VoucherEscrow
Constructor:
```solidity
constructor(address _xirecToken, address _reputationManager)
```
Use:
- `_xirecToken` = deployed `XirecToken` address
- `_reputationManager` = deployed `ReputationManager` address

## 3. Remix setup

1. Open Remix.
2. Compile each Solidity file with `0.8.24`.
3. Use `Injected Provider - MetaMask`.
4. Switch MetaMask to `Sepolia`.
5. Deploy the contracts in the order above.

## 4. Required role grants after deployment
These contracts depend on role permissions. Do these immediately after deployment.

### Grant `MINTER_ROLE` on `XirecToken` to `RewardDistributor`
The token contract only allows minting from addresses with `MINTER_ROLE`.
In Remix, call `grantRole` on `XirecToken`:
- `role` = `MINTER_ROLE`
- `account` = deployed `RewardDistributor` address

### Grant `MANAGER_ROLE` on `ReputationManager` to `VoucherEscrow`
The escrow contract updates reputation during confirmations and disputes.
In Remix, call `grantRole` on `ReputationManager`:
- `role` = `MANAGER_ROLE`
- `account` = deployed `VoucherEscrow` address

You can also grant `MANAGER_ROLE` to your admin wallet if you want manual reputation control during testing.

## 5. Recommended deployment order in practice
1. Deploy `XirecToken`
2. Deploy `ReputationManager`
3. Deploy `RewardDistributor`
4. Deploy `VoucherEscrow`
5. Grant `MINTER_ROLE` to `RewardDistributor`
6. Grant `MANAGER_ROLE` to `VoucherEscrow`

## 6. Smoke-test flow in Remix

### A. Token mint permission check
- From the admin wallet, call `XirecToken.mint(...)` only if the caller has `MINTER_ROLE`.
- If not, minting should fail until `RewardDistributor` is granted the role.

### B. Listing flow
1. Seller approves `VoucherEscrow` to spend escrow Xirec.
2. Seller calls `VoucherEscrow.createListing(voucherHash, price, escrowAmount, expiryTimestamp)`.
3. Buyer calls `VoucherEscrow.buyListing(listingId)` after approving the purchase amount.
4. The listing is deleted from active on-chain listing storage. Escrow details move to `purchaseEscrows(listingId)` so confirmation and disputes can still work.
5. Buyer calls `VoucherEscrow.confirmReceived(listingId)` after checking the voucher.

### C. Dispute flow
1. Buyer calls `VoucherEscrow.raiseDispute(listingId, reason)`.
2. Owner resolves using `VoucherEscrow.resolveDispute(listingId, buyerWins)`.

### D. Reward flow
1. Backend signs a reward payload.
2. User submits the signed payload to `RewardDistributor.distributeReward(...)`.
3. `RewardDistributor` mints Xirec only if the signature and nonce are valid.

## 7. Important notes
- Never store raw voucher codes on-chain.
- Use `SHA256(voucher_code)` for `voucherHash`.
- Keep the reward signer private key only on the backend.
- Use the backend listener to mirror events into MongoDB.
- For production, replace the single-owner contract pattern with a multisig admin workflow.
