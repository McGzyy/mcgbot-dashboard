"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { adminChrome } from "@/lib/roleTierStyles";
import { terminalSurface } from "@/lib/terminalDesignTokens";

type NavItem = {
  href: string;
  label: string;
  description: string;
  icon: (active: boolean) => ReactNode;
};

type NavGroup = { id: string; label: string; items: NavItem[] };

const NAV_GROUPS: NavGroup[] = [
  {
    id: "overview",
    label: "Overview",
    items: [
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
    ],
  },
  {
    id: "ops",
    label: "Ops",
    items: [
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
        href: "/admin/copy-trade",
        label: "Copy trade",
        description: "Queue, wallets, failures, access",
        icon: (a) => (
          <svg className={`h-4 w-4 ${a ? adminChrome.navIconActive : "text-zinc-600"}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 14.25h9m-9-4.5h9M6 20.25h12a1.5 1.5 0 001.5-1.5V6.75A1.5 1.5 0 0018 5.25H6A1.5 1.5 0 004.5 6.75v12A1.5 1.5 0 006 20.25z" />
          </svg>
        ),
      },
      {
        href: "/admin/site",
        label: "Site & flags",
        description: "Maintenance, paywall, Stripe test",
        icon: (a) => (
          <svg className={`h-4 w-4 ${a ? adminChrome.navIconActive : "text-zinc-600"}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.723 6.723 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.075-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        ),
      },
      {
        href: "/admin/treasury",
        label: "Treasury",
        description: "Balances, revenue, activity",
        icon: (a) => (
          <svg className={`h-4 w-4 ${a ? adminChrome.navIconActive : "text-zinc-600"}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75a.75.75 0 01-.75.75H3.75a.75.75 0 01-.75-.75V6h15zm-18 10.5v.75a.75.75 0 00.75.75h18a.75.75 0 00.75-.75v-.75M6 10.5h.008v.008H6V10.5zm0 3h.008v.008H6V13.5zm3-3h.008v.008H9V10.5zm0 3h.008v.008H9V13.5zm3-3h.008v.008H12V10.5zm0 3h.008v.008H12V13.5zm3-3h.008v.008H15V10.5zm0 3h.008v.008H15V13.5z" />
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
    ],
  },
  {
    id: "moderation",
    label: "Moderation",
    items: [
      {
        href: "/admin/call-visibility",
        label: "Call visibility",
        description: "Hide/show on public web",
        icon: (a) => (
          <svg className={`h-4 w-4 ${a ? adminChrome.navIconActive : "text-zinc-600"}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L12 12" />
          </svg>
        ),
      },
      {
        href: "/admin/voice-moderation-audit",
        label: "Voice audit",
        description: "Mute/kick log",
        icon: (a) => (
          <svg className={`h-4 w-4 ${a ? adminChrome.navIconActive : "text-zinc-600"}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m12 0a3 3 0 00-3-3h-.75m-6 0a3 3 0 003-3h.75" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
          </svg>
        ),
      },
      {
        href: "/admin/social-feed",
        label: "Social feed",
        description: "Source approvals",
        icon: (a) => (
          <svg className={`h-4 w-4 ${a ? adminChrome.navIconActive : "text-zinc-600"}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3.75h9m-9 3.75h6" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3.75h10.5A2.25 2.25 0 0119.5 6v12a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 18V6a2.25 2.25 0 012.25-2.25z" />
          </svg>
        ),
      },
    ],
  },
  {
    id: "tools",
    label: "Tools",
    items: [
      {
        href: "/admin/ca-analyze",
        label: "CA analyzer",
        description: "Auto-call filter dry-run",
        icon: (a) => (
          <svg className={`h-4 w-4 ${a ? adminChrome.navIconActive : "text-zinc-600"}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M4.5 19.125h15a1.125 1.125 0 001.125-1.125V5.125a1.125 1.125 0 00-1.125-1.125h-15a1.125 1.125 0 00-1.125 1.125v12.875a1.125 1.125 0 001.125 1.125z" />
          </svg>
        ),
      },
      {
        href: "/admin/vouchers",
        label: "Vouchers",
        description: "Discount codes",
        icon: (a) => (
          <svg className={`h-4 w-4 ${a ? adminChrome.navIconActive : "text-zinc-600"}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 8.25h6M9 12h6M9 15.75h6" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 3.75h9A2.25 2.25 0 0118.75 6v12A2.25 2.25 0 0116.5 20.25h-9A2.25 2.25 0 015.25 18V6A2.25 2.25 0 017.5 3.75z" />
          </svg>
        ),
      },
      {
        href: "/admin/subscription-plans",
        label: "Subscription plans",
        description: "Pricing & durations",
        icon: (a) => (
          <svg className={`h-4 w-4 ${a ? adminChrome.navIconActive : "text-zinc-600"}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 3.75h9A2.25 2.25 0 0118.75 6v12A2.25 2.25 0 0116.5 20.25h-9A2.25 2.25 0 015.25 18V6A2.25 2.25 0 017.5 3.75z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 8.25h6M9 12h6M9 15.75h6" />
          </svg>
        ),
      },
    ],
  },
  {
    id: "feedback",
    label: "Feedback",
    items: [
      {
        href: "/admin/bugs",
        label: "Bug reports",
        description: "Triage & close",
        icon: (a) => (
          <svg className={`h-4 w-4 ${a ? adminChrome.navIconActive : "text-zinc-600"}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 12h.01M8 12h.01M16 12h.01" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 3.75h6A2.25 2.25 0 0117.25 6v1.25H6.75V6A2.25 2.25 0 019 3.75z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 7.25h10.5v8.5A3.25 3.25 0 0114 19H10a3.25 3.25 0 01-3.25-3.25v-8.5z" />
          </svg>
        ),
      },
      {
        href: "/admin/feature-requests",
        label: "Feature requests",
        description: "Ideas & triage",
        icon: (a) => (
          <svg className={`h-4 w-4 ${a ? adminChrome.navIconActive : "text-zinc-600"}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 18v-5.25m0 0a6 6 0 110-12 6 6 0 010 12z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v3m0 12v3M3 12h3m12 0h3" />
          </svg>
        ),
      },
      {
        href: "/admin/fix-it-tickets",
        label: "Fix-it tickets (beta)",
        description: "Tester UI / idea inbox",
        icon: (a) => (
          <svg className={`h-4 w-4 ${a ? adminChrome.navIconActive : "text-zinc-600"}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655-5.653a2.548 2.548 0 010-3.286L11.42 15.17z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        ),
      },
    ],
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
  const [q, setQ] = useState("");

  const groups = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return NAV_GROUPS;
    return NAV_GROUPS.map((g) => {
      const items = g.items.filter((it) => {
        const hay = `${it.label} ${it.description} ${it.href}`.toLowerCase();
        return hay.includes(query);
      });
      return { ...g, items };
    }).filter((g) => g.items.length > 0);
  }, [q]);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-10 lg:flex-row lg:gap-12">
      <aside className="shrink-0 lg:w-72 lg:sticky lg:top-24 lg:self-start" aria-label="Admin sections">
        <div
          className={`rounded-2xl p-2 ${terminalSurface.panelCardElevated} ${terminalSurface.insetEdge}`}
        >
          <p className="px-2 pb-2 pt-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
            Control plane
          </p>

          <div className="px-2 pb-2">
            <label className="block text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-600">
              Search
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Treasury, flags, voucher…"
                className="mt-1 w-full rounded-lg border border-zinc-800 bg-black/30 px-2.5 py-2 text-xs font-medium text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-zinc-600"
              />
            </label>
          </div>

          <nav className="flex flex-col gap-3">
            {groups.map((group) => (
              <div key={group.id}>
                <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-600">
                  {group.label}
                </p>
                <div className="flex flex-col gap-0.5">
                  {group.items.map((item) => {
                    const active =
                      item.href === "/admin"
                        ? pathname === "/admin"
                        : pathname === item.href || pathname.startsWith(`${item.href}/`);
                    return (
                      <Link key={item.href} href={item.href} className={navClass(active)}>
                        {active ? (
                          <span
                            className={`absolute bottom-2 left-0 top-2 w-0.5 rounded-full ${adminChrome.navMarker}`}
                            aria-hidden
                          />
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
                </div>
              </div>
            ))}
          </nav>
        </div>
      </aside>
      <div className="min-w-0 flex-1">
        <div className="mb-6 flex items-center gap-2 text-[11px] text-zinc-500">
          <Link href="/admin" className="font-semibold text-zinc-300 hover:text-white">
            Admin
          </Link>
          <span aria-hidden>→</span>
          <span className="truncate">
            {(() => {
              for (const g of NAV_GROUPS) {
                for (const it of g.items) {
                  const active =
                    it.href === "/admin"
                      ? pathname === "/admin"
                      : pathname === it.href || pathname.startsWith(`${it.href}/`);
                  if (active) return it.label;
                }
              }
              return "Overview";
            })()}
          </span>
        </div>
        {children}
      </div>
    </div>
  );
}
