"use client";

const VALUE_PROPS = [
  {
    title: "Signal",
    body: "Live desk tape, leaderboard, and Outside Calls when you need off-desk X monitors.",
    accent: "text-cyan-300/90",
    border: "border-cyan-500/25 bg-cyan-950/20",
  },
  {
    title: "Track",
    body: "Log calls, watchlist CAs, Performance Lab, and caller profiles with verified ATH stats.",
    accent: "text-emerald-300/90",
    border: "border-emerald-500/25 bg-emerald-950/15",
  },
  {
    title: "Alert",
    body: "Personal rules fire to your bell inbox; Pro can mirror the same hit to Discord DMs.",
    accent: "text-amber-300/90",
    border: "border-amber-500/25 bg-amber-950/15",
  },
  {
    title: "Proof",
    body: "Public profiles, trophies, and desk rank — show your edge without spreadsheet exports.",
    accent: "text-sky-300/90",
    border: "border-sky-500/25 bg-sky-950/20",
  },
] as const;

export function MembershipValueProps() {
  return (
    <section
      className="mx-auto w-full max-w-3xl"
      aria-labelledby="membership-value-heading"
    >
      <h2
        id="membership-value-heading"
        className="text-center text-sm font-semibold tracking-tight text-zinc-100 sm:text-base"
      >
        The desk loop
      </h2>
      <p className="mx-auto mt-2 max-w-lg text-center text-xs leading-relaxed text-zinc-500 sm:text-sm">
        Basic covers the daily rhythm. Pro unlocks outside signal, full alerts, and unlimited submissions.
      </p>
      <ul className="mt-5 grid gap-3 sm:grid-cols-2">
        {VALUE_PROPS.map((item) => (
          <li
            key={item.title}
            className={`rounded-xl border px-4 py-3.5 ${item.border}`}
          >
            <p className={`text-[10px] font-bold uppercase tracking-[0.2em] ${item.accent}`}>
              {item.title}
            </p>
            <p className="mt-1.5 text-xs leading-relaxed text-zinc-400 sm:text-sm">{item.body}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
