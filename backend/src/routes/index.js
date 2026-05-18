import { Router } from 'express';
import { parseUnits, toBeHex } from 'ethers';
import { parseVoucherText } from '../services/parser.js';
import { createAuthChallenge, buildLoginMessage, verifyLoginSignature } from '../services/auth.js';
import { buildVoucherHash, normalizeExpiry } from '../services/voucher.js';
import { createRewardSigner } from '../services/reward.js';
import { transferVoucherPurchaseBalance, getPendingSellerPayouts } from '../services/accounting.js';
import { User } from '../models/User.js';
import { Voucher } from '../models/Voucher.js';
import { Listing } from '../models/Listing.js';
import { GameSession } from '../models/GameSession.js';
import { AuditLog } from '../models/AuditLog.js';

const router = Router();

const GAME_TYPES = new Set(['rock-paper-scissors', 'reaction-sprint']);
const GAME_RESULTS = new Set(['win', 'draw', 'loss']);

function computeRewardAmount({ gameType, result, score }) {
  const numericScore = Number(score);
  const safeScore = Number.isFinite(numericScore) ? Math.max(0, numericScore) : 0;
  const baseReward = Math.max(1, Math.floor(safeScore / 10));
  const resultBonus = result === 'win' ? 3 : result === 'draw' ? 1 : 0;
  const modeBonus = gameType === 'reaction-sprint' ? 1 : 2;

  return Math.min(15, baseReward + resultBonus + modeBonus);
}

function serializeVoucher(voucher, listing = null, options = {}) {
  return {
    id: voucher._id,
    provider: voucher.provider,
    value: voucher.value,
    text: voucher.text || '',
    codeHash: voucher.codeHash,
    extractedCode: options.includeCode ? voucher.extractedCode || '' : '',
    expiry: voucher.expiry,
    status: voucher.status,
    listingId: listing?.listingIdOnChain ? String(listing.listingIdOnChain) : '',
    listingState: listing?.state || '',
    priceXirec: listing?.priceXirec ?? null,
    escrowAmount: listing?.escrowAmount ?? null
  };
}

function findActiveListingForVoucher(voucherId) {
  return Listing.findOne({ voucherId, state: 'created' }).sort({ createdAt: -1 });
}

function serializeLeaderboardUser(user, rank) {
  return {
    rank,
    walletAddress: user.walletAddress,
    username: user.username || '',
    reputationScore: user.reputationScore || 0,
    xirecBalance: user.xirecBalanceMirror || 0,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  };
}

function buildReputationMap(sessions = []) {
  const reputationByWallet = new Map();

  for (const session of sessions) {
    const walletAddress = String(session._id || '').toLowerCase();
    if (!walletAddress) {
      continue;
    }

    reputationByWallet.set(walletAddress, Number(session.reputationScore || 0));
  }

  return reputationByWallet;
}

async function serializeTrade(listing, role) {
  const voucher = listing.voucherId ? await Voucher.findById(listing.voucherId) : null;

  return {
    listingId: listing.listingIdOnChain ? String(listing.listingIdOnChain) : '',
    role,
    state: listing.state,
    sellerWallet: listing.sellerWallet,
    buyerWallet: listing.buyerWallet,
    priceXirec: listing.priceXirec,
    escrowAmount: listing.escrowAmount,
    createdAt: listing.createdAt,
    updatedAt: listing.updatedAt,
    voucher: voucher
      ? serializeVoucher(voucher, listing, { includeCode: role === 'bought' })
      : null
  };
}

router.get('/health', (_req, res) => {
  res.json({ ok: true });
});

router.get('/chain/status', (_req, res) => {
  res.json({
    rpcConfigured: Boolean(process.env.RPC_URL),
    marketplaceAddress: process.env.VOUCHER_ESCROW_ADDRESS || process.env.NEXT_PUBLIC_VOUCHER_ESCROW_ADDRESS || '',
    tokenAddress: process.env.XIREC_TOKEN_ADDRESS || process.env.NEXT_PUBLIC_XIREC_TOKEN_ADDRESS || '',
    reputationAddress: process.env.REPUTATION_MANAGER_ADDRESS || process.env.NEXT_PUBLIC_REPUTATION_MANAGER_ADDRESS || '',
    rewardDistributorAddress: process.env.REWARD_DISTRIBUTOR_ADDRESS || process.env.NEXT_PUBLIC_REWARD_DISTRIBUTOR_ADDRESS || ''
  });
});

