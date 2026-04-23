import Link from "next/link";

const LINKS: { href: string; label: string }[] = [
  { href: "/", label: "Dashboard" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/watchlist", label: "Watchlist" },
  { href: "/settings", label: "Settings" },
  { href: "/referrals", label: "Referrals overview" },
];

export function HelpQuickLinksPanel() {
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-gradient-to-br from-zinc-900/85 via-zinc-950/75 to-black/55 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_28px_90px_-52px_rgba(0,0,0,0.85)] backdrop-blur-sm">
      <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-zinc-500">Navigate</p>
      <h2 className="mt-1.5 text-base font-semibold tracking-tight text-white">Quick links</h2>
      <p className="mt-1 text-xs leading-relaxed text-zinc-400">Jump to common destinations.</p>
      <ul className="mt-4 space-y-0.5">
        {LINKS.map((l) => (
          <li key={l.href}>
            <Link
              href={l.href}
              className="group flex items-center justify-between rounded-xl border border-transparent px-2.5 py-2 text-xs font-medium text-zinc-300 transition hover:border-white/[0.06] hover:bg-white/[0.03] hover:text-white"
            >
              <span>{l.label}</span>
              <span
                className="text-zinc-600 transition group-hover:text-[color:var(--accent)]"
                aria-hidden
              >
                →
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
