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
            Open-source voucher escrow project
          </p>
          <h1 className="max-w-4xl text-5xl font-bold leading-tight tracking-tight text-white md:text-7xl lg:text-8xl">
            A clean <span className="text-gradient">Web3 voucher workflow</span> for demos
          </h1>
          <p className="mx-auto mt-8 max-w-2xl text-lg text-slate-400 md:text-xl">
            Voucher escrow built on blockchain
          </p>
          <div className="mt-12 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link href="/login" className="btn-primary w-full sm:w-auto">
              Open App
            </Link>
            <Link href="/marketplace" className="btn-secondary w-full sm:w-auto">
              View Marketplace
            </Link>
          </div>
        </div>

        {/* Project snapshot */}
        <div className="mt-24 grid w-full grid-cols-1 gap-6 border-t border-slate-900 pt-16 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: 'Frontend', value: 'Next.js app' },
            { label: 'Workflow', value: 'Wallet to escrow' },
            { label: 'Network', value: 'Sepolia testnet' },
            { label: 'Scope', value: 'Demo project' },
          ].map((stat) => (
            <div key={stat.label} className="glass-card rounded-3xl p-5 text-left">
              <p className="text-sm uppercase tracking-[0.3em] text-slate-500">{stat.label}</p>
              <p className="mt-3 text-2xl font-semibold text-white">{stat.value}</p>
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
              desc: 'Voucher purchases are routed through a smart contract flow for transparent escrow handling.',
              icon: '🛡️'
            },
            {
              title: 'Reputation System',
              desc: 'Account reputation is displayed from recorded activity so the UI feels grounded in data.',
              icon: '⭐'
            },
            {
              title: 'Instant Rewards',
              desc: 'Game rewards and token balance screens demonstrate how the backend and contracts connect.',
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
