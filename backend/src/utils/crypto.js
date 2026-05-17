import { createHash, randomBytes } from 'node:crypto';

export function sha256Hex(value) {
  return createHash('sha256').update(String(value), 'utf8').digest('hex');
}

export function randomNonce(length = 16) {
  return randomBytes(length).toString('hex');
}
