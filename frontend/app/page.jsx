import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="relative overflow-hidden pt-20">
      {/* Background Decorative Blurs */}
      <div className="absolute top-0 left-1/4 -z-10 h-96 w-96 rounded-full bg-cyan-500/20 blur-[128px]" />
      <div className="absolute bottom-0 right-1/4 -z-10 h-96 w-96 rounded-full bg-violet-600/20 blur-[128px]" />

      <section className="mx-auto flex max-w-7xl flex-col items-center px-6 py-24 text-center md:py-32">
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-1000">
          <p className="mb-6 inline-flex items-center rounded-full border border-cyan-500/30 bg-cyan-500/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-cyan-400">
            Next Generation Voucher Escrow
          </p>
          <h1 className="max-w-4xl text-5xl font-bold leading-tight tracking-tight text-white md:text-7xl lg:text-8xl">
            The Secure Way to <span className="text-gradient">Trade Vouchers</span>
          </h1>
          <p className="mx-auto mt-8 max-w-2xl text-lg text-slate-400 md:text-xl">
            A hybrid Web2 + Web3 marketplace with on-chain escrow, reputation tracking, and automated rewards. Trade with confidence.
          </p>
          <div className="mt-12 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link href="/login" className="btn-primary w-full sm:w-auto">
              Get Started
            </Link>
            <Link href="/marketplace" className="btn-secondary w-full sm:w-auto">
              Browse Marketplace
            </Link>
          </div>
        </div>

        {/* Stats / Proof */}
        <div className="mt-24 grid w-full grid-cols-2 gap-8 border-t border-slate-900 pt-16 md:grid-cols-4">
          {[
            { label: 'Active Users', value: '10K+' },
            { label: 'Total Volume', value: '₹50M+' },
            { label: 'Vouchers Traded', value: '25K+' },
            { label: 'Safety Rate', value: '99.9%' },
          ].map((stat) => (
            <div key={stat.label}>
              <p className="text-3xl font-bold text-white">{stat.value}</p>
              <p className="mt-1 text-sm text-slate-500 uppercase tracking-wider">{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features Section */}
      <section className="mx-auto max-w-7xl px-6 py-24">
        <div className="grid gap-8 md:grid-cols-3">
          {[
            {
              title: 'On-Chain Escrow',
              desc: 'Your funds are held safely in a smart contract until the voucher is confirmed.',
              icon: '🛡️'
            },
            {
              title: 'Reputation System',
              desc: 'Transparent seller ratings backed by on-chain transaction history.',
              icon: '⭐'
            },
            {
              title: 'Instant Rewards',
              desc: 'Earn XIREC tokens for successful trades and community contributions.',
              icon: '💎'
            }
          ].map((feature) => (
            <div key={feature.title} className="glass-card group hover:border-cyan-500/50 transition-colors">
              <div className="mb-4 text-4xl">{feature.icon}</div>
              <h3 className="text-xl font-semibold text-white group-hover:text-cyan-400 transition-colors">{feature.title}</h3>
              <p className="mt-2 text-slate-400">{feature.desc}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
