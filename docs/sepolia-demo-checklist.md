# Xirec Sepolia Demo Checklist

Use this checklist once the contracts are deployed and the frontend/backend env vars are filled.

## Contract addresses
- `XirecToken`
- `ReputationManager`
- `RewardDistributor`
- `VoucherEscrow`

## Environment variables
Set these in `backend/.env` and `frontend/.env.local`:
- `RPC_URL`
- `MONGODB_URI`
- `BACKEND_SIGNER_PRIVATE_KEY`
- `XIREC_TOKEN_ADDRESS`
- `REPUTATION_MANAGER_ADDRESS`
- `REWARD_DISTRIBUTOR_ADDRESS`
- `VOUCHER_ESCROW_ADDRESS`
- `NEXT_PUBLIC_BACKEND_URL`
- `NEXT_PUBLIC_XIREC_TOKEN_ADDRESS`
- `NEXT_PUBLIC_REPUTATION_MANAGER_ADDRESS`
- `NEXT_PUBLIC_REWARD_DISTRIBUTOR_ADDRESS`
- `NEXT_PUBLIC_VOUCHER_ESCROW_ADDRESS`

## Demo flow
1. Open the frontend.
2. Connect MetaMask on Sepolia.
3. Sign in on `/login`.
4. Open `/upload` and parse a voucher message.
5. Open `/marketplace` and create a listing on Sepolia.
6. Buy the listing from another wallet.
7. Confirm receipt or raise a dispute.
8. Open `/games` and mint a backend-authorized reward.
9. Check `/dashboard` for wallet and balance info.

## What to verify during the demo
- Wallet login succeeds.
- Backend parser extracts voucher data.
- On-chain listing is created.
- Event listener updates MongoDB.
- Reward mint uses a backend signature.
- No raw voucher code is ever shown on-chain.

## If something fails
- Recheck contract addresses in env files.
- Make sure `RewardDistributor` has `MINTER_ROLE`.
- Make sure `VoucherEscrow` has `MANAGER_ROLE`.
- Confirm the backend is running on the same RPC network as MetaMask.
- Confirm MetaMask is on Sepolia.
