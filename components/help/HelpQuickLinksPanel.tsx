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
    <div className="rounded-xl border border-[#1a1a1a] bg-[#0a0a0a] p-4 shadow-sm shadow-black/20">
      <h2 className="text-sm font-semibold text-zinc-100">Help — Quick links</h2>
      <p className="mt-0.5 text-xs text-zinc-500">Jump to common destinations.</p>
      <ul className="mt-3 space-y-1">
        {LINKS.map((l) => (
          <li key={l.href}>
            <Link
              href={l.href}
              className="block rounded-md px-2 py-1.5 text-xs font-medium text-zinc-300 transition hover:bg-zinc-900/50 hover:text-[color:var(--accent)]"
            >
              {l.label}
              <span className="ml-1 text-zinc-600" aria-hidden>
                →
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
