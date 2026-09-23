export default function PageLoader() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 text-center px-4" aria-busy="true" aria-live="polite">
      <div className="relative w-14 h-14">
        {/* Outer pulse ring */}
        <div className="absolute inset-0 rounded-full border-2 border-emerald-500/20 animate-ping" />
        {/* Spinning gradient ring */}
        <div className="w-14 h-14 rounded-full border-2 border-transparent border-t-emerald-400 border-r-teal-400 animate-spin" />
        {/* Center glowing dot */}
        <div className="absolute inset-0 m-auto w-3 h-3 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.8)]" />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-semibold text-white tracking-wide">Loading Car Worth</p>
        <p className="text-xs text-slate-400 font-mono">Calibrating valuation view...</p>
      </div>
    </div>
  );
}
