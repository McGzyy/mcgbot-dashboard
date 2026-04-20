"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { adminChrome } from "@/lib/roleTierStyles";

const NAV: {
  href: string;
  label: string;
  description: string;
  icon: (active: boolean) => ReactNode;
}[] = [
  {
    href: "/admin",
    label: "Overview",
    description: "Pulse & shortcuts",
    icon: (a) => (
      <svg className={`h-4 w-4 ${a ? adminChrome.navIconActive : "text-zinc-600"}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25A2.25 2.25 0 0113.5 8.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25z" />
      </svg>
    ),
  },
  {
    href: "/admin/subscription-exempt",
    label: "Subscription access",
    description: "Bypass list & env",
    icon: (a) => (
      <svg className={`h-4 w-4 ${a ? adminChrome.navIconActive : "text-zinc-600"}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
      </svg>
    ),
  },
  {
    href: "/admin/bot",
    label: "Bot controls",
    description: "Health & scanner",
    icon: (a) => (
      <svg className={`h-4 w-4 ${a ? adminChrome.navIconActive : "text-zinc-600"}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 7.5l3 2.25m0 0l3-2.25m-3 2.25v5.25m9-5.25a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    href: "/admin/site",
    label: "Site & flags",
    description: "Supabase app settings",
    icon: (a) => (
      <svg className={`h-4 w-4 ${a ? adminChrome.navIconActive : "text-zinc-600"}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.723 6.723 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.075-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
];

function navClass(active: boolean) {
  return [
    "group relative flex gap-3 rounded-xl border px-3 py-2.5 text-left transition-all duration-200",
    active ? adminChrome.navActive : "border-transparent bg-zinc-900/30 text-zinc-400 hover:border-zinc-700/80 hover:bg-zinc-900/50 hover:text-zinc-100",
  ].join(" ");
}

export function AdminDashboardShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "";

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-10 lg:flex-row lg:gap-12">
      <aside className="shrink-0 lg:w-60" aria-label="Admin sections">
        <div className="rounded-2xl border border-white/[0.07] bg-gradient-to-b from-zinc-900/90 via-zinc-950/80 to-black/60 p-2 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)]">
          <p className="px-2 pb-2 pt-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
            Control plane
          </p>
          <nav className="flex flex-col gap-0.5">
            {NAV.map((item) => {
              const active =
                item.href === "/admin"
                  ? pathname === "/admin"
                  : pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link key={item.href} href={item.href} className={navClass(active)}>
                  {active ? (
                    <span className={`absolute left-0 top-2 bottom-2 w-0.5 rounded-full ${adminChrome.navMarker}`} aria-hidden />
                  ) : null}
                  <span className="relative mt-0.5 shrink-0">{item.icon(active)}</span>
                  <span className="relative min-w-0">
                    <span className="block text-sm font-semibold tracking-tight">{item.label}</span>
                    <span className="mt-0.5 block text-[11px] leading-snug text-zinc-500 group-hover:text-zinc-400">
                      {item.description}
                    </span>
                  </span>
                </Link>
              );
            })}
          </nav>
        </div>
      </aside>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
