import { sha256Hex } from '../utils/crypto.js';

export function normalizeExpiry(expiryInput) {
  const value = String(expiryInput || '').trim().toLowerCase();
  if (!value) {
    return null;
  }

  const now = new Date();
  if (value === 'today') {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  }

  if (value === 'tomorrow') {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 2);
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function buildVoucherHash(code) {
  return sha256Hex(code).toLowerCase();
}
