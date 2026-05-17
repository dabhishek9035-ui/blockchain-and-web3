import mongoose from 'mongoose';

const voucherSchema = new mongoose.Schema(
  {
    provider: { type: String, required: true },
    value: { type: Number, required: true },
    text: { type: String, default: '' },
    codeHash: { type: String, required: true, unique: true, index: true },
    extractedCode: { type: String, default: '' },
    expiry: { type: Date, required: true },
    uploaderWallet: { type: String, required: true },
    status: { type: String, enum: ['draft', 'listed', 'sold', 'expired', 'disputed'], default: 'draft' },
    encryptedCodeRef: { type: String, default: '' }
  },
  { timestamps: true }
);

export const Voucher = mongoose.model('Voucher', voucherSchema);
