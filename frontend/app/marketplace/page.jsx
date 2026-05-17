"use client";

import { useEffect, useMemo, useState } from 'react';
import { parseUnits } from 'ethers';
import { backendUrl, postJson } from '../../lib/api.js';
import { getContractAddresses, getEscrowContract, getReadOnlyEscrowContract, getTokenContract } from '../../lib/contracts.js';
import Button from '../../components/Button';
import Card from '../../components/Card';

function isBuyableListing(item) {
  return Boolean(item.listingId) && (!item.listingState || item.listingState === 'created');
}

function isChainListed(listing) {
  return listing?.seller && listing.seller !== '0x0000000000000000000000000000000000000000' && Number(listing.state) === 0;
}

function isNotListedError(err) {
  return String(err?.shortMessage || err?.reason || err?.message || '').toLowerCase().includes('not listed');
}

export default function MarketplacePage() {
  const [items, setItems] = useState([]);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [loadingId, setLoadingId] = useState('');
  const [addresses] = useState(getContractAddresses());

  const canUseChain = useMemo(() => Boolean(addresses.escrow && addresses.token), [addresses]);

  useEffect(() => {
    async function loadListings() {
      try {
        const response = await fetch(`${backendUrl}/api/vouchers`);
        const data = await response.json();
        const buyableItems = (data.items || []).filter(isBuyableListing);

        if (!canUseChain) {
          setItems(buyableItems);
          return;
        }

        const escrowContract = await getReadOnlyEscrowContract();
        const activeItems = [];

        for (const item of buyableItems) {
          try {
            const listing = await escrowContract.listings(item.listingId);
            if (isChainListed(listing)) {
              activeItems.push(item);
            }
          } catch {
            // Keep the marketplace usable even if one chain read fails.
          }
        }

        setItems(activeItems);
      } catch (err) {
        setError(err.message || 'Failed to load marketplace');
      }
    }

    loadListings();
  }, [canUseChain]);

  async function buyListing(item) {
    try {
      setLoadingId(item.id);
      setError('');
      setStatus('Preparing purchase...');

      if (!item.listingId) {
        throw new Error('This voucher is missing its on-chain listing id');
      }

      const tokenContract = await getTokenContract();
      const escrowContract = await getEscrowContract();
      const listing = await escrowContract.listings(item.listingId);
      if (!isChainListed(listing)) {
        setItems((currentItems) => currentItems.filter((currentItem) => currentItem.id !== item.id));
        setStatus('');
        return;
      }

      const price = parseUnits(String(item.priceXirec ?? item.value ?? '0'), 18);

      setStatus(`Approving purchase for listing #${item.listingId}...`);
      const approveTx = await tokenContract.approve(addresses.escrow, price);
      await approveTx.wait();

      setStatus(`Buying listing #${item.listingId} on Sepolia...`);
      const buyTx = await escrowContract.buyListing(item.listingId);
      await buyTx.wait();

      const buyerAddress = await escrowContract.runner?.getAddress?.();
      if (buyerAddress) {
        try {
          await postJson(`/api/listings/${item.listingId}/purchase`, { walletAddress: buyerAddress });
        } catch {
          // The chain purchase is final; the listener can still sync this record later.
        }
      }

      setItems((currentItems) => currentItems.filter((currentItem) => currentItem.id !== item.id));
      setStatus(`Purchase sent for listing #${item.listingId}.`);
    } catch (err) {
      if (isNotListedError(err)) {
        setItems((currentItems) => currentItems.filter((currentItem) => currentItem.id !== item.id));
        setError('');
        setStatus('');
        return;
      }

      setError(err.message || 'Failed to buy listing');
      setStatus('');
    } finally {
      setLoadingId('');
    }
  }

  return (
    <main className="mx-auto max-w-7xl px-6 py-12">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
        <div>
          <h1 className="text-4xl font-bold text-white">Voucher Marketplace</h1>
          <p className="mt-2 text-slate-400 text-lg">Buy vouchers that are already listed on-chain.</p>
        </div>
        <div className="flex gap-4">
          <div className="glass-card py-2 px-4 flex items-center gap-3">
            <div className={`h-2 w-2 rounded-full ${canUseChain ? 'bg-emerald-500' : 'bg-rose-500'}`} />
            <span className="text-xs font-medium text-slate-300 uppercase tracking-wider">
              Chain Connection: {canUseChain ? 'Connected' : 'Disconnected'}
            </span>
          </div>
        </div>
      </div>

      {(error || status) && (
        <div className={`mb-8 p-4 rounded-2xl border ${error ? 'bg-rose-500/10 border-rose-500/20 text-rose-400' : 'bg-cyan-500/10 border-cyan-500/20 text-cyan-400'}`}>
          <p className="text-sm font-medium">{error || status}</p>
        </div>
      )}

      <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
        {items.length === 0 ? (
          <Card className="md:col-span-3 py-20 text-center">
            <div className="text-5xl mb-4 text-slate-600">Ticket</div>
            <h3 className="text-xl font-semibold text-white">No on-chain listings available</h3>
            <p className="mt-2 text-slate-500">Upload a voucher to create a blockchain listing.</p>
            <Button href="/upload" variant="secondary" className="mt-6">Upload Voucher</Button>
          </Card>
        ) : (
          items.map((item) => (
            <Card key={item.id} className="flex flex-col">
              <div className="flex justify-between items-start mb-4">
                <span className="px-2.5 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 text-xs font-bold uppercase tracking-wider">
                  {item.provider}
                </span>
                <span className="text-xs font-medium text-emerald-400">
                  {item.listingState || item.status}
                </span>
              </div>

              <div className="mb-6">
                <span className="text-sm text-slate-500 uppercase font-medium tracking-widest">Value</span>
                <h2 className="text-4xl font-bold text-white">Rs {item.value}</h2>
              </div>

              <div className="space-y-3 mb-8">
                <div className="flex justify-between gap-4 text-sm">
                  <span className="text-slate-500">Code Hash</span>
                  <span className="text-slate-300 font-mono truncate max-w-[150px]">{item.codeHash}</span>
                </div>
                <div className="flex justify-between gap-4 text-sm">
                  <span className="text-slate-500">Listing ID</span>
                  <span className="text-cyan-300 font-mono">#{item.listingId}</span>
                </div>
                <div className="flex justify-between gap-4 text-sm">
                  <span className="text-slate-500">Price</span>
                  <span className="text-slate-300">{item.priceXirec ?? item.value} XIREC</span>
                </div>
                <div className="flex justify-between gap-4 text-sm">
                  <span className="text-slate-500">Expires</span>
                  <span className="text-slate-300">{new Date(item.expiry).toLocaleDateString()}</span>
                </div>
              </div>

              <div className="mt-auto pt-6 border-t border-slate-800">
                <Button
                  className="w-full"
                  onClick={() => buyListing(item)}
                  loading={loadingId === item.id}
                  disabled={!canUseChain}
                >
                  Buy Now
                </Button>
              </div>
            </Card>
          ))
        )}
      </div>
    </main>
  );
}