router.post('/auth/nonce', async (req, res) => {
  const { walletAddress = '' } = req.body ?? {};

  if (!walletAddress) {
    return res.status(400).json({ error: 'walletAddress is required' });
  }

  const nonce = createAuthChallenge();
  const user = await User.findOneAndUpdate(
    { walletAddress: walletAddress.toLowerCase() },
    { walletAddress: walletAddress.toLowerCase(), authNonce: nonce },
    { upsert: true, new: true }
  );

  return res.json({
    walletAddress: user.walletAddress,
    nonce,
    message: buildLoginMessage(user.walletAddress, nonce)
  });
});

router.post('/auth/verify', async (req, res) => {
  const { walletAddress = '', signature = '', nonce = '' } = req.body ?? {};

  if (!walletAddress || !signature || !nonce) {
    return res.status(400).json({ error: 'walletAddress, signature, and nonce are required' });
  }

  const user = await User.findOne({ walletAddress: walletAddress.toLowerCase() });
  if (!user || user.authNonce !== nonce) {
    return res.status(401).json({ error: 'invalid nonce' });
  }

  const valid = verifyLoginSignature(user.walletAddress, nonce, signature);
  if (!valid) {
    return res.status(401).json({ error: 'invalid signature' });
  }

  user.authNonce = '';
  user.lastLoginAt = new Date();
  await user.save();

  await AuditLog.create({
    action: 'wallet_login',
    actor: user.walletAddress,
    metadata: { walletAddress: user.walletAddress }
  });

  return res.json({ ok: true, walletAddress: user.walletAddress });
});

router.post('/parse-voucher', (req, res) => {
  const { text = '' } = req.body ?? {};
  res.json(parseVoucherText(text));
});

router.post('/vouchers', async (req, res) => {
  const { walletAddress = '', text = '', provider: providerInput, value: valueInput, expiry: expiryInput } = req.body ?? {};

  if (!walletAddress || !text) {
    return res.status(400).json({ error: 'walletAddress and text are required' });
  }

  const parsed = parseVoucherText(text);
  const provider = providerInput || parsed.provider;
  const value = Number.isFinite(Number(valueInput)) ? Number(valueInput) : parsed.value;
  const code = parsed.code;
  const expiry = normalizeExpiry(expiryInput || parsed.expiry);

  if (!code) {
    return res.status(400).json({ error: 'voucher code not found' });
  }

  if (!expiry) {
    return res.status(400).json({ error: 'expiry could not be parsed' });
  }

  if (expiry.getTime() <= Date.now()) {
    return res.status(400).json({ error: 'voucher is expired' });
  }

  const codeHash = buildVoucherHash(code);
  const existing = await Voucher.findOne({ codeHash });
  if (existing) {
    if (!existing.extractedCode) {
      existing.extractedCode = code.toUpperCase();
      await existing.save();
    }

    const listing = await findActiveListingForVoucher(existing._id);
    return res.json({
      voucher: serializeVoucher(existing, listing),
      alreadyExists: true
    });
  }

  const voucher = await Voucher.create({
    provider,
    value: value ?? 0,
    text,
    codeHash,
    extractedCode: code.toUpperCase(),
    expiry,
    uploaderWallet: walletAddress.toLowerCase(),
    status: 'draft',
    encryptedCodeRef: ''
  });

  await AuditLog.create({
    action: 'voucher_created',
    actor: walletAddress.toLowerCase(),
    metadata: { voucherId: voucher._id.toString(), codeHash, provider, value }
  });

  return res.status(201).json({
    voucher: serializeVoucher(voucher)
  });
});

router.get('/vouchers', async (_req, res) => {
  const vouchers = await Voucher.find().sort({ createdAt: -1 }).limit(100);
  const voucherIds = vouchers.map((voucher) => voucher._id);
  const listings = await Listing.find({ voucherId: { $in: voucherIds }, state: 'created' }).sort({ createdAt: -1 });
  const listingsByVoucherId = new Map();
  for (const listing of listings) {
    const voucherId = listing.voucherId?.toString();
    if (voucherId && !listingsByVoucherId.has(voucherId)) {
      listingsByVoucherId.set(voucherId, listing);
    }
  }

  return res.json({
    items: vouchers.map((voucher) => serializeVoucher(voucher, listingsByVoucherId.get(voucher._id.toString())))
  });
});

router.get('/vouchers/portfolio', async (req, res) => {
  const walletAddress = String(req.query.walletAddress || '').trim().toLowerCase();

  if (!walletAddress) {
    return res.status(400).json({ error: 'walletAddress is required' });
  }

  const [boughtListings, soldListings] = await Promise.all([
    Listing.find({ buyerWallet: walletAddress }).sort({ updatedAt: -1 }).limit(100),
    Listing.find({ sellerWallet: walletAddress }).sort({ updatedAt: -1 }).limit(100)
  ]);

  const [bought, sold] = await Promise.all([
    Promise.all(boughtListings.map((listing) => serializeTrade(listing, 'bought'))),
    Promise.all(soldListings.map((listing) => serializeTrade(listing, 'sold')))
  ]);

  return res.json({ bought, sold });
});

