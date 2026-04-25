"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import {
  dashboardChrome,
  normalizeStaffRole,
  tierNavBarClass,
  tierStatusDotClass,
  type StaffRoleLabel,
} from "@/lib/roleTierStyles";
import { useMobileSidebar } from "@/app/contexts/MobileSidebarContext";
import { userProfileHref } from "@/lib/userProfileHref";

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function sessionStaffNav(session: ReturnType<typeof useSession>["data"]): boolean {
  const u = session?.user;
  if (!u) return false;
  if (u.canModerate === true) return true;
  return u.helpTier === "admin" || u.helpTier === "mod";
}

function sessionAdminNav(session: ReturnType<typeof useSession>["data"]): boolean {
  return session?.user?.helpTier === "admin";
}

type SidebarBodyProps = {
  pathname: string;
  profileId: string;
  profileName: string;
  profileInitials: string;
  viewerTier: StaffRoleLabel;
  staffNav: boolean;
  adminNav: boolean;
  modPendingTotal: number | null;
  getNavItemClass: (active: boolean) => string;
  onNavigate?: () => void;
};

function SidebarBody({
  pathname,
  profileId,
  profileName,
  profileInitials,
  viewerTier,
  staffNav,
  adminNav,
  modPendingTotal,
  getNavItemClass,
  onNavigate,
}: SidebarBodyProps) {
  const pick = onNavigate
    ? () => {
        onNavigate();
      }
    : undefined;

  return (
    <>
      <div className="border-b border-zinc-800 px-4 py-4">
        <Link
          href="/"
          onClick={pick}
          data-tutorial="sidebar.logo"
          className="group flex items-center gap-3 rounded-xl p-1 transition-colors hover:bg-white/[0.03]"
          aria-label="Go to dashboard"
        >
          <div className="relative h-14 w-14 bg-transparent">
            <Image
              src="/brand/mcgbot-logo-v2.png"
              alt="McGBot"
              fill
              sizes="56px"
              priority
              className="object-contain"
            />
          </div>
          <div className="min-w-0">
            <div className="truncate text-[15px] font-semibold leading-tight tracking-[-0.01em] text-zinc-50">
              McGBot
            </div>
            <div className="mt-0.5 flex items-center gap-2">
              <span className="text-[11px] font-medium uppercase tracking-[0.22em] text-zinc-500">
                Terminal
              </span>
              <span className="h-1 w-1 rounded-full bg-sky-400/75 shadow-[0_0_6px_rgba(56,189,248,0.45)]" aria-hidden />
            </div>
          </div>
        </Link>
      </div>

      <nav className="flex flex-1 flex-col" aria-label="Main">
        <div className="mt-4 flex flex-col gap-1 px-2">
          <Link href="/" onClick={pick} data-tutorial="sidebar.nav.dashboard" className={getNavItemClass(isActive(pathname, "/"))}>
            <div
              className={`absolute left-0 top-1/2 h-5 w-[2px] -translate-y-1/2 rounded ${
                isActive(pathname, "/") ? `${tierNavBarClass("user")} opacity-100` : "opacity-0"
              }`}
            />
            <span>Dashboard</span>
          </Link>

          <p className="mt-5 px-4 text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-600">You</p>
          <Link href="/calls" onClick={pick} data-tutorial="sidebar.nav.calls" className={getNavItemClass(isActive(pathname, "/calls"))}>
            <div
              className={`absolute left-0 top-1/2 h-5 w-[2px] -translate-y-1/2 rounded ${
                isActive(pathname, "/calls") ? `${tierNavBarClass("user")} opacity-100` : "opacity-0"
              }`}
            />
            <span>Call log</span>
          </Link>
          <Link href="/performance" onClick={pick} data-tutorial="sidebar.nav.performance" className={getNavItemClass(isActive(pathname, "/performance"))}>
            <div
              className={`absolute left-0 top-1/2 h-5 w-[2px] -translate-y-1/2 rounded ${
                isActive(pathname, "/performance") ? `${tierNavBarClass("user")} opacity-100` : "opacity-0"
              }`}
            />
            <span>Performance lab</span>
          </Link>
          <Link href="/watchlist" onClick={pick} data-tutorial="sidebar.nav.watchlist" className={getNavItemClass(isActive(pathname, "/watchlist"))}>
            <div
              className={`absolute left-0 top-1/2 h-5 w-[2px] -translate-y-1/2 rounded ${
                isActive(pathname, "/watchlist") ? `${tierNavBarClass("user")} opacity-100` : "opacity-0"
              }`}
            />
            <span>Watchlist</span>
          </Link>
          <Link href="/referrals" onClick={pick} data-tutorial="sidebar.nav.referrals" className={getNavItemClass(isActive(pathname, "/referrals"))}>
            <div
              className={`absolute left-0 top-1/2 h-5 w-[2px] -translate-y-1/2 rounded ${
                isActive(pathname, "/referrals") ? `${tierNavBarClass("user")} opacity-100` : "opacity-0"
              }`}
            />
            <span>Referrals</span>
          </Link>

          <p className="mt-5 px-4 text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-600">
            The Lounge
          </p>
          <Link
            href="/lounge/discord-chats"
            onClick={pick}
            data-tutorial="sidebar.nav.loungeDiscordChats"
            className={getNavItemClass(isActive(pathname, "/lounge/discord-chats"))}
          >
            <div
              className={`absolute left-0 top-1/2 h-5 w-[2px] -translate-y-1/2 rounded ${
                isActive(pathname, "/lounge/discord-chats")
                  ? `${tierNavBarClass("user")} opacity-100`
                  : "opacity-0"
              }`}
            />
            <span>Discord chats</span>
          </Link>
          <Link
            href="/lounge/voice-chats"
            onClick={pick}
            data-tutorial="sidebar.nav.loungeVoiceChats"
            className={getNavItemClass(isActive(pathname, "/lounge/voice-chats"))}
          >
            <div
              className={`absolute left-0 top-1/2 h-5 w-[2px] -translate-y-1/2 rounded ${
                isActive(pathname, "/lounge/voice-chats")
                  ? `${tierNavBarClass("user")} opacity-100`
                  : "opacity-0"
              }`}
            />
            <span>Voice chats</span>
          </Link>

          <p className="mt-5 px-4 text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-600">Arena</p>
          <Link href="/bot-calls" onClick={pick} data-tutorial="sidebar.nav.botCalls" className={getNavItemClass(isActive(pathname, "/bot-calls"))}>
            <div
              className={`absolute left-0 top-1/2 h-5 w-[2px] -translate-y-1/2 rounded ${
                isActive(pathname, "/bot-calls") ? `${tierNavBarClass("user")} opacity-100` : "opacity-0"
              }`}
            />
            <span>Bot calls</span>
          </Link>
          <Link href="/trusted-pro" onClick={pick} data-tutorial="sidebar.nav.trustedPro" className={getNavItemClass(isActive(pathname, "/trusted-pro"))}>
            <div
              className={`absolute left-0 top-1/2 h-5 w-[2px] -translate-y-1/2 rounded ${
                isActive(pathname, "/trusted-pro") ? `${tierNavBarClass("user")} opacity-100` : "opacity-0"
              }`}
            />
            <span>Trusted Pro</span>
          </Link>
          <Link href="/leaderboard" onClick={pick} data-tutorial="sidebar.nav.leaderboard" className={getNavItemClass(isActive(pathname, "/leaderboard"))}>
            <div
              className={`absolute left-0 top-1/2 h-5 w-[2px] -translate-y-1/2 rounded ${
                isActive(pathname, "/leaderboard") ? `${tierNavBarClass("user")} opacity-100` : "opacity-0"
              }`}
            />
            <span>Leaderboards</span>
          </Link>
          <Link
            href="/pnl-showcase"
            onClick={pick}
            data-tutorial="sidebar.nav.pnlShowcase"
            className={getNavItemClass(isActive(pathname, "/pnl-showcase"))}
          >
            <div
              className={`absolute left-0 top-1/2 h-5 w-[2px] -translate-y-1/2 rounded ${
                isActive(pathname, "/pnl-showcase") ? `${tierNavBarClass("user")} opacity-100` : "opacity-0"
              }`}
            />
            <span>PnL Showcase</span>
          </Link>

          {staffNav || adminNav ? (
            <>
              <p className="mt-5 px-4 text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-600">
                Staff
              </p>
              {staffNav ? (
                <Link
                  href="/moderation"
                  onClick={pick}
                  data-tutorial="sidebar.nav.moderation"
                  className={getNavItemClass(isActive(pathname, "/moderation"))}
                >
                  <div
                    className={`absolute left-0 top-1/2 h-5 w-[2px] -translate-y-1/2 rounded ${
                      isActive(pathname, "/moderation") ? `${tierNavBarClass("mod")} opacity-100` : "opacity-0"
                    }`}
                  />
                  <span className="flex min-w-0 flex-1 items-center justify-between gap-2">
                    <span className="truncate">Moderation</span>
                    {modPendingTotal != null && modPendingTotal > 0 ? (
                      <span className="shrink-0 rounded-full bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-emerald-200 ring-1 ring-emerald-500/30">
                        {modPendingTotal > 99 ? "99+" : modPendingTotal}
                      </span>
                    ) : null}
                  </span>
                </Link>
              ) : null}

              {adminNav ? (
                <Link href="/admin" onClick={pick} data-tutorial="sidebar.nav.admin" className={getNavItemClass(isActive(pathname, "/admin"))}>
                  <div
                    className={`absolute left-0 top-1/2 h-5 w-[2px] -translate-y-1/2 rounded ${
                      isActive(pathname, "/admin") ? `${tierNavBarClass("admin")} opacity-100` : "opacity-0"
                    }`}
                  />
                  <span>Admin</span>
                </Link>
              ) : null}
            </>
          ) : null}
        </div>
      </nav>

      <div className="mt-auto border-t border-zinc-800 p-3">
        <Link
          href={
            profileId
              ? userProfileHref({
                  discordId: profileId,
                  displayName: profileName,
                })
              : "/"
          }
          onClick={pick}
          className="flex cursor-pointer items-center gap-3 rounded-md p-2 transition hover:bg-zinc-900"
        >
          <div className="relative flex h-9 w-9 items-center justify-center rounded-full bg-zinc-700 text-xs">
            {profileInitials}
            <div className={`absolute bottom-0 right-0 h-2 w-2 rounded-full ${tierStatusDotClass(viewerTier)}`} />
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm text-white">{profileName}</div>
            <div className="truncate text-xs text-zinc-500">View profile</div>
          </div>
        </Link>
      </div>
    </>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const { open, setOpen } = useMobileSidebar();
  /** Client refresh of `/api/me/help-role` (merged with server session from layout). */
  const [apiStaffNav, setApiStaffNav] = useState(false);
  const [apiAdminNav, setApiAdminNav] = useState(false);
  const [apiRole, setApiRole] = useState<string | null>(null);
  /** Pending mod-queue count (from API); null = not loaded or not staff. */
  const [modPendingTotal, setModPendingTotal] = useState<number | null>(null);

  const profileId = session?.user?.id?.trim() || "";
  const profileName =
    session?.user?.name?.trim() ||
    session?.user?.email?.trim() ||
    (profileId ? `User ${profileId.slice(0, 4)}…${profileId.slice(-4)}` : "Profile");
  const profileInitials =
    profileName
      .trim()
      .replace(/[^a-z0-9]/gi, "")
      .slice(0, 2)
      .toUpperCase() || "MC";

  useEffect(() => {
    if (status !== "authenticated") {
      setApiStaffNav(false);
      setApiAdminNav(false);
      setApiRole(null);
      setModPendingTotal(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/me/help-role", { credentials: "same-origin" });
        const json = (await res.json().catch(() => ({}))) as {
          role?: string;
          canModerate?: boolean;
        };
        if (cancelled) return;
        if (!res.ok) {
          setApiAdminNav(false);
          setApiStaffNav(false);
          setApiRole(null);
          return;
        }
        const r = json.role;
        setApiRole(typeof r === "string" ? r : null);
        setApiAdminNav(r === "admin");
        const staff =
          typeof json.canModerate === "boolean"
            ? json.canModerate
            : r === "mod" || r === "admin";
        setApiStaffNav(staff);
      } catch {
        if (!cancelled) {
          setApiStaffNav(false);
          setApiAdminNav(false);
          setApiRole(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [status]);

  const staffNav = sessionStaffNav(session) || apiStaffNav;
  const adminNav = sessionAdminNav(session) || apiAdminNav;

  const sessionTier = (session?.user as { helpTier?: string } | undefined)?.helpTier;
  const viewerTier = normalizeStaffRole(apiRole ?? sessionTier ?? "user");

  useEffect(() => {
    if (status !== "authenticated" || !staffNav) {
      setModPendingTotal(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const q = await fetch("/api/mod/queue?limit=1", { credentials: "same-origin" });
        const qj = (await q.json().catch(() => ({}))) as {
          success?: boolean;
          counts?: { total?: number };
        };
        if (cancelled) return;
        if (qj.success && qj.counts && typeof qj.counts.total === "number") {
          setModPendingTotal(qj.counts.total);
        } else {
          setModPendingTotal(null);
        }
      } catch {
        if (!cancelled) setModPendingTotal(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [status, staffNav]);

  useEffect(() => {
    setOpen(false);
  }, [pathname, setOpen]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, setOpen]);

  const getNavItemClass = (active: boolean) =>
    `relative flex items-center gap-3 px-4 py-2 rounded-md text-sm transition-all duration-150 hover:bg-zinc-900/60 ${
      active
        ? "bg-zinc-800 text-white border border-zinc-700 shadow-[0_0_10px_rgba(56,189,248,0.12)]"
        : "text-zinc-400 hover:text-white hover:bg-zinc-900"
    }`;

  const bodyProps: SidebarBodyProps = {
    pathname,
    profileId,
    profileName,
    profileInitials,
    viewerTier,
    staffNav,
    adminNav,
    modPendingTotal,
    getNavItemClass,
  };

  return (
    <>
      <aside
        className={`relative z-30 sticky top-0 hidden h-screen w-64 shrink-0 flex-col bg-gradient-to-b from-black via-zinc-950 to-black lg:flex ${dashboardChrome.sidebar}`}
      >
        <SidebarBody {...bodyProps} />
      </aside>

      {open ? (
        <div
          className="fixed inset-0 z-[80] flex lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Site navigation"
        >
          <button
            type="button"
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
          />
          <aside
            className={`relative z-[1] flex h-full w-[min(18rem,88vw)] shrink-0 flex-col border-r border-zinc-800/65 bg-gradient-to-b from-black via-zinc-950 to-black shadow-[24px_0_48px_-12px_rgba(0,0,0,0.85)] ${dashboardChrome.sidebar}`}
          >
            <div className="flex items-center justify-end px-2 py-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md p-2 text-zinc-400 transition hover:bg-zinc-900 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/40"
                aria-label="Close navigation"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5" aria-hidden>
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
              <SidebarBody {...bodyProps} onNavigate={() => setOpen(false)} />
            </div>
          </aside>
        </div>
      ) : null}
    </>
  );
}
