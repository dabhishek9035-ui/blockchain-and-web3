export default function Footer() {
  return (
    <footer className="border-t border-slate-900 bg-slate-950/50 py-12">
      <div className="mx-auto max-w-7xl px-6">
        <div className="grid gap-8 md:grid-cols-4">
          <div className="col-span-2">
            <div className="flex items-center gap-2">
              <div className="h-6 w-6 rounded-md bg-gradient-to-br from-cyan-400 to-violet-500" />
              <span className="text-lg font-bold tracking-tight text-white">XIREC Project</span>
            </div>
            <p className="mt-4 max-w-xs text-sm text-slate-400">
              Open-source voucher escrow UI with wallet, marketplace, and reward flows.
            </p>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-white">Platform</h4>
            <ul className="mt-4 space-y-2 text-sm text-slate-400">
              <li><a href="/marketplace" className="hover:text-cyan-400">Marketplace</a></li>
              <li><a href="/games" className="hover:text-cyan-400">Games</a></li>
              <li><a href="/disputes" className="hover:text-cyan-400">Disputes</a></li>
            </ul>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-white">Project</h4>
            <ul className="mt-4 space-y-2 text-sm text-slate-400">
              <li><a href="/dashboard" className="hover:text-cyan-400">Dashboard</a></li>
              <li><a href="/upload" className="hover:text-cyan-400">Upload Flow</a></li>
              <li><a href="/leaderboard" className="hover:text-cyan-400">Leaderboard</a></li>
            </ul>
          </div>
        </div>
        <div className="mt-12 border-t border-slate-900 pt-8 text-center text-xs text-slate-500">
          <p>© {new Date().getFullYear()} XIREC Project. Built for demonstration and source sharing.</p>
        </div>
      </div>
    </footer>
  );
}
