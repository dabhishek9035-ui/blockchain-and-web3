import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    walletAddress: { type: String, required: true, unique: true, index: true },
    username: { type: String, default: '' },
    reputationScore: { type: Number, default: 0 },
    xirecBalanceMirror: { type: Number, default: 0 },
    authNonce: { type: String, default: '' },
    lastLoginAt: { type: Date, default: null }
  },
  { timestamps: true }
);

export const User = mongoose.model('User', userSchema);
