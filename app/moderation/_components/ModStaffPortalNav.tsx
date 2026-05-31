"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { modChrome } from "@/lib/roleTierStyles";

const LINKS = [
  { href: "/moderation", label: "Queue", match: (p: string) => p === "/moderation" },
  { href: "/moderation/activity", label: "Activity", match: (p: string) => p.startsWith("/moderation/activity") },
  { href: "/moderation/stats", label: "Stats", match: (p: string) => p.startsWith("/moderation/stats") },
  { href: "/moderation/earnings", label: "Earnings", match: (p: string) => p.startsWith("/moderation/earnings") },
  { href: "/moderation/agreement", label: "Agreement", match: (p: string) => p.startsWith("/moderation/agreement") },
  { href: "/moderation/handbook", label: "Handbook", match: (p: string) => p.startsWith("/moderation/handbook") },
] as const;

function linkClass(active: boolean) {
  return [
    "rounded-lg border px-3 py-2 text-sm font-semibold tracking-tight transition",
    active
      ? modChrome.navActive
      : "border-transparent bg-zinc-900/40 text-zinc-400 hover:border-zinc-700/80 hover:bg-zinc-900/60 hover:text-zinc-100",
  ].join(" ");
}

export function ModStaffPortalNav({
  agreementSigned,
}: {
  agreementSigned?: boolean | null;
}) {
  const pathname = usePathname() ?? "";

  return (
    <nav
      className="flex flex-wrap items-center gap-2"
      aria-label="Staff program"
    >
      {LINKS.map((item) => {
        const active = item.match(pathname);
        return (
          <Link key={item.href} href={item.href} className={linkClass(active)}>
            {item.label}
          </Link>
        );
      })}
      {agreementSigned === true ? (
        <span className="ml-1 inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-950/40 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-emerald-200/90">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.65)]" aria-hidden />
          Agreement current
        </span>
      ) : agreementSigned === false ? (
        <span className="ml-1 inline-flex items-center rounded-full border border-amber-500/35 bg-amber-950/30 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-amber-100/90">
          Signature required
        </span>
      ) : null}
    </nav>
  );
}
