"use client";

const VALUE_PROPS = [
  {
    title: "Signal",
    body: "Live desk tape, leaderboard, and Outside Calls when you need off-desk X monitors.",
    accent: "text-cyan-300/90",
    border: "border-cyan-500/25 bg-cyan-950/20",
    chip: "border-cyan-500/30 bg-cyan-950/30 text-cyan-200/90",
  },
  {
    title: "Track",
    body: "Log calls, watchlist CAs, Performance Lab, and caller profiles with verified ATH stats.",
    accent: "text-emerald-300/90",
    border: "border-emerald-500/25 bg-emerald-950/15",
    chip: "border-emerald-500/30 bg-emerald-950/30 text-emerald-200/90",
  },
  {
    title: "Alert",
    body: "Personal rules fire to your bell inbox; Pro can mirror the same hit to Discord DMs.",
    accent: "text-amber-300/90",
    border: "border-amber-500/25 bg-amber-950/15",
    chip: "border-amber-500/30 bg-amber-950/30 text-amber-200/90",
  },
  {
    title: "Proof",
    body: "Public profiles, trophies, and desk rank — show your edge without spreadsheet exports.",
    accent: "text-sky-300/90",
    border: "border-sky-500/25 bg-sky-950/20",
    chip: "border-sky-500/30 bg-sky-950/30 text-sky-200/90",
  },
] as const;

function ValuePropCards() {
  return (
    <ul className="mt-4 grid gap-3 sm:mt-5 sm:grid-cols-2">
      {VALUE_PROPS.map((item) => (
        <li key={item.title} className={`rounded-xl border px-4 py-3.5 ${item.border}`}>
          <p className={`text-[10px] font-bold uppercase tracking-[0.2em] ${item.accent}`}>
            {item.title}
          </p>
          <p className="mt-1.5 text-xs leading-relaxed text-zinc-400 sm:text-sm">{item.body}</p>
        </li>
      ))}
    </ul>
  );
}

export function MembershipValueProps() {
  return (
    <section className="mx-auto w-full max-w-3xl">
      {/* Mobile: compact chips + collapsible detail */}
      <details className="group md:hidden">
        <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden">
          <div className="flex items-center justify-between gap-2 rounded-xl border border-zinc-800/70 bg-zinc-950/40 px-3 py-2.5">
            <span>
              <span
                id="membership-value-heading-mobile"
                className="text-xs font-semibold tracking-tight text-zinc-100"
              >
                Why McGBot — the desk loop
              </span>
              <span className="mt-1.5 flex flex-wrap gap-1.5">
                {VALUE_PROPS.map((item) => (
                  <span
                    key={item.title}
                    className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${item.chip}`}
                  >
                    {item.title}
                  </span>
                ))}
              </span>
            </span>
            <span
              className="shrink-0 text-[10px] font-medium uppercase tracking-wider text-zinc-500 group-open:hidden"
              aria-hidden
            >
              Expand
            </span>
            <span
              className="hidden shrink-0 text-[10px] font-medium uppercase tracking-wider text-zinc-500 group-open:inline"
              aria-hidden
            >
              Collapse
            </span>
          </div>
        </summary>
        <ValuePropCards />
      </details>

    </section>
  );
}
