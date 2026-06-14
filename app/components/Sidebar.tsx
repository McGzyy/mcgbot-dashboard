"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { useCallback, useEffect, useState } from "react";
import {
  dashboardChrome,
  normalizeStaffRole,
  tierNavBarClass,
  tierStatusDotClass,
  type StaffRoleLabel,
} from "@/lib/roleTierStyles";
import { useMobileSidebar } from "@/app/contexts/MobileSidebarContext";
import { userProfileHref } from "@/lib/userProfileHref";
import { FixItTicketLauncher } from "@/app/components/FixItTicketLauncher";
import { ModStaffResignBanner } from "@/app/moderation/_components/ModStaffResignBanner";
import { ProBadge } from "@/app/components/subscription/ProBadge";
import {
  applyDashDiscordMarkReadPayload,
  getDashDiscordLastRead,
  setDashDiscordLastRead,
} from "@/lib/discordDashboardChatRead";
import { formatSidebarNavAthAvg } from "@/lib/sidebarNavFeedStats";

type SidebarNavFeedStats = {
  botCalls: number | null;
  trustedPro: number | null;
  outsideCalls: number | null;
  myCallLog: number | null;
};

function SidebarNavAthBadge({
  avgX,
  pending,
}: {
  avgX: number | null | undefined;
  pending?: boolean;
}) {
  const text = pending ? "—" : formatSidebarNavAthAvg(avgX);
  const hasValue = !pending && avgX != null && Number.isFinite(avgX) && avgX > 0;

  return (
    <span
      className={`ml-auto shrink-0 text-[10px] tabular-nums ${
        hasValue ? "text-zinc-500" : "text-zinc-600"
      }`}
      title="Rolling 24h avg ATH"
    >
      {text}
    </span>
  );
}

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function sessionStaffNav(session: ReturnType<typeof useSession>["data"]): boolean {
  const u = session?.user;
  if (!u) return false;
  /** Must match server `meetsModerationMinTier` (e.g. `MODERATION_MIN_TIER=admin` → mods must not see broken desks). */
  return u.canModerate === true;
}

function sessionAdminNav(session: ReturnType<typeof useSession>["data"]): boolean {
  return session?.user?.helpTier === "admin";
}

/** Admin/mod roles only (JWT or `/api/me/help-role`); not the same as `canModerate`. */
function copyTradeNavStaff(session: ReturnType<typeof useSession>["data"], apiRole: string | null): boolean {
  const t = session?.user?.helpTier;
  if (t === "admin" || t === "mod") return true;
  if (apiRole === "admin" || apiRole === "mod") return true;
  return false;
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
  discordGeneralUnread: number;
  discordModUnread: number;
  onDiscordChatsNavClick?: () => void;
  getNavItemClass: (active: boolean) => string;
  onNavigate?: () => void;
  /** When true, Copy trade nav is non-interactive with a “coming soon” badge (staff never locked). */
  copyTradeNavLocked: boolean;
  hasProFeatures: boolean;
  navFeedStats: SidebarNavFeedStats | null;
  navFeedStatsPending: boolean;
  /** Mobile slide-out drawer: tighter header and roomier nav taps. */
  mobileDrawer?: boolean;
  onCloseDrawer?: () => void;
};

function isCallsNavPath(pathname: string): boolean {
  return (
    isActive(pathname, "/bot-calls") ||
    isActive(pathname, "/trusted-pro") ||
    isActive(pathname, "/outside-calls") ||
    isActive(pathname, "/hodl")
  );
}

