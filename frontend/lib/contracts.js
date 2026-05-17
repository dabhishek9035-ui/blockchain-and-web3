import { BrowserProvider, Contract } from 'ethers';
import { ensureSepoliaNetwork, SEPOLIA_CHAIN_ID } from './wallet.js';

export const XIREC_TOKEN_ABI = [
  'function balanceOf(address account) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function mint(address to, uint256 amount)'
];

export const VOUCHER_ESCROW_ABI = [
  'function createListing(bytes32 voucherHash, uint256 price, uint256 escrowAmount, uint256 expiryTimestamp) returns (uint256)',
  'function buyListing(uint256 listingId)',
  'function confirmReceived(uint256 listingId)',
  'function raiseDispute(uint256 listingId, string reason)',
  'function listings(uint256 listingId) view returns (address seller, address buyer, bytes32 voucherHash, uint256 price, uint256 escrowAmount, uint256 expiryTimestamp, uint8 state, uint256 createdAt)',
  'event ListingCreated(uint256 indexed listingId, address indexed seller, bytes32 voucherHash, uint256 price, uint256 escrowAmount, uint256 expiry)',
  'event ListingPurchased(uint256 indexed listingId, address indexed buyer)',
  'event ListingConfirmed(uint256 indexed listingId)',
  'event DisputeRaised(uint256 indexed listingId, address indexed buyer, string reason)',
  'event DisputeResolved(uint256 indexed listingId, bool buyerWins, uint256 penaltyAmount)',
  'event ListingCancelled(uint256 indexed listingId)',
  'event ListingExpired(uint256 indexed listingId)'
];

export const REPUTATION_MANAGER_ABI = [
  'function getReputation(address who) view returns (uint256)'
];

export const REWARD_DISTRIBUTOR_ABI = [
  'function nonces(address recipient) view returns (uint256)',
  'function distributeReward(address to, uint256 amount, uint256 nonce, bytes signature)'
];

export function getContractAddresses() {
  return {
    token: process.env.NEXT_PUBLIC_XIREC_TOKEN_ADDRESS || '',
    escrow: process.env.NEXT_PUBLIC_VOUCHER_ESCROW_ADDRESS || '',
    reputation: process.env.NEXT_PUBLIC_REPUTATION_MANAGER_ADDRESS || '',
    rewardDistributor: process.env.NEXT_PUBLIC_REWARD_DISTRIBUTOR_ADDRESS || ''
  };
}

export function getConfiguredAddressesFromEnv() {
  return getContractAddresses();
}

export function toBytes32Hash(hash) {
  const normalized = String(hash || '').trim().toLowerCase();
  if (/^0x[0-9a-f]{64}$/.test(normalized)) {
    return normalized;
  }

  if (/^[0-9a-f]{64}$/.test(normalized)) {
    return `0x${normalized}`;
  }

  throw new Error('Voucher hash must be a 32-byte hex value');
}

export async function getBrowserProvider() {
  if (typeof window === 'undefined' || !window.ethereum) {
    throw new Error('MetaMask is not available');
  }

  await ensureSepoliaNetwork();
  return new BrowserProvider(window.ethereum);
}

export async function getReadOnlyBrowserProvider() {
  if (typeof window === 'undefined' || !window.ethereum) {
    throw new Error('MetaMask is not available');
  }

  return new BrowserProvider(window.ethereum);
}

export async function getSigner() {
  const provider = await getBrowserProvider();
  await provider.send('eth_requestAccounts', []);
  const network = await provider.getNetwork();
  if (Number(network.chainId) !== SEPOLIA_CHAIN_ID) {
    throw new Error(`Please switch MetaMask to Sepolia. Current chain ID: ${network.chainId.toString()}`);
  }

  return provider.getSigner();
}

export async function getEscrowContract() {
  const { escrow } = getContractAddresses();
  if (!escrow) {
    throw new Error('NEXT_PUBLIC_VOUCHER_ESCROW_ADDRESS is not configured');
  }

  const signer = await getSigner();
  return new Contract(escrow, VOUCHER_ESCROW_ABI, signer);
}

export async function getReadOnlyEscrowContract() {
  const { escrow } = getContractAddresses();
  if (!escrow) {
    throw new Error('NEXT_PUBLIC_VOUCHER_ESCROW_ADDRESS is not configured');
  }

  const provider = await getReadOnlyBrowserProvider();
  return new Contract(escrow, VOUCHER_ESCROW_ABI, provider);
}

export async function getTokenContract() {
  const { token } = getContractAddresses();
  if (!token) {
    throw new Error('NEXT_PUBLIC_XIREC_TOKEN_ADDRESS is not configured');
  }

  const signer = await getSigner();
  return new Contract(token, XIREC_TOKEN_ABI, signer);
}

export async function getRewardDistributorContract() {
  const { rewardDistributor } = getContractAddresses();
  if (!rewardDistributor) {
    throw new Error('NEXT_PUBLIC_REWARD_DISTRIBUTOR_ADDRESS is not configured');
  }

  const signer = await getSigner();
  return new Contract(rewardDistributor, REWARD_DISTRIBUTOR_ABI, signer);
}
