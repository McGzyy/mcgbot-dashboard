"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/affiliate/dashboard", label: "Dashboard" },
  { href: "/affiliate/campaigns", label: "Campaigns" },
  { href: "/affiliate/earnings", label: "Earnings" },
  { href: "/affiliate/resources", label: "Resources" },
  { href: "/affiliate/tickets", label: "Support" },
  { href: "/affiliate/settings", label: "Settings" },
] as const;

export function AffiliatePartnerHubNav() {
  const pathname = usePathname();

  return (
    <nav
      className="sticky top-0 z-30 flex flex-wrap gap-1 border-b border-zinc-200/90 bg-white/95 px-4 py-2.5 shadow-sm backdrop-blur sm:px-6"
      aria-label="Affiliate hub"
    >
      {links.map((link) => {
        const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={
              active
                ? "rounded-lg bg-violet-600 px-3 py-2 text-xs font-semibold text-white shadow-sm"
                : "rounded-lg px-3 py-2 text-xs font-semibold text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
            }
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
