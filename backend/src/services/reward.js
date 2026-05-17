import { Wallet } from 'ethers';

const REWARD_DOMAIN = {
  name: 'XirecReward',
  version: '1'
};

const REWARD_TYPES = {
  Reward: [
    { name: 'to', type: 'address' },
    { name: 'amount', type: 'uint256' },
    { name: 'nonce', type: 'uint256' }
  ]
};

export function createRewardSigner(privateKey) {
  if (!privateKey) {
    throw new Error('BACKEND_SIGNER_PRIVATE_KEY is required');
  }

  const wallet = new Wallet(privateKey);

  return {
    address: wallet.address,
    async signReward({ chainId, verifyingContract, to, amount, nonce }) {
      const domain = {
        ...REWARD_DOMAIN,
        chainId,
        verifyingContract
      };

      return wallet.signTypedData(domain, REWARD_TYPES, {
        to,
        amount: BigInt(amount),
        nonce: Number(nonce)
      });
    }
  };
}
