"use client";

import { modChrome } from "@/lib/roleTierStyles";
import { useEffect, useState, type ReactNode } from "react";

const NAV: {
  id: string;
  label: string;
  description: string;
  icon: (active: boolean) => ReactNode;
}[] = [
  {
    id: "mod-live-queue",
    label: "Live snapshot",
    description: "Counts & bot link",
    icon: (a) => (
      <svg className={`h-4 w-4 ${a ? modChrome.navIconActive : "text-zinc-600"}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3" />
      </svg>
    ),
  },
  {
    id: "mod-call-suspensions",
    label: "Call suspensions",
    description: "Timed call bans",
    icon: (a) => (
      <svg className={`h-4 w-4 ${a ? modChrome.navIconActive : "text-zinc-600"}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 00-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
      </svg>
    ),
  },
  {
    id: "mod-calls",
    label: "Call approvals",
    description: "McGBot X gate",
    icon: (a) => (
      <svg className={`h-4 w-4 ${a ? modChrome.navIconActive : "text-zinc-600"}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    id: "mod-dev",
    label: "Dev queue",
    description: "Intel submissions",
    icon: (a) => (
      <svg className={`h-4 w-4 ${a ? modChrome.navIconActive : "text-zinc-600"}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
      </svg>
    ),
  },
  {
    id: "mod-tp-submissions",
    label: "Trusted Pro posts",
    description: "Staff review queue",
    icon: (a) => (
      <svg className={`h-4 w-4 ${a ? modChrome.navIconActive : "text-zinc-600"}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
      </svg>
    ),
  },
  {
    id: "mod-tp-apps",
    label: "Trusted Pro apps",
    description: "Program applications",
    icon: (a) => (
      <svg className={`h-4 w-4 ${a ? modChrome.navIconActive : "text-zinc-600"}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 9h3.75M15 12h3.75M15 15h3.75M4.5 19.5h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
      </svg>
    ),
  },
  {
    id: "mod-reports",
    label: "Reports",
    description: "Profiles & calls",
    icon: (a) => (
      <svg className={`h-4 w-4 ${a ? modChrome.navIconActive : "text-zinc-600"}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
      </svg>
    ),
  },
];

function navClass(active: boolean) {
  return [
    "group relative flex gap-3 rounded-xl border px-3 py-3.5 text-left transition-all duration-200",
    active
      ? modChrome.navActive
      : "border-transparent bg-zinc-900/30 text-zinc-400 hover:border-zinc-700/80 hover:bg-zinc-900/50 hover:text-zinc-100",
  ].join(" ");
}

export function ModerationDashboardShell({ children }: { children: ReactNode }) {
  const [hash, setHash] = useState("");

  useEffect(() => {
    const read = () => {
      setHash(typeof window !== "undefined" ? window.location.hash.replace(/^#/, "") : "");
    };
    read();
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, []);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-12 lg:flex-row lg:gap-16">
      <aside className="shrink-0 lg:w-64" aria-label="Moderation sections">
        <div className="rounded-2xl border border-zinc-800/80 bg-gradient-to-b from-zinc-900/90 via-zinc-950/80 to-black/60 p-3 shadow-[inset_0_1px_0_0_rgba(63,63,70,0.3)]">
          <p className="px-2 pb-3 pt-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-500">Review queue</p>
          <nav className="flex flex-col gap-1.5">
            {NAV.map((item) => {
              const active = hash === item.id;
              return (
                <a key={item.id} href={`#${item.id}`} className={navClass(active)}>
                  {active ? (
                    <span className={`absolute left-0 top-2 bottom-2 w-0.5 rounded-full ${modChrome.navMarker}`} aria-hidden />
                  ) : null}
                  <span className="relative mt-0.5 shrink-0">{item.icon(active)}</span>
                  <span className="relative min-w-0">
                    <span className="block text-sm font-semibold tracking-tight">{item.label}</span>
                    <span className="mt-0.5 block text-[11px] leading-snug text-zinc-500 group-hover:text-zinc-400">
                      {item.description}
                    </span>
                  </span>
                </a>
              );
            })}
          </nav>
        </div>
      </aside>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
