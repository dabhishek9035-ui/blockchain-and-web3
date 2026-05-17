# Xirec System Architecture

## 1. High-Level Design
Xirec is a hybrid Web2 + Web3 marketplace for vouchers and scratch cards. The application keeps sensitive voucher data off-chain, while using blockchain for ownership, escrow, token balances, reward payouts, reputation, and marketplace lifecycle events.

## 2. Core Layers

### Frontend
- Next.js App Router
- TailwindCSS UI
- ethers.js wallet and contract integration
- MetaMask connection and signed login flow

### Backend
- Node.js + Express API
- Voucher parser and expiry validation
- Secure voucher delivery after purchase
- Reward authorization and signature generation
- Blockchain event listener and database synchronizer

### Blockchain
- Sepolia testnet
- Solidity contracts for token, escrow, reputation, rewards
- On-chain only stores hashes, balances, escrow, reputation, and lifecycle events

### Database
- MongoDB stores users, voucher metadata, listings, disputes, games, and audit logs
- Raw voucher codes are never stored on-chain
- Raw voucher codes should be encrypted at rest off-chain if retained temporarily

## 3. Folder Structure

```text
xirec/
  contracts/
  backend/
    src/
      config/
      listeners/
      models/
      routes/
      services/
      utils/
  frontend/
    app/
    components/
    lib/
    styles/
  docs/
```

## 4. Data Flow

### Sell Flow
1. Seller uploads voucher or SMS text.
2. Backend parser extracts provider, code, value, and expiry.
3. Backend computes SHA-256 hash of the voucher code.
4. Backend validates expiry and uniqueness.
5. Seller deposits escrow in Xirec.
6. Listing is created on-chain.

### Buy Flow
1. Buyer purchases the listing on-chain.
2. The escrow contract deletes the active `listings(listingId)` record and keeps settlement data in `purchaseEscrows(listingId)`.
3. Backend sees the purchase event and marks the voucher sold.
4. Backend securely delivers the voucher code to the buyer.
5. Buyer confirms validity.
6. Escrow and payment are released according to the outcome.

### Reward Flow
1. Backend authorizes a reward after game or achievement logic.
2. Backend signs an EIP-712 reward payload.
3. User submits the signed payload to the reward contract.
4. Contract verifies the signature and mints Xirec.

## 5. MongoDB Schema

### users
- walletAddress
- username
- reputationScore
- xirecBalanceMirror
- createdAt

### vouchers
- provider
- value
- codeHash
- expiry
- uploaderWallet
- status
- encryptedCodeRef
- createdAt

### listings
- listingIdOnChain
- sellerWallet
- buyerWallet
- voucherId
- priceXirec
- escrowAmount
- state
- createdAt

### disputes
- listingIdOnChain
- evidenceLinks
- status
- resolution
- resolvedBy
- createdAt

### gameSessions
- walletAddress
- gameType
- result
- rewardAmount
- rewardAuthorized
- createdAt

### auditLogs
- action
- actor
- txHash
- metadata
- createdAt

## 6. Risks
- Do not trust frontend validation for security-critical checks.
- Keep reward signing keys server-side only.
- Use contract events as the source of truth for marketplace state.
- Prevent duplicate voucher listing with a unique code hash index in MongoDB and a duplicate-hash guard on-chain.

## 7. MVP Scope
- Wallet connect and signed login
- Voucher upload and parser
- Marketplace listings and purchase flow
- Disputes and reputation updates
- Game reward authorization
- Event listener and database sync
