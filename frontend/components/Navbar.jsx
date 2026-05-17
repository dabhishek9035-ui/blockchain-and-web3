"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function Navbar() {
  const pathname = usePathname();
  const [walletAddress, setWalletAddress] = useState('');

  useEffect(() => {
    const address = localStorage.getItem('xirecWalletAddress');
    if (address) setWalletAddress(address);
  }, []);

  const navLinks = [
    { name: 'Marketplace', href: '/marketplace' },
    { name: 'My Vouchers', href: '/vouchers' },
    { name: 'Dashboard', href: '/dashboard' },
    { name: 'Upload', href: '/upload' },
    { name: 'Games', href: '/games' },
    { name: 'Leaderboard', href: '/leaderboard' },
  ];

  return (
    <nav className="glass-nav px-6 py-4">
      <div className="mx-auto flex max-w-7xl items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-cyan-400 to-violet-500 shadow-lg shadow-cyan-500/20" />
          <span className="text-xl font-bold tracking-tight text-white">XIREC</span>
        </Link>

        <div className="hidden items-center gap-8 md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`text-sm font-medium transition-colors hover:text-cyan-400 ${
                pathname === link.href ? 'text-cyan-400' : 'text-slate-300'
              }`}
            >
              {link.name}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-4">
          {walletAddress ? (
            <div className="flex items-center gap-2 rounded-full border border-slate-800 bg-slate-900/50 px-4 py-1.5 text-xs font-medium text-slate-300">
              <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
            </div>
          ) : (
            <Link href="/login" className="btn-primary py-1.5 px-5 text-xs">
              Connect Wallet
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
