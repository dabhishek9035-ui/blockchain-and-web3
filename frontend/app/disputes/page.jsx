"use client";

import { useEffect, useState } from 'react';
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
  return date.toLocaleString();
}

function DisputeCard({ dispute }) {
  const voucher = dispute.listing?.voucher || {};
  return (
    <Card className="flex h-full flex-col" hoverEffect={false}>
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Listing #{dispute.listingId || 'N/A'}</p>
          <h2 className="mt-1 text-2xl font-bold text-white">{voucher.provider || 'Disputed Voucher'}</h2>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider ${dispute.status === 'resolved' ? 'bg-emerald-500/10 text-emerald-300' : dispute.status === 'rejected' ? 'bg-rose-500/10 text-rose-300' : 'bg-amber-500/10 text-amber-300'}`}>
          {dispute.status || 'open'}
        </span>
      </div>

      <div className="mb-6 grid gap-3 md:grid-cols-2">
        <div className="rounded-2xl border border-slate-800 bg-slate-950/50 p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Buyer</p>
          <p className="mt-1 font-mono text-sm text-slate-200">{shortAddress(dispute.buyerWallet)}</p>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-950/50 p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Seller</p>
          <p className="mt-1 font-mono text-sm text-slate-200">{shortAddress(dispute.sellerWallet)}</p>
        </div>
      </div>

      <div className="mb-6 rounded-2xl border border-rose-500/20 bg-rose-500/10 p-4">
        <p className="text-xs font-medium uppercase tracking-wider text-rose-300">Fee + penalty</p>
        <p className="mt-1 text-2xl font-bold text-white">{dispute.disputeFeeXirec || 30} Xirec</p>
        <p className="text-sm text-slate-300">Buyer pays the dispute fee, seller loses 30 reputation.</p>
      </div>

      <div className="mb-6 space-y-3 rounded-2xl border border-slate-800 bg-slate-950/50 p-4">
        <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Reason</p>
        <p className="text-sm leading-relaxed text-slate-200">{dispute.reason || 'No reason provided.'}</p>
        {dispute.resolution && (
          <p className="text-xs text-slate-500">Resolution: {dispute.resolution}</p>
        )}
      </div>

      <div className="mt-auto space-y-3 border-t border-slate-800 pt-5 text-sm">
        <div className="flex justify-between gap-4">
          <span className="text-slate-500">Raised</span>
          <span className="text-slate-300">{formatDate(dispute.createdAt)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-slate-500">Updated</span>
          <span className="text-slate-300">{formatDate(dispute.updatedAt)}</span>
        </div>
      </div>
    </Card>
  );
}

export default function DisputesPage() {
  const [walletAddress, setWalletAddress] = useState('');
  const [disputes, setDisputes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadDisputes() {
      const address = localStorage.getItem('xirecWalletAddress') || '';
      setWalletAddress(address);

      try {
        setError('');
        const url = address
          ? `${backendUrl}/api/disputes?walletAddress=${encodeURIComponent(address)}`
          : `${backendUrl}/api/disputes`;
        const response = await fetch(url);
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to load disputes');
        }

        setDisputes(data.items || []);
      } catch (err) {
        setError(err.message || 'Failed to load disputes');
      } finally {
        setLoading(false);
      }
    }

    loadDisputes();
  }, []);

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-16 text-slate-50">
      <div className="mx-auto max-w-7xl">
        <div className="mb-10 flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-300">Dispute Ledger</p>
            <h1 className="mt-2 text-4xl font-bold text-white">Disputes</h1>
            <p className="mt-3 max-w-2xl text-slate-400">
              Track voucher disputes, buyer fees, seller reputation penalties, and resolution status in one place.
            </p>
            {walletAddress && (
              <p className="mt-2 break-all font-mono text-xs text-slate-500">Filtered by {walletAddress}</p>
            )}
          </div>

          <Button href="/vouchers" variant="secondary">View My Vouchers</Button>
        </div>

        {error && (
          <div className="mb-8 rounded-2xl border border-rose-500/20 bg-rose-500/10 p-4 text-rose-400">
            <p className="text-sm font-medium">{error}</p>
          </div>
        )}

        {loading ? (
          <Card className="py-16 text-center" hoverEffect={false}>
            <p className="text-slate-400">Loading disputes...</p>
          </Card>
        ) : disputes.length === 0 ? (
          <Card className="py-16 text-center" hoverEffect={false}>
            <h2 className="text-2xl font-semibold text-white">No disputes yet</h2>
            <p className="mx-auto mt-3 max-w-md text-slate-400">
              Purchased vouchers with disputes will appear here after the buyer raises one.
            </p>
            <Button href="/vouchers" className="mt-8">Open My Vouchers</Button>
          </Card>
        ) : (
          <div className="grid gap-6 xl:grid-cols-2">
            {disputes.map((dispute) => (
              <DisputeCard key={dispute.id || `${dispute.listingId}-${dispute.createdAt}`} dispute={dispute} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
