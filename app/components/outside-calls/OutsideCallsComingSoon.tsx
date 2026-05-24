import Link from "next/link";
import {
  OUTSIDE_CALLS_COMING_SOON,
  OUTSIDE_CALLS_EYEBROW,
  OUTSIDE_CALLS_FEATURES,
  OUTSIDE_CALLS_WORKFLOW,
} from "@/lib/outsideCallsCopy";

export function OutsideCallsComingSoon() {
  return (
    <div className="relative mx-auto max-w-3xl px-4 pb-24 pt-10 sm:px-6">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(34,211,238,0.14),transparent_70%)]"
        aria-hidden
      />
      <div className="relative">
        <p className="text-center text-[10px] font-bold uppercase tracking-[0.28em] text-cyan-300/80">
          {OUTSIDE_CALLS_EYEBROW}
        </p>
        <h1 className="mt-3 text-center text-3xl font-semibold tracking-tight text-zinc-50 sm:text-4xl">
          {OUTSIDE_CALLS_COMING_SOON.headline}
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-center text-sm leading-relaxed text-zinc-400">
          {OUTSIDE_CALLS_COMING_SOON.introLead}{" "}
          <span className="text-zinc-300">{OUTSIDE_CALLS_WORKFLOW}</span>: {OUTSIDE_CALLS_COMING_SOON.introTrail}
        </p>

        <div className="mx-auto mt-8 flex justify-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-950/25 px-4 py-1.5 text-xs font-semibold text-cyan-100">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400 opacity-40" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-cyan-400" />
            </span>
            {OUTSIDE_CALLS_COMING_SOON.badge}
          </span>
        </div>

        <ul className="mt-10 space-y-4">
          {OUTSIDE_CALLS_FEATURES.map((f) => (
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
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
            {OUTSIDE_CALLS_COMING_SOON.footerTitle}
          </p>
          <p className="mt-2 text-sm leading-relaxed text-zinc-400">{OUTSIDE_CALLS_COMING_SOON.footerBody}</p>
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