router.get('/leaderboard', async (_req, res) => {
  const users = await User.find({})
    .sort({ xirecBalanceMirror: -1, reputationScore: -1, updatedAt: -1 })
    .limit(25);

  return res.json({
    items: users.map((user, index) => serializeLeaderboardUser(user, index + 1))
  });
});

router.get('/user/:walletAddress', async (req, res) => {
  const walletAddress = String(req.params.walletAddress || '').trim().toLowerCase();

  if (!walletAddress) {
    return res.status(400).json({ error: 'walletAddress is required' });
  }

  const user = await User.findOne({ walletAddress });
  if (!user) {
    return res.status(404).json({ error: 'user not found' });
  }

  return res.json({
    walletAddress: user.walletAddress,
    username: user.username || '',
    reputationScore: Number(user.reputationScore || 0),
    xirecBalanceMirror: Number(user.xirecBalanceMirror || 0),
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  });
});

router.get('/vouchers/:id', async (req, res) => {
  const voucher = await Voucher.findById(req.params.id);
  if (!voucher) {
    return res.status(404).json({ error: 'voucher not found' });
  }

  const listing = await findActiveListingForVoucher(voucher._id);
  return res.json({
    voucher: serializeVoucher(voucher, listing)
  });
});

router.post('/listings/:listingId/purchase', async (req, res) => {
  const { walletAddress = '' } = req.body ?? {};
  const listingIdOnChain = Number(req.params.listingId);

  if (!walletAddress) {
    return res.status(400).json({ error: 'walletAddress is required' });
  }

  if (!Number.isSafeInteger(listingIdOnChain) || listingIdOnChain <= 0) {
    return res.status(400).json({ error: 'listingId must be a positive number' });
  }

  const listing = await Listing.findOne({ listingIdOnChain });
  if (!listing) {
    return res.status(404).json({ error: 'listing not found' });
  }

  // Only transfer balance if not already purchased (prevent double transfer)
  const shouldTransferBalance = listing.state !== 'purchased' && listing.state !== 'confirmed';

  listing.buyerWallet = walletAddress.toLowerCase();
  listing.state = 'purchased';
  await listing.save();

  if (shouldTransferBalance) {
    await transferVoucherPurchaseBalance({
      buyerWallet: walletAddress,
      sellerWallet: listing.sellerWallet,
      amount: listing.priceXirec
    });
  }

  if (listing.voucherId) {
    await Voucher.updateOne(
      { _id: listing.voucherId },
      { $set: { status: 'sold' } }
    );
  }

  await AuditLog.create({
    action: 'listing_purchased_from_frontend',
    actor: walletAddress.toLowerCase(),
    metadata: { listingId: listingIdOnChain }
  });

  return res.json({ trade: await serializeTrade(listing, 'bought') });
});

router.post('/vouchers/:id/chain-listing', async (req, res) => {
  const { listingId = '', walletAddress = '', priceXirec = 0, escrowAmount = 0 } = req.body ?? {};
  const voucher = await Voucher.findById(req.params.id);

  if (!voucher) {
    return res.status(404).json({ error: 'voucher not found' });
  }

  if (!listingId) {
    return res.status(400).json({ error: 'listingId is required' });
  }

  if (!walletAddress) {
    return res.status(400).json({ error: 'walletAddress is required' });
  }

  const listingIdOnChain = Number(listingId);
  if (!Number.isSafeInteger(listingIdOnChain) || listingIdOnChain <= 0) {
    return res.status(400).json({ error: 'listingId must be a positive number' });
  }

  const listing = await Listing.findOneAndUpdate(
    { listingIdOnChain },
    {
      $set: {
        listingIdOnChain,
        sellerWallet: walletAddress.toLowerCase(),
        voucherId: voucher._id,
        priceXirec: Number(priceXirec) || voucher.value,
        escrowAmount: Number(escrowAmount) || 0,
        state: 'created'
      }
    },
    { new: true, upsert: true }
  );

  voucher.status = 'listed';
  await voucher.save();

  await AuditLog.create({
    action: 'listing_recorded_from_upload',
    actor: walletAddress.toLowerCase(),
    metadata: { voucherId: voucher._id.toString(), listingId: listingIdOnChain }
  });

  return res.json({ voucher: serializeVoucher(voucher, listing) });
});

