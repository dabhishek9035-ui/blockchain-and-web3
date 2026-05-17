import mongoose from 'mongoose';

const disputeSchema = new mongoose.Schema(
  {
    listingIdOnChain: { type: Number, required: true, index: true },
    buyerWallet: { type: String, required: true },
    sellerWallet: { type: String, required: true },
    evidenceLinks: [{ type: String }],
    status: { type: String, enum: ['open', 'reviewing', 'resolved', 'rejected'], default: 'open' },
    resolution: { type: String, default: '' },
    resolvedBy: { type: String, default: '' }
  },
  { timestamps: true }
);

export const Dispute = mongoose.model('Dispute', disputeSchema);
