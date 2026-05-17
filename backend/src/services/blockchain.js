export function createBlockchainHelper({ provider, signer }) {
  return {
    provider,
    signer,
    async getCurrentBlockNumber() {
      return provider.getBlockNumber();
    }
  };
}
