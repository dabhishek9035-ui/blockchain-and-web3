"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { connectWallet } from '../../lib/wallet.js';
import { postJson } from '../../lib/api.js';
import Button from '../../components/Button';
import Card from '../../components/Card';

export default function LoginPage() {
  const router = useRouter();
  const [walletAddress, setWalletAddress] = useState('');
  const [status, setStatus] = useState('Connect MetaMask to start.');
  const [loading, setLoading] = useState(false);

  async function handleConnect() {
    try {
      setLoading(true);
      setStatus('Requesting wallet connection...');
      const address = await connectWallet();
      if (!address) {
        throw new Error('No wallet address returned from MetaMask');
      }

      setWalletAddress(address);
      setStatus('Requesting login nonce from backend...');
      const challenge = await postJson('/api/auth/nonce', { walletAddress: address });

      setStatus('Please sign the login message in MetaMask...');
      const signature = await window.ethereum.request({
        method: 'personal_sign',
        params: [challenge.message, address]
      });

      await postJson('/api/auth/verify', {
        walletAddress: address,
        signature,
        nonce: challenge.nonce
      });

      localStorage.setItem('xirecWalletAddress', address);
      setStatus('Wallet login successful.');
      
      setTimeout(() => {
        router.push('/dashboard');
      }, 500);
    } catch (error) {
      setStatus(error.message || 'Login failed.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-[80vh] flex items-center justify-center px-6 py-16">
      <div className="absolute top-0 left-1/2 -z-10 h-[500px] w-[500px] -translate-x-1/2 rounded-full bg-cyan-500/10 blur-[100px]" />
      
      <Card className="max-w-md w-full text-center" hoverEffect={false}>
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-400 to-violet-500 shadow-lg shadow-cyan-500/20">
          <svg className="h-8 w-8 text-slate-950" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        
        <h1 className="text-3xl font-bold text-white">Sign In</h1>
        <p className="mt-3 text-slate-400">
          Connect your wallet to access your secure Xirec dashboard and start trading.
        </p>

        <div className="mt-8 space-y-4">
          <Button
            className="w-full"
            onClick={handleConnect}
            loading={loading}
          >
            {walletAddress ? 'Signing In...' : 'Connect MetaMask'}
          </Button>
          
          <div className="rounded-xl bg-slate-950/50 p-4 text-xs">
            <p className={`font-medium ${status.includes('failed') ? 'text-rose-400' : 'text-cyan-400'}`}>
              Status: {status}
            </p>
            {walletAddress && (
              <p className="mt-1 text-slate-500 truncate">
                Wallet: {walletAddress}
              </p>
            )}
          </div>
        </div>

        <p className="mt-8 text-xs text-slate-500 leading-relaxed">
          By connecting your wallet, you agree to our <br />
          <a href="#" className="text-slate-400 hover:text-cyan-400 underline underline-offset-4">Terms of Service</a> and <a href="#" className="text-slate-400 hover:text-cyan-400 underline underline-offset-4">Privacy Policy</a>.
        </p>
      </Card>
    </main>
  );
}