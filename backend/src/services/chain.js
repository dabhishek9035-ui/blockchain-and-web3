import { Contract, JsonRpcProvider } from 'ethers';
import { MARKETPLACE_ABI, REPUTATION_ABI, REWARD_DISTRIBUTOR_ABI, XIREC_TOKEN_ABI } from './contracts.js';

export function createProvider(rpcUrl) {
  if (!rpcUrl) {
    throw new Error('RPC_URL is required');
  }

  // Increase timeout to 30 seconds for slow RPC endpoints
  const provider = new JsonRpcProvider(rpcUrl, null, { timeout: 30000 });
  return provider;
}

export function createContracts({ provider, marketplaceAddress, tokenAddress, reputationAddress, rewardDistributorAddress }) {
  return {
    marketplace: marketplaceAddress ? new Contract(marketplaceAddress, MARKETPLACE_ABI, provider) : null,
    token: tokenAddress ? new Contract(tokenAddress, XIREC_TOKEN_ABI, provider) : null,
    reputation: reputationAddress ? new Contract(reputationAddress, REPUTATION_ABI, provider) : null,
    rewardDistributor: rewardDistributorAddress ? new Contract(rewardDistributorAddress, REWARD_DISTRIBUTOR_ABI, provider) : null
  };
}
