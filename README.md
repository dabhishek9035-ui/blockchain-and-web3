# Xirec

Xirec is a hybrid Web2 + Web3 voucher marketplace. It uses React/Next.js on the frontend, Node.js/Express on the backend, MongoDB for off-chain data, and Sepolia testnet for on-chain escrow, token, and reputation flows.

## What is implemented now
- Project architecture documented in `docs/system-architecture.md`
- Backend API scaffold in `backend/`
- Frontend scaffold with wallet login, dashboard, upload, and marketplace pages in `frontend/`
- Solidity contracts in `contracts/`

## Folder structure
- `contracts/` - Solidity smart contracts
- `backend/` - Express API, parser, models, listeners
- `frontend/` - Next.js app, wallet UI, marketplace pages
- `docs/` - Architecture and setup notes

## Run the backend
```bash
cd backend
npm install
npm run dev
```

Set environment variables from `backend/.env.example` first.

## Run the frontend
```bash
cd frontend
npm install
npm run dev
```

Set environment variables from `frontend/.env.example` first.

## Backend API
- `GET /health` - health check
- `GET /api/health` - API health check
- `GET /api/chain/status` - read blockchain wiring and contract address configuration
- `POST /api/auth/nonce` - create a one-time login challenge for a wallet
- `POST /api/auth/verify` - verify a signed login message
- `POST /api/parse-voucher` - parse SMS-style voucher text
- `POST /api/vouchers` - store parsed voucher metadata after validation
- `GET /api/vouchers` - list vouchers for the marketplace UI
- `GET /api/vouchers/:id` - view a single voucher record
- `POST /api/games/reward-signature` - create a backend-authorized reward signature

## Blockchain integration
- The backend starts a Sepolia marketplace event listener automatically when `RPC_URL` and the contract addresses are set.
- The listener mirrors `ListingCreated`, `ListingPurchased`, `ListingConfirmed`, `DisputeRaised`, `DisputeResolved`, `ListingCancelled`, and `ListingExpired` into MongoDB.
- The dashboard can read the current Xirec token balance from Sepolia through MetaMask once the token address is configured.
- The marketplace page can create listings, buy vouchers, confirm receipts, and raise disputes through Sepolia transactions.
- The games page requests a backend-signed reward and then submits it to the reward distributor contract on-chain.

Example request:
```json
{
  "text": "Hey, I thought you may like this ACwO voucher on Google Pay!
Soundbars @ ₹899
Enjoy Powerful Sound & Long Music Playtime
Expiring in 14 days
https://acwo.com/pages/gpaysb500?utm_source=googlepay&utm_medium=googlepaysalrdinm26&utm_campaign=googlepaysalrdinm26campaign

Voucher code: GPSINMB12RSQSCVDY"
}
```
