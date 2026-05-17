import { User } from '../models/User.js';

function normalizeWalletAddress(walletAddress = '') {
  return String(walletAddress).trim().toLowerCase();
}

async function ensureWalletAccount(walletAddress) {
  const normalizedWallet = normalizeWalletAddress(walletAddress);

  if (!normalizedWallet) {
    throw new Error('walletAddress is required');
  }

  await User.updateOne(
    { walletAddress: normalizedWallet },
    { $setOnInsert: { walletAddress: normalizedWallet } },
    { upsert: true }
  );

  return normalizedWallet;
}

export async function transferVoucherPurchaseBalance({ buyerWallet, sellerWallet, amount }) {
  const numericAmount = Number(amount);

  if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
    throw new Error('amount must be a positive number');
  }

  const normalizedBuyer = await ensureWalletAccount(buyerWallet);
  const normalizedSeller = await ensureWalletAccount(sellerWallet);

  await User.updateOne(
    { walletAddress: normalizedBuyer },
    { $inc: { xirecBalanceMirror: -numericAmount } }
  );

  await User.updateOne(
    { walletAddress: normalizedSeller },
    { $inc: { xirecBalanceMirror: numericAmount } }
  );
}