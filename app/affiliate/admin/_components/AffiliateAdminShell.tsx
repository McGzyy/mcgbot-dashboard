"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { AffiliatePortalLogo } from "@/app/components/AffiliatePortalLogo";
import { AFFILIATE_PORTAL_BUILD_ID } from "@/lib/affiliate/affiliatePortalBuild";

type NavItem = { href: string; label: string; description: string };

const NAV: NavItem[] = [
  { href: "/affiliate/admin", label: "Overview", description: "Health & shortcuts" },
  { href: "/affiliate/admin/partners", label: "Affiliates", description: "Approve, suspend, create" },
  { href: "/affiliate/admin/payouts", label: "Payouts", description: "Withdrawal requests" },
  { href: "/affiliate/admin/slug-requests", label: "Slug requests", description: "Vanity link changes" },
  { href: "/affiliate/admin/commissions", label: "Commissions", description: "Ledger & voids" },
  { href: "/affiliate/admin/milestones", label: "Milestones", description: "Approve 25 & 50 bonuses" },
];

function navClass(active: boolean) {
  return [
    "group relative flex gap-3 rounded-xl border px-3 py-2.5 text-left transition-all duration-200",
    active
      ? "border-violet-300/90 bg-white shadow-sm shadow-violet-900/5"
      : "border-transparent bg-white/40 text-zinc-600 hover:border-zinc-200 hover:bg-white hover:text-zinc-900",
  ].join(" ");
}

export function AffiliateAdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "";
  const [q, setQ] = useState("");

  const items = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return NAV;
    return NAV.filter((it) => {
      const hay = `${it.label} ${it.description} ${it.href}`.toLowerCase();
      return hay.includes(query);
    });
  }, [q]);

  return (
    <div className="relative space-y-10 pb-16 pt-8 sm:pt-10">
      <div
        className="pointer-events-none absolute -left-6 -top-6 h-48 w-48 rounded-full bg-violet-400/25 blur-3xl"
        aria-hidden
      />
      <header className="relative border-b border-zinc-200/90 pb-8">
        <AffiliatePortalLogo href="/affiliate/admin" subtitle="Ops console" className="mb-4" />
        <h1 className="mt-2 bg-gradient-to-r from-zinc-900 via-zinc-800 to-zinc-600 bg-clip-text text-3xl font-bold tracking-tight text-transparent">
          Affiliate control plane
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-600">
          Separate from the McGBot terminal: approve affiliate applications, set commission rates, and inspect cash
          commissions. Members never see this surface.
        </p>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-10 lg:flex-row lg:gap-12">
        <aside
          className="shrink-0 lg:w-72 lg:sticky lg:top-8 lg:self-start lg:max-h-[calc(100dvh-4rem)]"
          aria-label="Affiliate ops sections"
        >
          <div className="max-h-[calc(100dvh-4rem)] overflow-y-auto overscroll-contain rounded-2xl border border-zinc-200/90 bg-white/80 p-2 shadow-sm shadow-zinc-900/5 backdrop-blur-sm">
            <p className="px-2 pb-2 pt-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
              Sections
            </p>
            <div className="px-2 pb-2">
              <label className="block text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                Search
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Affiliates, commissions…"
                  className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-2.5 py-2 text-xs font-medium text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-violet-400"
                />
              </label>
            </div>
            <nav className="flex flex-col gap-0.5">
              {items.map((item) => {
                const active =
                  item.href === "/affiliate/admin"
                    ? pathname === "/affiliate/admin"
                    : pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <Link key={item.href} href={item.href} className={navClass(active)}>
                    {active ? (
                      <span
                        className="absolute bottom-2 left-0 top-2 w-0.5 rounded-full bg-violet-600"
                        aria-hidden
                      />
                    ) : null}
                    <span className="relative min-w-0 pl-0.5">
                      <span className="block text-sm font-semibold tracking-tight text-zinc-900">{item.label}</span>
                      <span className="mt-0.5 block text-[11px] leading-snug text-zinc-500 group-hover:text-zinc-600">
                        {item.description}
                      </span>
                    </span>
                  </Link>
                );
              })}
            </nav>
            <div className="mt-3 border-t border-zinc-200/80 px-2 pt-3">
              <Link
                href="/admin"
                className="block rounded-lg px-2 py-2 text-xs font-semibold text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
              >
                ← McGBot Terminal admin
              </Link>
            </div>
          </div>
        </aside>
        <div className="min-w-0 flex-1">
          <div className="mb-6 flex items-center gap-2 text-[11px] text-zinc-500">
            <Link href="/affiliate/admin" className="font-semibold text-violet-700 hover:text-violet-900">
              Affiliate ops
            </Link>
            <span aria-hidden>→</span>
            <span className="truncate text-zinc-600">
              {(() => {
                for (const it of NAV) {
                  const active =
                    it.href === "/affiliate/admin"
                      ? pathname === "/affiliate/admin"
                      : pathname === it.href || pathname.startsWith(`${it.href}/`);
                  if (active) return it.label;
                }
                return "Overview";
              })()}
            </span>
          </div>
          {children}
          <p className="mt-8 text-center font-mono text-[10px] text-zinc-400" title="Deploy verification">
            ops build {AFFILIATE_PORTAL_BUILD_ID}
          </p>
        </div>
      </div>
    </div>
  );
}
