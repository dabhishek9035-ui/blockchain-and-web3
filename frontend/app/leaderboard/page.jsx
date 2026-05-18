"use client";

import { useEffect, useState } from 'react';
import { BrowserProvider, Contract, formatUnits } from 'ethers';
import { backendUrl } from '../../lib/api.js';
import { getContractAddresses, REPUTATION_MANAGER_ABI, XIREC_TOKEN_ABI } from '../../lib/contracts.js';

function shortAddress(address) {
  if (!address) return 'Unknown wallet';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function formatXirec(value) {
  const numericValue = Number(value || 0);
  return Number.isFinite(numericValue) ? numericValue.toFixed(2) : '0.00';
}

function asNumber(value) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : 0;
}

export default function LeaderboardPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const visibleItems = items.slice(0, 25);

  useEffect(() => {
    async function loadLeaderboard() {
      try {
        const response = await fetch(`${backendUrl}/api/leaderboard`);
        const data = await response.json();

        const leaderboardItems = data.items || [];
        const { token, reputation } = getContractAddresses();

        if (typeof window !== 'undefined' && window.ethereum && (token || reputation)) {
          const provider = new BrowserProvider(window.ethereum);
          const tokenContract = token ? new Contract(token, XIREC_TOKEN_ABI, provider) : null;
          const reputationContract = reputation ? new Contract(reputation, REPUTATION_MANAGER_ABI, provider) : null;

          const resolvedItems = await Promise.all(
            leaderboardItems.map(async (item) => {
              const nextItem = { ...item };

              if (tokenContract) {
                try {
                  const balance = await tokenContract.balanceOf(item.walletAddress);
                  nextItem.xirecBalance = Number(formatUnits(balance, 18));
                } catch {
                  // Keep the backend mirror if the chain call fails.
                }
              }

              if (reputationContract) {
                try {
                  const reputationScore = await reputationContract.getReputation(item.walletAddress);
                  nextItem.reputationScore = Number(reputationScore.toString());
                } catch {
                  if (nextItem.reputationScore == null) {
                    nextItem.reputationScore = 50;
                  }
                }
              } else if (nextItem.reputationScore == null) {
                nextItem.reputationScore = 50;
              }

              return nextItem;
            })
          );

          resolvedItems.sort((a, b) => {
            const balanceDelta = asNumber(b.xirecBalance) - asNumber(a.xirecBalance);
            if (balanceDelta !== 0) return balanceDelta;

            const reputationDelta = asNumber(b.reputationScore) - asNumber(a.reputationScore);
            if (reputationDelta !== 0) return reputationDelta;

            return asNumber(a.rank) - asNumber(b.rank);
          });

          setItems(resolvedItems);
        } else {
          setItems(
            leaderboardItems.map((item) => ({
              ...item,
              reputationScore: item.reputationScore ?? 50
            }))
          );
        }
      } catch (err) {
        setError(err.message || 'Failed to load leaderboard');
      } finally {
        setLoading(false);
      }
    }

    loadLeaderboard();
  }, []);

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.15),_transparent_35%),linear-gradient(180deg,#020617_0%,#0f172a_100%)] px-6 py-16 text-slate-50">
      <div className="mx-auto max-w-6xl">
        <div className="mb-10 flex flex-col gap-4 border-b border-white/10 pb-8 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-300">Xirec Ranking</p>
            <h1 className="mt-3 text-4xl font-bold tracking-tight md:text-5xl">Leaderboard</h1>
            <p className="mt-3 max-w-2xl text-slate-300">
              Accounts are ranked by token balance, with reputation derived from recorded game activity.
            </p>
          </div>
          <div className="rounded-2xl border border-cyan-400/20 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-200">
            Top {visibleItems.length} accounts
          </div>
        </div>

        {error && (
          <div className="mb-6 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-rose-200">
            {error}
          </div>
        )}

        {loading ? (
          <div className="grid gap-4 md:grid-cols-3">
            {[...Array(6)].map((_, index) => (
              <div key={index} className="h-28 animate-pulse rounded-3xl border border-white/10 bg-white/5" />
            ))}
          </div>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-3">
              {visibleItems.slice(0, 3).map((item) => (
                <article key={item.walletAddress} className="rounded-3xl border border-cyan-400/20 bg-slate-900/80 p-6 shadow-2xl shadow-cyan-950/30 backdrop-blur">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.25em] text-cyan-300">Rank #{item.rank}</p>
                      <h2 className="mt-2 break-all text-lg font-semibold text-white">{item.username || 'Anonymous account'}</h2>
                      {!item.username && <p className="mt-1 font-mono text-xs text-slate-400">{shortAddress(item.walletAddress)}</p>}
                    </div>
                    <div className={`rounded-full px-3 py-1 text-xs font-medium ${Number(item.xirecBalance) < 0 ? 'bg-rose-500/10 text-rose-200' : 'bg-cyan-400/10 text-cyan-200'}`}>
                      {formatXirec(item.xirecBalance)} Xirec
                    </div>
                  </div>
                  <p className="mt-5 break-all font-mono text-sm text-slate-400">{item.walletAddress}</p>
                  <div className="mt-4 flex items-center justify-between text-sm text-slate-400">
                    <span>Reputation</span>
                    <span className="font-semibold text-emerald-300">{item.reputationScore}</span>
                  </div>
                </article>
              ))}
            </div>

            <div className="mt-8 overflow-hidden rounded-3xl border border-white/10 bg-slate-900/70 backdrop-blur">
              <div className="border-b border-white/10 px-6 py-4">
                <h2 className="text-lg font-semibold text-white">Top Holders</h2>
                <p className="mt-1 text-sm text-slate-400">Sorted by actual Xirec balance, then reputation score.</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px]">
                  <thead>
                    <tr className="border-b border-white/10 text-left text-xs uppercase tracking-[0.2em] text-slate-500">
                      <th className="px-6 py-4">Rank</th>
                      <th className="px-6 py-4">Account</th>
                      <th className="px-6 py-4">Wallet</th>
                      <th className="px-6 py-4">Xirec</th>
                      <th className="px-6 py-4">Reputation</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleItems.map((item) => (
                      <tr key={item.walletAddress} className="border-b border-white/5 last:border-b-0 hover:bg-white/5">
                        <td className="px-6 py-4 text-sm font-semibold text-cyan-300">#{item.rank}</td>
                        <td className="px-6 py-4">
                          <div className="text-sm font-medium text-white">{item.username || 'Anonymous account'}</div>
                          {!item.username && <div className="font-mono text-xs text-slate-500">{shortAddress(item.walletAddress)}</div>}
                          <div className="text-xs text-slate-500">Joined {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : 'recently'}</div>
                        </td>
                        <td className="px-6 py-4 font-mono text-sm text-slate-400">{item.walletAddress}</td>
                        <td className="px-6 py-4 text-sm font-semibold text-white">{formatXirec(item.xirecBalance)}</td>
                        <td className="px-6 py-4 text-sm text-emerald-300">{item.reputationScore}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