router.post('/games/reward-signature', async (req, res) => {
  const { to = '', gameType = '', result = '', score = 0, roundsPlayed = 0, nonce = 0, chainId = 11155111, verifyingContract = '', summary = '' } = req.body ?? {};

  if (!process.env.BACKEND_SIGNER_PRIVATE_KEY) {
    return res.status(500).json({ error: 'BACKEND_SIGNER_PRIVATE_KEY is not configured' });
  }

  if (!to || !verifyingContract) {
    return res.status(400).json({ error: 'to and verifyingContract are required' });
  }

  if (!GAME_TYPES.has(gameType)) {
    return res.status(400).json({ error: 'unsupported gameType' });
  }

  if (!GAME_RESULTS.has(result)) {
    return res.status(400).json({ error: 'unsupported result' });
  }

  const numericScore = Number(score);
  if (!Number.isFinite(numericScore) || numericScore <= 0) {
    return res.status(400).json({ error: 'score must be a positive number' });
  }

  const rewardAmount = computeRewardAmount({ gameType, result, score: numericScore });
  const rewardAmountUnits = parseUnits(String(rewardAmount), 18);

  const signer = createRewardSigner(process.env.BACKEND_SIGNER_PRIVATE_KEY);
  const signature = await signer.signReward({
    chainId: Number(chainId),
    verifyingContract,
    to,
    amount: rewardAmountUnits,
    nonce
  });

  await GameSession.create({
    walletAddress: to.toLowerCase(),
    gameType,
    result,
    rewardAmount,
    rewardAuthorized: true,
    rewardNonce: Number(nonce),
    rewardSignature: signature,
    score: numericScore,
    roundsPlayed: Number(roundsPlayed) || 0,
    details: {
      summary,
      chainId: Number(chainId),
      verifyingContract,
      rewardAmount,
      rewardAmountUnits: rewardAmountUnits.toString(),
      score: numericScore
    }
  });

  return res.json({ signature, nonce: Number(nonce), signer: signer.address, amount: rewardAmount });
});

router.get('/seller/:walletAddress/pending-payouts', async (req, res) => {
  const walletAddress = String(req.params.walletAddress || '').trim().toLowerCase();

  if (!walletAddress) {
    return res.status(400).json({ error: 'walletAddress is required' });
  }

  const payouts = await getPendingSellerPayouts(walletAddress);

  return res.json({
    walletAddress,
    pendingListings: payouts.pendingListings.map((listing) => ({
      listingId: listing.listingIdOnChain,
      buyerWallet: listing.buyerWallet,
      amount: listing.priceXirec,
      purchasedAt: listing.updatedAt
    })),
    totalPayable: payouts.totalPayable,
    count: payouts.count
  });
});

router.get('/listings/:listingId/confirmation-tx', async (req, res) => {
  const listingIdOnChain = Number(req.params.listingId);
  const sellerWallet = String(req.query.sellerWallet || '').trim().toLowerCase();

  if (!sellerWallet) {
    return res.status(400).json({ error: 'sellerWallet is required' });
  }

  if (!Number.isSafeInteger(listingIdOnChain) || listingIdOnChain <= 0) {
    return res.status(400).json({ error: 'listingId must be a positive number' });
  }

  const listing = await Listing.findOne({ listingIdOnChain });
  if (!listing) {
    return res.status(404).json({ error: 'listing not found' });
  }

  if (listing.sellerWallet !== sellerWallet) {
    return res.status(403).json({ error: 'only seller can request confirmation from buyer' });
  }

  if (listing.state !== 'purchased') {
    return res.status(400).json({ error: 'listing is not in purchased state' });
  }

  if (!listing.buyerWallet) {
    return res.status(400).json({ error: 'listing has no buyer yet' });
  }

  // Generate transaction data for confirmReceived()
  const marketplaceAddress = process.env.NEXT_PUBLIC_VOUCHER_ESCROW_ADDRESS || process.env.VOUCHER_ESCROW_ADDRESS;
  if (!marketplaceAddress) {
    return res.status(500).json({ error: 'marketplace address not configured' });
  }

  // confirmReceived(uint256 listingId) function selector
  const functionSelector = '0xc8456fb9'; // keccak256('confirmReceived(uint256)').slice(0,8)
  const encodedListingId = toBeHex(listingIdOnChain, 32).slice(2);
  const data = functionSelector + encodedListingId;

  return res.json({
    listingId: listingIdOnChain,
    sellerWallet,
    buyerWallet: listing.buyerWallet,
    amount: listing.priceXirec,
    escrowAmount: listing.escrowAmount,
    totalPayout: listing.priceXirec + (listing.escrowAmount || 0),
    tx: {
      to: marketplaceAddress.toLowerCase(),
      data,
      value: '0'
    },
    note: 'Ask the buyer to confirm receipt by approving this transaction. Once confirmed, payment will be transferred to your wallet.'
  });
});

export default router;
