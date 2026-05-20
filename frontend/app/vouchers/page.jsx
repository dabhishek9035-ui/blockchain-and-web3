"use client";

import { useEffect, useMemo, useState } from 'react';
import Button from '../../components/Button';
import Card from '../../components/Card';
import { backendUrl } from '../../lib/api.js';

function shortAddress(address) {
  if (!address) return 'Not recorded';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function formatDate(value) {
  if (!value) return 'Unknown';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown';
  return date.toLocaleDateString();
}

function TradeCard({ trade, type, onRaiseDispute, disputeLoading }) {
  const voucher = trade.voucher || {};
  const isBought = type === 'bought';
  const canDispute = isBought && trade.state === 'purchased';
  const alreadyDisputed = trade.state === 'disputed';
  const statusClass = trade.state === 'purchased' || trade.state === 'confirmed'
    ? 'text-emerald-400 bg-emerald-500/10'
    : trade.state === 'disputed'
      ? 'text-rose-300 bg-rose-500/10'
      : 'text-cyan-400 bg-cyan-500/10';

  return (
    <Card className="flex min-h-[360px] flex-col" hoverEffect={false}>
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
            {isBought ? 'Bought Voucher' : 'Sold Voucher'}
          </p>
          <h2 className="mt-1 text-2xl font-bold text-white">{voucher.provider || 'Unknown Provider'}</h2>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider ${statusClass}`}>
          {trade.state || 'recorded'}
        </span>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-slate-800 bg-slate-950/50 p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Value</p>
          <p className="mt-1 text-2xl font-bold text-white">Rs {voucher.value ?? 0}</p>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-950/50 p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Price</p>
          <p className="mt-1 text-2xl font-bold text-cyan-300">{trade.priceXirec ?? voucher.value ?? 0}</p>
          <p className="text-xs text-slate-500">XIREC</p>
        </div>
      </div>

      {isBought && (
        <div className="mb-6 rounded-2xl border border-cyan-500/20 bg-cyan-500/10 p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-cyan-300">Extracted Code</p>
          <p className="mt-2 break-all font-mono text-2xl font-bold text-white">
            {voucher.extractedCode || 'Code not available'}
          </p>
        </div>
      )}

      {voucher.text && (
        <div className="mb-6 rounded-2xl border border-slate-700 bg-slate-900/50 p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-400">Original Message</p>
          <p className="mt-3 break-words text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">
            {voucher.text}
          </p>
        </div>
      )}

      {isBought && (
        <div className={`mb-6 rounded-2xl border p-4 ${alreadyDisputed ? 'border-rose-500/20 bg-rose-500/10' : 'border-amber-500/20 bg-amber-500/10'}`}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-amber-300">Dispute</p>
              <p className="mt-1 text-sm text-slate-200">
                {canDispute
                  ? 'Raise a dispute for this purchased voucher. The fee is 30 Xirec and the seller loses 30 reputation.'
                  : alreadyDisputed
                    ? 'A dispute has already been raised for this voucher.'
                    : 'Disputes can only be raised while the voucher is in purchased state.'}
              </p>
            </div>
            {canDispute && (
              <Button
                type="button"
                variant="danger"
                loading={disputeLoading}
                onClick={() => onRaiseDispute(trade)}
                className="shrink-0"
              >
                Raise Dispute
              </Button>
            )}
          </div>
        </div>
      )}

      <div className="mt-auto space-y-3 border-t border-slate-800 pt-5 text-sm">
        <div className="flex justify-between gap-4">
          <span className="text-slate-500">Listing ID</span>
          <span className="font-mono text-cyan-300">#{trade.listingId || 'N/A'}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-slate-500">{isBought ? 'Seller' : 'Buyer'}</span>
          <span className="font-mono text-slate-300">{shortAddress(isBought ? trade.sellerWallet : trade.buyerWallet)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-slate-500">Expires</span>
          <span className="text-slate-300">{formatDate(voucher.expiry)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-slate-500">Updated</span>
          <span className="text-slate-300">{formatDate(trade.updatedAt)}</span>
        </div>
      </div>
    </Card>
  );
}

function EmptyState({ type }) {
  return (
    <Card className="py-14 text-center" hoverEffect={false}>
      <h3 className="text-xl font-semibold text-white">No {type} vouchers yet</h3>
      <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
        {type === 'bought'
          ? 'Buy a listed voucher from the marketplace and its extracted code will appear here.'
          : 'Upload and sell a voucher to see it in this section.'}
      </p>
      <Button href={type === 'bought' ? '/marketplace' : '/upload'} variant="secondary" className="mt-6">
        {type === 'bought' ? 'Browse Marketplace' : 'Upload Voucher'}
      </Button>
    </Card>
  );
}

export default function MyVouchersPage() {
  const [walletAddress, setWalletAddress] = useState('');
  const [vouchers, setVouchers] = useState({ bought: [], sold: [] });
  const [activeTab, setActiveTab] = useState('bought');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [disputeLoadingId, setDisputeLoadingId] = useState('');
  const [notice, setNotice] = useState('');

  const activeTrades = useMemo(
    () => vouchers[activeTab] || [],
    [activeTab, vouchers]
  );

  async function loadVouchers() {
    const address = localStorage.getItem('xirecWalletAddress') || '';
    setWalletAddress(address);

    if (!address) {
      setLoading(false);
      return;
    }

    try {
      setError('');
      const response = await fetch(`${backendUrl}/api/vouchers/portfolio?walletAddress=${encodeURIComponent(address)}`);
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to load vouchers');
      }
      setVouchers({
        bought: data.bought || [],
        sold: data.sold || []
      });
    } catch (err) {
      setError(err.message || 'Failed to load vouchers');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadVouchers();
  }, []);

  async function handleRaiseDispute(trade) {
    if (!walletAddress || !trade?.listingId) {
      return;
    }

    const reason = window.prompt('Enter a dispute reason for this voucher:')?.trim() || '';
    if (!reason) {
      return;
    }

    const confirmed = window.confirm('This will cost 30 Xirec and reduce the seller reputation by 30. Continue?');
    if (!confirmed) {
      return;
    }

    try {
      setDisputeLoadingId(trade.listingId);
      setError('');
      setNotice('');

      const response = await fetch(`${backendUrl}/api/listings/${trade.listingId}/dispute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=utf-8'
        },
        body: JSON.stringify({
          walletAddress,
          reason
        })
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || 'Failed to raise dispute');
      }

      setNotice('Dispute raised successfully.');
      await loadVouchers();
    } catch (err) {
      setError(err.message || 'Failed to raise dispute');
    } finally {
      setDisputeLoadingId('');
    }
  }

  if (!walletAddress && !loading) {
    return (
      <main className="mx-auto max-w-5xl px-6 py-16">
        <Card className="py-16 text-center" hoverEffect={false}>
          <h1 className="text-3xl font-bold text-white">Connect your wallet</h1>
          <p className="mx-auto mt-3 max-w-md text-slate-400">
            Your bought and sold vouchers are tied to your wallet address.
          </p>
          <Button href="/login" className="mt-8">Connect Wallet</Button>
        </Card>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-7xl px-6 py-12">
      <div className="mb-10 flex flex-col justify-between gap-6 md:flex-row md:items-end">
        <div>
          <h1 className="text-4xl font-bold text-white">My Vouchers</h1>
          <p className="mt-2 text-lg text-slate-400">
            Track vouchers you bought and sold from this wallet.
          </p>
          {walletAddress && (
            <p className="mt-2 break-all font-mono text-xs text-slate-500">{walletAddress}</p>
          )}
        </div>

        <div className="flex rounded-full border border-slate-800 bg-slate-950/70 p-1">
          {[
            ['bought', `Bought (${vouchers.bought.length})`],
            ['sold', `Sold (${vouchers.sold.length})`]
          ].map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setActiveTab(key)}
              className={`rounded-full px-5 py-2 text-sm font-semibold transition-colors ${
                activeTab === key
                  ? 'bg-cyan-500 text-slate-950'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="mb-8 rounded-2xl border border-rose-500/20 bg-rose-500/10 p-4 text-rose-400">
          <p className="text-sm font-medium">{error}</p>
        </div>
      )}

      {notice && (
        <div className="mb-8 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-emerald-300">
          <p className="text-sm font-medium">{notice}</p>
        </div>
      )}

      {loading ? (
        <Card className="py-16 text-center" hoverEffect={false}>
          <p className="text-slate-400">Loading your vouchers...</p>
        </Card>
      ) : activeTrades.length === 0 ? (
        <EmptyState type={activeTab} />
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          {activeTrades.map((trade) => (
            <TradeCard
              key={`${activeTab}-${trade.listingId || trade.updatedAt}`}
              trade={trade}
              type={activeTab}
              onRaiseDispute={handleRaiseDispute}
              disputeLoading={disputeLoadingId === trade.listingId}
            />
          ))}
        </div>
      )}
    </main>
  );
}
