export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Left – branding panel */}
      <div className="hidden lg:flex flex-col justify-between bg-zinc-950 p-12 text-white">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-blue-500 flex items-center justify-center font-bold text-sm">
            MA
          </div>
          <span className="font-semibold text-lg tracking-tight">MarketerAgents</span>
        </div>

        <blockquote className="space-y-4">
          <p className="text-2xl font-medium leading-snug text-zinc-100">
            "We cut 12 hours of weekly ad management down to 30 minutes. The ROAS lift paid for a year's subscription in the first month."
          </p>
          <footer className="text-zinc-400 text-sm">
            — Head of Performance, London DTC Agency
          </footer>
        </blockquote>

        <div className="flex gap-8 text-zinc-400 text-sm">
          <div>
            <div className="text-white font-semibold text-2xl">$2.4M+</div>
            <div>Ad Spend Optimized</div>
          </div>
          <div>
            <div className="text-white font-semibold text-2xl">3.8×</div>
            <div>Avg. ROAS Lift</div>
          </div>
          <div>
            <div className="text-white font-semibold text-2xl">14h</div>
            <div>Saved Per Week</div>
          </div>
        </div>
      </div>

      {/* Right – form panel */}
      <div className="flex items-center justify-center p-8">
        <div className="w-full max-w-sm">{children}</div>
      </div>
    </div>
  )
}
