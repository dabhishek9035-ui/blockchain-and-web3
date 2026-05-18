import { User } from '../models/User.js';
import { Listing } from '../models/Listing.js';

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

/**
 * Calculate reputation increase based on current reputation score
 * - Below 80: +10
 * - 80 to 89: +4
 * - 90 or above: +1
 */
function calculateReputationIncrease(currentReputation) {
  if (currentReputation < 80) {
    return 10;
  } else if (currentReputation < 90) {
    return 4;
  } else {
    return 1;
  }
}

export async function increaseUserReputation(walletAddress) {
  const normalizedWallet = await ensureWalletAccount(walletAddress);

  const user = await User.findOne({ walletAddress: normalizedWallet });
  if (!user) {
    throw new Error('User not found');
  }

  const increase = calculateReputationIncrease(user.reputationScore);
  const newReputation = user.reputationScore + increase;

  const updatedUser = await User.findOneAndUpdate(
    { walletAddress: normalizedWallet },
    { $inc: { reputationScore: increase } },
    { new: true }
  );

  return {
    previousReputation: user.reputationScore,
    increase,
    newReputation: updatedUser.reputationScore
  };
}

export async function returnEscrowToSeller(sellerWallet, escrowAmount) {
  const numericAmount = Number(escrowAmount);

  if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
    throw new Error('escrowAmount must be a positive number');
  }

  const normalizedSeller = await ensureWalletAccount(sellerWallet);

  const updatedUser = await User.findOneAndUpdate(
    { walletAddress: normalizedSeller },
    { $inc: { xirecBalanceMirror: numericAmount } },
    { new: true }
  );

  return {
    walletAddress: normalizedSeller,
    escrowReturned: numericAmount,
    newBalance: updatedUser.xirecBalanceMirror
  };
}

export async function getPendingSellerPayouts(sellerWallet) {
  const normalizedSeller = await ensureWalletAccount(sellerWallet);

  const payoutListings = await Listing.find({
    sellerWallet: normalizedSeller,
    state: 'purchased',
    buyerWallet: { $ne: '' }
  }).sort({ createdAt: -1 });

  const totalPayable = payoutListings.reduce((sum, listing) => sum + (listing.priceXirec || 0), 0);

  return {
    pendingListings: payoutListings,
    totalPayable,
    count: payoutListings.length
  };
}