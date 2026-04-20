"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const NAV: { href: string; label: string; description: string }[] = [
  { href: "/admin", label: "Overview", description: "Summary & shortcuts" },
  {
    href: "/admin/subscription-exempt",
    label: "Subscription access",
    description: "Bypass list & env IDs",
  },
  { href: "/admin/bot", label: "Bot", description: "Scanner, alerts, Discord" },
  { href: "/admin/site", label: "Dashboard app", description: "UI, gates, feature flags" },
];

function navClass(active: boolean) {
  return [
    "block rounded-lg border px-3 py-2.5 text-left transition",
    active
      ? "border-violet-500/40 bg-violet-950/30 text-white shadow-[0_0_12px_rgba(139,92,246,0.12)]"
      : "border-transparent bg-zinc-900/40 text-zinc-400 hover:border-zinc-700 hover:text-zinc-100",
  ].join(" ");
}

export function AdminDashboardShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "";

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-8 lg:flex-row lg:gap-10">
      <aside className="shrink-0 lg:w-56" aria-label="Admin sections">
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
          Admin dashboard
        </p>
        <nav className="flex flex-col gap-1">
          {NAV.map((item) => {
            const active =
              item.href === "/admin"
                ? pathname === "/admin"
                : pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link key={item.href} href={item.href} className={navClass(active)}>
                <span className="block text-sm font-medium">{item.label}</span>
                <span className="mt-0.5 block text-[11px] leading-snug text-zinc-500">{item.description}</span>
              </Link>
            );
          })}
        </nav>
      </aside>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
