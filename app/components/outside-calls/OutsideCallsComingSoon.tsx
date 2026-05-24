import Link from "next/link";

const FEATURES = [
  {
    step: "01",
    title: "Signal",
    subtitle: "Live off-desk tape",
    accent: "border-cyan-500/35 bg-cyan-950/20 text-cyan-100",
    body: "A dedicated feed of Solana CAs from approved X monitors — not the main desk. One row per call, newest first, with the source and trust score on every line.",
  },
  {
    step: "02",
    title: "Track",
    subtitle: "Multiples & charts",
    accent: "border-zinc-700/80 bg-zinc-950/50 text-zinc-100",
    body: "Live and ATH multiples on each mint, quick Dex/chart links, and echo markers when a second monitor posts the same contract.",
  },
  {
    step: "03",
    title: "Proof",
    subtitle: "Monitors & trust",
    accent: "border-emerald-500/30 bg-emerald-950/15 text-emerald-100",
    body: "Suggest new handles for staff to review. After two moderators approve, ingestion runs on the server — and trust scores update from how those calls actually perform.",
  },
] as const;

export function OutsideCallsComingSoon() {
  return (
    <div className="relative mx-auto max-w-3xl px-4 pb-24 pt-10 sm:px-6">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(34,211,238,0.14),transparent_70%)]"
        aria-hidden
      />
      <div className="relative">
        <p className="text-center text-[10px] font-bold uppercase tracking-[0.28em] text-cyan-300/80">
          Pro · Off-desk lane
        </p>
        <h1 className="mt-3 text-center text-3xl font-semibold tracking-tight text-zinc-50 sm:text-4xl">
          Outside Calls
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-center text-sm leading-relaxed text-zinc-400">
          A second signal stream from curated X accounts — separate from McGBot desk calls. The workflow is{" "}
          <span className="text-zinc-300">signal → track → proof</span>: catch the CA, follow performance, and
          vet who gets on the monitor list. You&apos;re on Pro, so you&apos;re in when this lane goes live.
        </p>

        <div className="mx-auto mt-8 flex justify-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-950/25 px-4 py-1.5 text-xs font-semibold text-cyan-100">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400 opacity-40" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-cyan-400" />
            </span>
            Opening soon
          </span>
        </div>

        <ul className="mt-10 space-y-4">
          {FEATURES.map((f) => (
            <li key={f.step} className={`rounded-2xl border p-5 ${f.accent}`}>
              <div className="flex gap-4">
                <span className="font-mono text-[11px] font-bold tabular-nums text-zinc-500">{f.step}</span>
                <div>
                  <h2 className="text-base font-semibold text-zinc-50">{f.title}</h2>
                  <p className="mt-0.5 text-[11px] font-medium uppercase tracking-wide text-zinc-500">
                    {f.subtitle}
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-zinc-400">{f.body}</p>
                </div>
              </div>
            </li>
          ))}
        </ul>

        <div className="mt-10 rounded-2xl border border-zinc-800/80 bg-zinc-950/60 p-5 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">In the meantime</p>
          <p className="mt-2 text-sm leading-relaxed text-zinc-400">
            Desk calls, leaderboard, inbox alerts, and Trusted Pro are all still on your plan — nothing extra to
            buy while we bring this lane online.
          </p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/"
              className="inline-flex h-10 items-center justify-center rounded-xl border border-zinc-700 bg-zinc-900/80 px-4 text-sm font-semibold text-zinc-200 transition hover:border-zinc-600 hover:bg-zinc-800"
            >
              Back to desk
            </Link>
            <Link
              href="/leaderboard"
              className="inline-flex h-10 items-center justify-center rounded-xl border border-cyan-500/35 bg-cyan-950/30 px-4 text-sm font-semibold text-cyan-100 transition hover:border-cyan-400/50 hover:bg-cyan-900/35"
            >
              Leaderboard
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
