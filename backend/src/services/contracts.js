export const MARKETPLACE_ABI = [
  'event ListingCreated(uint256 indexed listingId, address indexed seller, bytes32 voucherHash, uint256 price, uint256 escrowAmount, uint256 expiry)',
  'event ListingPurchased(uint256 indexed listingId, address indexed buyer)',
  'event ListingConfirmed(uint256 indexed listingId)',
  'event DisputeRaised(uint256 indexed listingId, address indexed buyer, string reason)',
  'event DisputeResolved(uint256 indexed listingId, bool buyerWins, uint256 penaltyAmount)',
  'event ListingCancelled(uint256 indexed listingId)',
  'event ListingExpired(uint256 indexed listingId)',
  'function listings(uint256 listingId) view returns (address seller, address buyer, bytes32 voucherHash, uint256 price, uint256 escrowAmount, uint256 expiryTimestamp, uint8 state, uint256 createdAt)'
];

export const XIREC_TOKEN_ABI = [
  'function balanceOf(address account) view returns (uint256)',
  'function nonces(address owner) view returns (uint256)',
  'function mint(address to, uint256 amount)'
];

export const REPUTATION_ABI = [
  'function getReputation(address who) view returns (uint256)',
  'function increaseReputation(address who, uint256 amount)',
  'function decreaseReputation(address who, uint256 amount)'
];

export const REWARD_DISTRIBUTOR_ABI = [
  'function nonces(address recipient) view returns (uint256)',
  'function distributeReward(address to, uint256 amount, uint256 nonce, bytes signature)'
];
