"use client";

import { useEffect, useState } from 'react';
import { formatUnits } from 'ethers';
import { getContractAddresses, getTokenContract } from '../../lib/contracts.js';
import { backendUrl } from '../../lib/api.js';
import Button from '../../components/Button';
import Card from '../../components/Card';

export default function DashboardPage() {
  const [walletAddress, setWalletAddress] = useState('');
  const [addresses] = useState(getContractAddresses());
  const [chainStatus, setChainStatus] = useState(null);
  const [tokenBalance, setTokenBalance] = useState('');
  const [loadingBalance, setLoadingBalance] = useState(false);

  useEffect(() => {
    setWalletAddress(localStorage.getItem('xirecWalletAddress') || 'Not connected yet');
    fetch(`${backendUrl}/api/chain/status`)
      .then((response) => response.json())
      .then((data) => setChainStatus(data))
      .catch(() => setChainStatus(null));
  }, []);

  async function readBalance() {
    try {
      if (!walletAddress || walletAddress === 'Not connected yet') {
        setTokenBalance('Wallet not connected');
        return;
      }
      setLoadingBalance(true);
      const contract = await getTokenContract();
      const balance = await contract.balanceOf(walletAddress);
      const formattedBalance = formatUnits(balance, 18);
      setTokenBalance(`${formattedBalance} XIREC`);
    } catch (error) {
      setTokenBalance(`Error: ${error.message || 'Unable to read balance'}`);
    } finally {
      setLoadingBalance(false);
    }
  }

  return (
    <main className="mx-auto max-w-7xl px-6 py-12">
      <div className="mb-10">
        <h1 className="text-4xl font-bold text-white">Dashboard</h1>
        <p className="mt-2 text-slate-400 text-lg">Manage your account, track balances, and view your activity.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Wallet Info */}
        <Card className="md:col-span-2">
          <div className="flex items-center justify-between border-b border-slate-800 pb-6 mb-6">
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Connected Account</p>
              <p className="mt-1 font-mono text-cyan-400 break-all">{walletAddress}</p>
            </div>
            <div className="h-12 w-12 rounded-xl bg-cyan-500/10 flex items-center justify-center text-cyan-400">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
              </svg>
            </div>
          </div>

          <div className="grid gap-8 sm:grid-cols-2">
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Token Balance</p>
              <div className="mt-2 flex items-center gap-4">
                <span className="text-3xl font-bold text-white">{tokenBalance || '0.00 XIREC'}</span>
                <Button 
                  variant="ghost" 
                  className="px-3 py-1.5 text-xs" 
                  onClick={readBalance}
                  loading={loadingBalance}
                >
                  Refresh
                </Button>
              </div>
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Reputation Score</p>
              <p className="mt-2 text-3xl font-bold text-emerald-400">98 / 100</p>
            </div>
          </div>
        </Card>

        {/* System Status */}
        <Card>
          <h3 className="text-lg font-semibold text-white mb-6">Network Status</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950/50 border border-slate-800">
              <span className="text-sm text-slate-400">Chain ID</span>
              <span className="text-sm font-mono text-white">11155111 (Sepolia)</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950/50 border border-slate-800">
              <span className="text-sm text-slate-400">Escrow Contract</span>
              <span className="text-sm text-emerald-400 font-medium">Active</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950/50 border border-slate-800">
              <span className="text-sm text-slate-400">RPC Connection</span>
              <span className={`text-sm font-medium ${chainStatus?.rpcConfigured ? 'text-emerald-400' : 'text-rose-400'}`}>
                {chainStatus?.rpcConfigured ? 'Connected' : 'Offline'}
              </span>
            </div>
          </div>
          <div className="mt-8 pt-6 border-t border-slate-800">
            <p className="text-xs text-slate-500 leading-relaxed">
              Make sure your MetaMask is connected to the Sepolia test network to interact with smart contracts.
            </p>
          </div>
        </Card>

        {/* Quick Actions */}
        <div className="md:col-span-3 grid gap-6 sm:grid-cols-3">
          {[
            { title: 'Upload Voucher', href: '/upload', icon: '📤', color: 'bg-blue-500/10 text-blue-400' },
            { title: 'Marketplace', href: '/marketplace', icon: '🛒', color: 'bg-purple-500/10 text-purple-400' },
            { title: 'Disputes', href: '/disputes', icon: '⚖️', color: 'bg-rose-500/10 text-rose-400' },
          ].map((action) => (
            <a key={action.title} href={action.href} className="group">
              <Card className="flex items-center gap-4 hover:border-cyan-500/50">
                <div className={`h-12 w-12 rounded-xl flex items-center justify-center text-2xl ${action.color}`}>
                  {action.icon}
                </div>
                <div>
                  <h4 className="font-semibold text-white group-hover:text-cyan-400 transition-colors">{action.title}</h4>
                  <p className="text-xs text-slate-500">Go to {action.title.toLowerCase()}</p>
                </div>
              </Card>
            </a>
          ))}
        </div>
      </div>
    </main>
  );
}