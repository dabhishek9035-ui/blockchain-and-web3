import { createContracts, createProvider } from '../services/chain.js';
import {
  handleDisputeRaised,
  handleDisputeResolved,
  handleListingCancelled,
  handleListingConfirmed,
  handleListingCreated,
  handleListingExpired,
  handleListingPurchased
} from '../services/chainSync.js';

export function startMarketplaceListener({
  rpcUrl,
  marketplaceAddress,
  tokenAddress,
  reputationAddress,
  rewardDistributorAddress
}) {
  if (!rpcUrl || !marketplaceAddress) {
    return {
      started: false,
      reason: 'rpcUrl and marketplaceAddress are required',
      stop() {
        return undefined;
      }
    };
  }

  const provider = createProvider(rpcUrl);
  const contracts = createContracts({
    provider,
    marketplaceAddress,
    tokenAddress,
    reputationAddress,
    rewardDistributorAddress
  });

  const marketplace = contracts.marketplace;
  const listeners = [];

  if (!marketplace) {
    return {
      started: false,
      reason: 'marketplace contract not configured',
      stop() {
        return undefined;
      }
    };
  }

  const register = (eventName, handler) => {
    const listener = (...args) => {
      const event = args[args.length - 1];
      handler(event).catch((error) => {
        console.error(`[listener] ${eventName} failed`, error);
      });
    };

    try {
      marketplace.on(eventName, listener);
    } catch (error) {
      console.error(`[listener] Failed to register ${eventName} listener:`, error.message);
    }
    listeners.push([eventName, listener]);
  };

  register('ListingCreated', handleListingCreated);
  register('ListingPurchased', handleListingPurchased);
  register('ListingConfirmed', handleListingConfirmed);
  register('DisputeRaised', handleDisputeRaised);
  register('DisputeResolved', handleDisputeResolved);
  register('ListingCancelled', handleListingCancelled);
  register('ListingExpired', handleListingExpired);

  return {
    started: true,
    async syncPastEvents(fromBlock = 0) {
      const eventMap = [
        ['ListingCreated', handleListingCreated],
        ['ListingPurchased', handleListingPurchased],
        ['ListingConfirmed', handleListingConfirmed],
        ['DisputeRaised', handleDisputeRaised],
        ['DisputeResolved', handleDisputeResolved],
        ['ListingCancelled', handleListingCancelled],
        ['ListingExpired', handleListingExpired]
      ];

      for (const [eventName, handler] of eventMap) {
        const logs = await marketplace.queryFilter(eventName, fromBlock, 'latest');
        for (const log of logs) {
          await handler(log);
        }
      }
    },
    stop() {
      for (const [eventName, listener] of listeners) {
        marketplace.off(eventName, listener);
      }
    }
  };
}
