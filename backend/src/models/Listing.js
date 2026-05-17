import mongoose from 'mongoose';

const listingSchema = new mongoose.Schema(
  {
    listingIdOnChain: { type: Number, index: true },
    sellerWallet: { type: String, required: true },
    buyerWallet: { type: String, default: '' },
    voucherId: { type: mongoose.Schema.Types.ObjectId, ref: 'Voucher', default: null },
    priceXirec: { type: Number, required: true },
    escrowAmount: { type: Number, required: true },
    state: { type: String, enum: ['created', 'purchased', 'confirmed', 'disputed', 'resolved', 'cancelled', 'expired'], default: 'created' }
  },
  { timestamps: true }
);

export const Listing = mongoose.model('Listing', listingSchema);