function SidebarBody({
  pathname,
  profileId,
  profileName,
  profileInitials,
  viewerTier,
  staffNav,
  adminNav,
  modPendingTotal,
  discordGeneralUnread,
  discordModUnread,
  onDiscordChatsNavClick,
  getNavItemClass,
  onNavigate,
  copyTradeNavLocked,
  hasProFeatures,
  navFeedStats,
  navFeedStatsPending,
  mobileDrawer = false,
  onCloseDrawer,
}: SidebarBodyProps) {
  const pick = onNavigate
    ? () => {
        onNavigate();
      }
    : undefined;

  const [callsNavOpen, setCallsNavOpen] = useState(() => isCallsNavPath(pathname));
  useEffect(() => {
    if (isCallsNavPath(pathname)) setCallsNavOpen(true);
  }, [pathname]);

  const getSubNavItemClass = (active: boolean) =>
    `relative flex w-full items-center justify-between gap-2 rounded-md ${
      mobileDrawer ? "py-2 pl-3 pr-3 text-[13px]" : "py-1.5 pl-3 pr-3 text-[13px]"
    } transition-all duration-150 hover:bg-zinc-900/55 ${
      active
        ? "bg-zinc-800/90 text-white border border-zinc-700/80 shadow-[0_0_8px_rgba(56,189,248,0.1)]"
        : "text-zinc-400 hover:text-zinc-100"
    }`;

  const callsGroupActive = isCallsNavPath(pathname);
  const navSectionClass = mobileDrawer
    ? "mt-3 px-4 text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-600"
    : "mt-5 px-4 text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-600";
  const navStackClass = mobileDrawer
    ? "mt-2 flex flex-col gap-1.5 px-2"
    : "mt-4 flex flex-col gap-1 px-2";

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div
        className={`shrink-0 border-b border-zinc-800 ${
          mobileDrawer ? "px-3 py-2 pt-[max(0.5rem,env(safe-area-inset-top))]" : "px-4 py-3"
        }`}
      >
        <div className={`flex items-center gap-2 ${mobileDrawer ? "justify-between" : ""}`}>
          <Link
            href="/"
            onClick={pick}
            data-tutorial="sidebar.logo"
            className={`group flex min-w-0 flex-1 items-center rounded-xl transition-colors hover:bg-white/[0.03] ${
              mobileDrawer ? "px-0.5 py-0.5" : "px-1 py-1"
            }`}
            aria-label="McGBot Terminal — go to dashboard"
          >
            <Image
              src="/brand/mcgbot-terminal-logo.png"
              alt="McGBot Terminal"
              width={472}
              height={147}
              priority
              quality={100}
              sizes="(max-width: 1024px) 480px, 560px"
              className={`w-auto max-w-full object-contain object-left ${
                mobileDrawer ? "h-9 sm:h-10" : "h-12 sm:h-14"
              }`}
            />
          </Link>
          {mobileDrawer && onCloseDrawer ? (
            <button
              type="button"
              onClick={onCloseDrawer}
              className="shrink-0 rounded-md p-2 text-zinc-400 transition hover:bg-zinc-900 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/40"
              aria-label="Close navigation"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5" aria-hidden>
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          ) : null}
        </div>
      </div>

      <nav
        className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain no-scrollbar"
        aria-label="Main"
      >
        <div className={navStackClass}>
          <Link href="/" onClick={pick} data-tutorial="sidebar.nav.dashboard" className={getNavItemClass(isActive(pathname, "/"))}>
            <div
              className={`absolute left-0 top-1/2 h-5 w-[2px] -translate-y-1/2 rounded ${
                isActive(pathname, "/") ? `${tierNavBarClass("user")} opacity-100` : "opacity-0"
              }`}
            />
            <span>Dashboard</span>
          </Link>

          <p className={navSectionClass}>Markets</p>
          <div className="flex flex-col gap-0.5">
            <button
              type="button"
              id="sidebar-call-feeds-toggle"
              onClick={() => setCallsNavOpen((o) => !o)}
              aria-expanded={callsNavOpen}
              aria-controls="sidebar-call-feeds-submenu"
              aria-label="Call Feeds menu"
              className={`flex w-full items-center justify-between gap-2 rounded-md px-4 py-2 text-left text-sm transition hover:bg-zinc-900/60 ${
                callsGroupActive
                  ? "border border-zinc-700/70 bg-zinc-900/50 text-zinc-100"
                  : "text-zinc-400 hover:text-zinc-100"
              }`}
            >
              <span className="font-medium">Call Feeds</span>
              <span
                className={`flex h-5 w-5 shrink-0 items-center justify-center transition-colors ${
                  callsGroupActive ? "text-zinc-400" : "text-zinc-500"
                }`}
                aria-hidden
              >
                <svg
                  viewBox="0 0 20 20"
                  fill="none"
                  className={`h-3.5 w-3.5 transition-transform duration-200 ease-out ${
                    callsNavOpen ? "rotate-90" : "rotate-0"
                  }`}
                  stroke="currentColor"
                  strokeWidth="2.25"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M7.5 5.5 12.5 10 7.5 14.5" />
                </svg>
              </span>
            </button>
            {callsNavOpen ? (
              <div
                id="sidebar-call-feeds-submenu"
                role="group"
                aria-label="Call Feeds"
                className="ml-2 flex flex-col gap-0.5 border-l border-zinc-800/70 pl-2"
              >
                <Link
                  href="/bot-calls"
                  onClick={pick}
                  data-tutorial="sidebar.nav.botCalls"
                  className={getSubNavItemClass(isActive(pathname, "/bot-calls"))}
                >
                  <div
                    className={`absolute left-0 top-1/2 h-4 w-[2px] -translate-y-1/2 rounded ${
                      isActive(pathname, "/bot-calls") ? `${tierNavBarClass("user")} opacity-100` : "opacity-0"
                    }`}
                    aria-hidden
                  />
                  <span className="flex min-w-0 flex-1 items-center justify-between gap-2">
                    <span
                      className={
                        isActive(pathname, "/bot-calls")
                          ? "min-w-0 truncate"
                          : "min-w-0 truncate text-zinc-300 [text-shadow:0_0_12px_rgba(56,189,248,0.45),0_0_24px_rgba(56,189,248,0.28)]"
                      }
                    >
                      Bot Calls
                    </span>
                    <SidebarNavAthBadge
                      avgX={navFeedStats?.botCalls}
                      pending={navFeedStatsPending}
                    />
                  </span>
                </Link>
                <Link
                  href="/trusted-pro"
                  onClick={pick}
                  data-tutorial="sidebar.nav.trustedPro"
                  className={getSubNavItemClass(isActive(pathname, "/trusted-pro"))}
                >
                  <div
                    className={`absolute left-0 top-1/2 h-4 w-[2px] -translate-y-1/2 rounded ${
                      isActive(pathname, "/trusted-pro") ? `${tierNavBarClass("user")} opacity-100` : "opacity-0"
                    }`}
                    aria-hidden
                  />
                  <span className="flex min-w-0 flex-1 items-center justify-between gap-2">
                    <span className="min-w-0 truncate">Trusted Pro</span>
                    <SidebarNavAthBadge
                      avgX={navFeedStats?.trustedPro}
                      pending={navFeedStatsPending}
                    />
                  </span>
                </Link>
                {hasProFeatures ? (
                  <Link
                    href="/outside-calls"
                    onClick={pick}
                    data-tutorial="sidebar.nav.outsideCalls"
                    className={getSubNavItemClass(isActive(pathname, "/outside-calls"))}
                  >
                    <div
                      className={`absolute left-0 top-1/2 h-4 w-[2px] -translate-y-1/2 rounded ${
                        isActive(pathname, "/outside-calls")
                          ? `${tierNavBarClass("user")} opacity-100`
                          : "opacity-0"
                      }`}
                      aria-hidden
                    />
                    <span className="flex min-w-0 flex-1 items-center justify-between gap-2">
                      <span className="min-w-0 truncate">Outside Calls</span>
                      <SidebarNavAthBadge
                        avgX={navFeedStats?.outsideCalls}
                        pending={navFeedStatsPending}
                      />
                    </span>
                  </Link>
                ) : (
                  <Link
                    href="/membership?line=pro&upgrade=1"
                    onClick={pick}
                    data-tutorial="sidebar.nav.outsideCalls"
                    className={getSubNavItemClass(false)}
                    title="Pro unlocks the off-desk Outside Calls lane"
                  >
                    <div className="absolute left-0 top-1/2 h-4 w-[2px] -translate-y-1/2 rounded opacity-0" aria-hidden />
                    <span className="flex min-w-0 flex-1 items-center justify-between gap-2">
                      <span className="truncate text-zinc-300">Outside Calls</span>
                      <ProBadge />
                    </span>
                  </Link>
                )}
                <Link
                  href="/hodl"
                  onClick={pick}
                  data-tutorial="sidebar.nav.hodl"
                  className={getSubNavItemClass(isActive(pathname, "/hodl"))}
                >
                  <div
                    className={`absolute left-0 top-1/2 h-4 w-[2px] -translate-y-1/2 rounded ${
                      isActive(pathname, "/hodl") ? `${tierNavBarClass("user")} opacity-100` : "opacity-0"
                    }`}
                    aria-hidden
                  />
                  <span>HODL</span>
                </Link>
              </div>
            ) : null}
          </div>
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

          <p className={navSectionClass}>Workspace</p>
          <Link href="/calls" onClick={pick} data-tutorial="sidebar.nav.calls" className={getNavItemClass(isActive(pathname, "/calls"))}>
            <div
              className={`absolute left-0 top-1/2 h-5 w-[2px] -translate-y-1/2 rounded ${
                isActive(pathname, "/calls") ? `${tierNavBarClass("user")} opacity-100` : "opacity-0"
              }`}
            />
            <span className="flex min-w-0 flex-1 items-center justify-between gap-2">
              <span className="truncate">My Call Log</span>
              <SidebarNavAthBadge avgX={navFeedStats?.myCallLog} pending={navFeedStatsPending} />
            </span>
          </Link>
          <Link href="/performance" onClick={pick} data-tutorial="sidebar.nav.performance" className={getNavItemClass(isActive(pathname, "/performance"))}>
            <div
              className={`absolute left-0 top-1/2 h-5 w-[2px] -translate-y-1/2 rounded ${
                isActive(pathname, "/performance") ? `${tierNavBarClass("user")} opacity-100` : "opacity-0"
              }`}
            />
            <span>Performance Lab</span>
          </Link>
          <Link
            href="/trade-journal"
            onClick={pick}
            data-tutorial="sidebar.nav.tradeJournal"
            className={getNavItemClass(isActive(pathname, "/trade-journal"))}
          >
            <div
              className={`absolute left-0 top-1/2 h-5 w-[2px] -translate-y-1/2 rounded ${
                isActive(pathname, "/trade-journal") ? `${tierNavBarClass("user")} opacity-100` : "opacity-0"
              }`}
            />
            <span>Trade Journal</span>
          </Link>
          <Link href="/watchlist" onClick={pick} data-tutorial="sidebar.nav.watchlist" className={getNavItemClass(isActive(pathname, "/watchlist"))}>
            <div
              className={`absolute left-0 top-1/2 h-5 w-[2px] -translate-y-1/2 rounded ${
                isActive(pathname, "/watchlist") ? `${tierNavBarClass("user")} opacity-100` : "opacity-0"
              }`}
            />
            <span>Watchlist</span>
          </Link>
          {copyTradeNavLocked ? (
            <div
              className={`${getNavItemClass(false)} cursor-not-allowed select-none opacity-[0.88]`}
              data-tutorial="sidebar.nav.copyTrade"
              aria-disabled="true"
            >
              <div className="absolute left-0 top-1/2 h-5 w-[2px] -translate-y-1/2 rounded opacity-0" />
              <span className="relative min-w-0 flex-1 pr-[4.5rem]">
                <span className="block truncate">Copy trade</span>
                <span className="pointer-events-none absolute right-0 top-1/2 max-w-[4.25rem] -translate-y-1/2 text-right text-[7px] font-extrabold uppercase leading-tight tracking-wide text-red-500 drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)] sm:text-[8px]">
                  Coming soon
                </span>
              </span>
            </div>
          ) : (
            <Link href="/copy-trade" onClick={pick} data-tutorial="sidebar.nav.copyTrade" className={getNavItemClass(isActive(pathname, "/copy-trade"))}>
              <div
                className={`absolute left-0 top-1/2 h-5 w-[2px] -translate-y-1/2 rounded ${
                  isActive(pathname, "/copy-trade") ? `${tierNavBarClass("user")} opacity-100` : "opacity-0"
                }`}
              />
              <span>Copy trade</span>
            </Link>
          )}
          <p className={navSectionClass}>Community</p>
          <Link
            href="/lounge/discord-chats"
            onClick={() => {
              void onDiscordChatsNavClick?.();
              pick?.();
            }}
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
            <span className="flex min-w-0 flex-1 items-center justify-between gap-2">
              <span className="truncate">Discord Chats</span>
              <span className="flex shrink-0 items-center gap-1">
                {discordGeneralUnread > 0 ? (
                  <span
                    className="rounded-full bg-sky-500/20 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-sky-100 ring-1 ring-sky-400/35"
                    title="New messages in general chat"
                  >
                    {discordGeneralUnread >= 100 ? "99+" : discordGeneralUnread}
                  </span>
                ) : null}
                {staffNav && discordModUnread > 0 ? (
                  <span
                    className="rounded-full bg-violet-500/20 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-violet-100 ring-1 ring-violet-400/35"
                    title="New messages in mod chat"
                  >
                    {discordModUnread >= 100 ? "99+" : discordModUnread}
                  </span>
                ) : null}
              </span>
            </span>
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
            <span>Voice Chats</span>
          </Link>

          {staffNav || adminNav ? (
            <>
              <p className={navSectionClass}>Staff</p>
              {staffNav ? <div className="px-3"><ModStaffResignBanner /></div> : null}
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
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate font-semibold text-emerald-100/95">Staff · Moderation</span>
                      <span className="truncate text-[10px] font-medium uppercase tracking-wider text-emerald-500/55">
                        Elite queue
                      </span>
                    </span>
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

      <div className="shrink-0 px-2 pb-2 pt-2">
        <FixItTicketLauncher placement="sidebar" />
      </div>

      <div className={`shrink-0 border-t border-zinc-800 ${mobileDrawer ? "px-2 py-2" : "p-3"}`}>
        <Link
          href="/settings"
          onClick={pick}
          data-tutorial="sidebar.nav.settings"
          className={`mb-1 flex items-center gap-3 rounded-md px-2 py-2 text-sm transition hover:bg-zinc-900 ${
            isActive(pathname, "/settings") ? "bg-zinc-900/80 text-white" : "text-zinc-400 hover:text-zinc-100"
          }`}
        >
          <svg
            className="h-4 w-4 shrink-0 text-zinc-500"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            aria-hidden
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 010 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z"
            />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span>Settings</span>
        </Link>
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
            <div className="flex items-center gap-2">
              <span className="truncate text-sm text-white">{profileName}</span>
              {hasProFeatures ? <ProBadge /> : null}
            </div>
            <div className="truncate text-xs text-zinc-500">View profile</div>
          </div>
        </Link>
      </div>
    </div>
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
  /** Unread counts for mirrored dashboard Discord chats (general = all users; mod = staff only). */
  const [discordGeneralUnread, setDiscordGeneralUnread] = useState(0);
  const [discordModUnread, setDiscordModUnread] = useState(0);
  const [navFeedStats, setNavFeedStats] = useState<SidebarNavFeedStats | null>(null);
  const [navFeedStatsPending, setNavFeedStatsPending] = useState(false);

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
          setApiAdminNav(sessionAdminNav(session));
          setApiStaffNav(sessionStaffNav(session));
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
          setApiStaffNav(sessionStaffNav(session));
          setApiAdminNav(sessionAdminNav(session));
          setApiRole(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [status, session?.user?.helpTier, session?.user?.canModerate]);

  const staffNav = sessionStaffNav(session) || apiStaffNav;
  const adminNav = sessionAdminNav(session) || apiAdminNav;

  const copyTradeStaff = copyTradeNavStaff(session, apiRole);
  const [copyTradePagePublic, setCopyTradePagePublic] = useState<boolean | null>(null);
  const copyTradeNavLocked = !copyTradeStaff && copyTradePagePublic !== true;

  const sessionTier = (session?.user as { helpTier?: string } | undefined)?.helpTier;
  const viewerTier = normalizeStaffRole(apiRole ?? sessionTier ?? "user");

  const markDiscordChatsNav = useCallback(async () => {
    if (!profileId) return;
    try {
      const r = await fetch("/api/chat/mark-read", {
        method: "POST",
        credentials: "same-origin",
      });
      const j = (await r.json().catch(() => null)) as {
        ok?: boolean;
        general?: { latestId?: string | null };
        mod?: { latestId?: string | null };
      } | null;
      if (r.ok && j?.ok) applyDashDiscordMarkReadPayload(profileId, j);
    } catch {
      /* ignore */
    }
    setDiscordGeneralUnread(0);
    setDiscordModUnread(0);
  }, [profileId]);

  useEffect(() => {
    if (pathname !== "/lounge/discord-chats") return;
    if (status !== "authenticated" || !profileId) return;
    void markDiscordChatsNav();
  }, [markDiscordChatsNav, pathname, profileId, status]);

  useEffect(() => {
    if (status !== "authenticated" || !profileId) {
      setDiscordGeneralUnread(0);
      setDiscordModUnread(0);
      return;
    }

    let cancelled = false;

    const poll = async () => {
      try {
        let glr = getDashDiscordLastRead(profileId, "general");
        let mlr = staffNav ? getDashDiscordLastRead(profileId, "mod") : null;

        const qs = new URLSearchParams();
        if (glr) qs.set("generalLastRead", glr);
        if (staffNav && mlr) qs.set("modLastRead", mlr);

        const res = await fetch(`/api/chat/unread-counts?${qs.toString()}`, {
          credentials: "same-origin",
        });
        const j = (await res.json().catch(() => null)) as {
          ok?: boolean;
          general?: { unread?: number; latestId?: string | null; capped?: boolean };
          mod?: { unread?: number; latestId?: string | null; capped?: boolean };
        } | null;
        if (cancelled || !res.ok || !j?.ok || !j.general) return;

        if (!glr && j.general.latestId) {
          setDashDiscordLastRead(profileId, "general", j.general.latestId);
        }
        if (staffNav && j.mod?.latestId && !mlr) {
          setDashDiscordLastRead(profileId, "mod", j.mod.latestId);
        }

        const rawG = typeof j.general.unread === "number" ? j.general.unread : 0;
        setDiscordGeneralUnread(j.general.capped ? 100 : rawG);

        if (staffNav && j.mod) {
          const rawM = typeof j.mod.unread === "number" ? j.mod.unread : 0;
          setDiscordModUnread(j.mod.capped ? 100 : rawM);
        } else {
          setDiscordModUnread(0);
        }
      } catch {
        if (!cancelled) {
          setDiscordGeneralUnread(0);
          setDiscordModUnread(0);
        }
      }
    };

    void poll();
    const timer = window.setInterval(() => void poll(), 25_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [profileId, staffNav, status]);

  useEffect(() => {
    if (status !== "authenticated") {
      setNavFeedStats(null);
      setNavFeedStatsPending(false);
      return;
    }

    let cancelled = false;
    setNavFeedStatsPending(true);

    const loadNavFeedStats = async () => {
      try {
        const res = await fetch("/api/me/sidebar-nav-stats", {
          credentials: "same-origin",
          cache: "no-store",
        });
        const json = (await res.json().catch(() => null)) as {
          success?: boolean;
          botCalls?: number | null;
          trustedPro?: number | null;
          outsideCalls?: number | null;
          myCallLog?: number | null;
        } | null;
        if (cancelled) return;
        if (!res.ok || !json?.success) {
          setNavFeedStats(null);
          return;
        }
        const num = (v: unknown) =>
          typeof v === "number" && Number.isFinite(v) && v > 0 ? v : null;
        setNavFeedStats({
          botCalls: num(json.botCalls),
          trustedPro: num(json.trustedPro),
          outsideCalls: num(json.outsideCalls),
          myCallLog: num(json.myCallLog),
        });
      } catch {
        if (!cancelled) setNavFeedStats(null);
      } finally {
        if (!cancelled) setNavFeedStatsPending(false);
      }
    };

    void loadNavFeedStats();
    const timer = window.setInterval(() => void loadNavFeedStats(), 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [status]);

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
    if (status !== "authenticated") {
      setCopyTradePagePublic(null);
      return;
    }
    if (copyTradeStaff) {
      setCopyTradePagePublic(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/me/copy-trade-page-public", { credentials: "same-origin" });
        const j = (await res.json().catch(() => ({}))) as { ok?: boolean; enabled?: boolean };
        if (cancelled) return;
        setCopyTradePagePublic(res.ok && j.ok === true ? Boolean(j.enabled) : false);
      } catch {
        if (!cancelled) setCopyTradePagePublic(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [status, copyTradeStaff]);

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

  const getNavItemClass = (active: boolean, forMobileDrawer = false) =>
    `relative flex items-center gap-3 px-4 ${forMobileDrawer ? "py-2.5" : "py-2"} rounded-md text-sm transition-all duration-150 hover:bg-zinc-900/60 ${
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
    discordGeneralUnread,
    discordModUnread,
    onDiscordChatsNavClick: markDiscordChatsNav,
    getNavItemClass,
    copyTradeNavLocked,
    hasProFeatures:
      session?.user?.hasProFeatures === true ||
      session?.user?.helpTier === "admin" ||
      session?.user?.helpTier === "mod",
    navFeedStats,
    navFeedStatsPending,
  };

  return (
    <>
      <aside
        className={`relative z-30 sticky top-0 hidden h-screen w-64 shrink-0 flex flex-col overflow-hidden bg-gradient-to-b from-black via-zinc-950 to-black lg:flex ${dashboardChrome.sidebar}`}
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
            <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain no-scrollbar pb-[max(0.5rem,env(safe-area-inset-bottom))]">
              <SidebarBody
                {...bodyProps}
                getNavItemClass={(active) => getNavItemClass(active, true)}
                mobileDrawer
                onCloseDrawer={() => setOpen(false)}
                onNavigate={() => setOpen(false)}
              />
            </div>
          </aside>
        </div>
      ) : null}
    </>
  );
}
