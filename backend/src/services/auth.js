import { verifyMessage } from 'ethers';
import { randomNonce } from '../utils/crypto.js';

export function buildLoginMessage(walletAddress, nonce) {
  return `Xirec login\nWallet: ${walletAddress}\nNonce: ${nonce}`;
}

export function verifyLoginSignature(walletAddress, nonce, signature) {
  const message = buildLoginMessage(walletAddress, nonce);
  const recovered = verifyMessage(message, signature);
  return recovered.toLowerCase() === String(walletAddress).toLowerCase();
}

export function createAuthChallenge() {
  return randomNonce(16);
}
