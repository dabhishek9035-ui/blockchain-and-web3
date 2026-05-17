import mongoose from 'mongoose';

const gameSessionSchema = new mongoose.Schema(
  {
    walletAddress: { type: String, required: true, index: true },
    gameType: { type: String, required: true },
    result: { type: String, required: true },
    rewardAmount: { type: Number, default: 0 },
    rewardAuthorized: { type: Boolean, default: false },
    rewardNonce: { type: Number, default: 0 },
    rewardSignature: { type: String, default: '' },
    score: { type: Number, default: 0 },
    roundsPlayed: { type: Number, default: 0 },
    details: { type: Object, default: {} }
  },
  { timestamps: true }
);

export const GameSession = mongoose.model('GameSession', gameSessionSchema);
