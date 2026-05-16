"use client";

import Link from "next/link";

const LINKS = [
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/calls", label: "Call log" },
  { href: "/outside-calls", label: "Outside" },
  { href: "/watchlist", label: "Watchlist" },
  { href: "/profile", label: "Profile" },
] as const;

/** Compact desk shortcuts — common on pro terminals (one-click to key views). */
export function QuickDeskNav({
  onSubmitCall,
}: {
  onSubmitCall?: () => void;
}) {
  return (
    <nav
      className="flex min-w-0 flex-wrap items-center gap-1.5"
      aria-label="Desk shortcuts"
      data-tutorial="dashboard.quickDeskNav"
    >
      {onSubmitCall ? (
        <button
          type="button"
          onClick={onSubmitCall}
          className="rounded-lg border border-[color:var(--accent)]/35 bg-[color:var(--accent)]/12 px-2.5 py-1 text-[11px] font-semibold text-[color:var(--accent)] transition hover:bg-[color:var(--accent)]/20"
        >
          Submit call
        </button>
      ) : null}
      {LINKS.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          className="rounded-lg border border-zinc-800/80 bg-zinc-950/50 px-2.5 py-1 text-[11px] font-semibold text-zinc-400 transition hover:border-zinc-600 hover:text-zinc-100"
        >
          {l.label}
        </Link>
      ))}
    </nav>
  );
}
