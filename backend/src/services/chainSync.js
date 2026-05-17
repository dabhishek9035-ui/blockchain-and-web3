import { formatUnits } from 'ethers';
import { Listing } from '../models/Listing.js';
import { Voucher } from '../models/Voucher.js';
import { Dispute } from '../models/Dispute.js';
import { AuditLog } from '../models/AuditLog.js';
import { transferVoucherPurchaseBalance } from './accounting.js';

async function updateListingFromEvent(listingId, patch, options = {}) {
  const listing = await Listing.findOneAndUpdate(
    { listingIdOnChain: Number(listingId) },
    { $set: patch },
    { new: true, upsert: Boolean(options.upsert) }
  );

  return listing;
}

function normalizeCodeHash(hash) {
  return String(hash || '').toLowerCase().replace(/^0x/, '');
}

export async function handleListingCreated(event) {
  const { listingId, seller, voucherHash, price, escrowAmount, expiry } = event.args;
  const codeHash = normalizeCodeHash(voucherHash);
  const voucher = await Voucher.findOne({ codeHash });
  const listing = await updateListingFromEvent(listingId, {
    listingIdOnChain: Number(listingId),
    sellerWallet: String(seller).toLowerCase(),
    priceXirec: Number(formatUnits(price, 18)),
    escrowAmount: Number(formatUnits(escrowAmount, 18)),
    voucherId: voucher?._id || null,
    state: 'created'
  }, { upsert: true });

  if (voucherHash) {
    await Voucher.updateOne(
      { codeHash },
      { $set: { status: 'listed', expiry: new Date(Number(expiry) * 1000) } }
    );
  }

  await AuditLog.create({
    action: 'listing_created_onchain',
    actor: String(seller).toLowerCase(),
    txHash: event.transactionHash,
    metadata: {
      listingId: Number(listingId),
      voucherHash: codeHash,
      price: Number(formatUnits(price, 18)),
      escrowAmount: Number(formatUnits(escrowAmount, 18))
    }
  });

  return listing;
}

export async function handleListingPurchased(event) {
  const { listingId, buyer } = event.args;
  const existing = await Listing.findOne({ listingIdOnChain: Number(listingId) });
  if (!existing) {
    return null;
  }

  const listing = await updateListingFromEvent(listingId, {
    buyerWallet: String(buyer).toLowerCase(),
    state: 'purchased'
  });

  if (listing) {
    await transferVoucherPurchaseBalance({
      buyerWallet: buyer,
      sellerWallet: listing.sellerWallet,
      amount: listing.priceXirec
    });

    if (listing.voucherId) {
      await Voucher.updateOne(
        { _id: listing.voucherId },
        { $set: { status: 'sold' } }
      );
    }

    await AuditLog.create({
      action: 'listing_purchased_onchain',
      actor: String(buyer).toLowerCase(),
      txHash: event.transactionHash,
      metadata: { listingId: Number(listingId) }
    });
  }

  return listing;
}

export async function handleListingConfirmed(event) {
  const { listingId } = event.args;
  const existing = await Listing.findOne({ listingIdOnChain: Number(listingId) });
  if (!existing) {
    return null;
  }

  const listing = await updateListingFromEvent(listingId, { state: 'confirmed' });
  if (listing) {
    await AuditLog.create({
      action: 'listing_confirmed_onchain',
      actor: listing.sellerWallet,
      txHash: event.transactionHash,
      metadata: { listingId: Number(listingId) }
    });
  }
  return listing;
}

export async function handleDisputeRaised(event) {
  const { listingId, buyer, reason } = event.args;
  const existing = await Listing.findOne({ listingIdOnChain: Number(listingId) });
  if (!existing) {
    return null;
  }

  const listing = await updateListingFromEvent(listingId, { state: 'disputed' });

  if (listing) {
    await Dispute.create({
      listingIdOnChain: Number(listingId),
      buyerWallet: String(buyer).toLowerCase(),
      sellerWallet: listing.sellerWallet,
      evidenceLinks: [],
      status: 'open',
      resolution: reason || ''
    });
  }

  await AuditLog.create({
    action: 'dispute_raised_onchain',
    actor: String(buyer).toLowerCase(),
    txHash: event.transactionHash,
    metadata: { listingId: Number(listingId), reason: reason || '' }
  });

  return listing;
}

export async function handleDisputeResolved(event) {
  const { listingId, buyerWins, penaltyAmount } = event.args;
  const existing = await Listing.findOne({ listingIdOnChain: Number(listingId) });
  if (!existing) {
    return null;
  }

  const listing = await updateListingFromEvent(listingId, {
    state: 'resolved'
  });

  await Dispute.updateOne(
    { listingIdOnChain: Number(listingId) },
    { $set: { status: 'resolved', resolvedBy: 'onchain', resolution: buyerWins ? 'buyer_wins' : 'seller_wins' } }
  );

  await AuditLog.create({
    action: 'dispute_resolved_onchain',
    actor: listing?.sellerWallet || '',
    txHash: event.transactionHash,
    metadata: { listingId: Number(listingId), buyerWins: Boolean(buyerWins), penaltyAmount: Number(penaltyAmount) }
  });

  return listing;
}

export async function handleListingCancelled(event) {
  const { listingId } = event.args;
  const existing = await Listing.findOne({ listingIdOnChain: Number(listingId) });
  if (!existing) {
    return null;
  }

  const listing = await updateListingFromEvent(listingId, { state: 'cancelled' });
  if (listing) {
    await AuditLog.create({
      action: 'listing_cancelled_onchain',
      actor: listing.sellerWallet,
      txHash: event.transactionHash,
      metadata: { listingId: Number(listingId) }
    });
  }
  return listing;
}

export async function handleListingExpired(event) {
  const { listingId } = event.args;
  const existing = await Listing.findOne({ listingIdOnChain: Number(listingId) });
  if (!existing) {
    return null;
  }

  const listing = await updateListingFromEvent(listingId, { state: 'expired' });
  if (listing) {
    if (listing.voucherId) {
      await Voucher.updateOne(
        { _id: listing.voucherId },
        { $set: { status: 'expired' } }
      );
    }

    await AuditLog.create({
      action: 'listing_expired_onchain',
      actor: listing.sellerWallet,
      txHash: event.transactionHash,
      metadata: { listingId: Number(listingId) }
    });
  }
  return listing;
}

