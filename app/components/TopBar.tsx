"use client";

import { useNotifications } from "@/app/contexts/NotificationsContext";
import { useMobileSidebar } from "@/app/contexts/MobileSidebarContext";
import { CaAnalyzerModal } from "@/app/components/CaAnalyzerModal";
import { LinkedWalletCluster } from "@/app/components/LinkedWalletCluster";
import { dashboardChrome } from "@/lib/roleTierStyles";
import { terminalSurface, terminalUi } from "@/lib/terminalDesignTokens";
import { userProfileHref, userProfilePathMatches } from "@/lib/userProfileHref";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signIn, signOut, useSession } from "next-auth/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { createTransfer } from "@solana/pay";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import BigNumber from "bignumber.js";
import { PublicKey } from "@solana/web3.js";

type MarketSnapshot = {
  solPrice: number;
  change24h: number;
};

type InboxNotificationRow = {
  id: string;
  title: string;
  body: string;
  kind: string;
  created_at: string;
  read_at: string | null;
};

type UserCounts = {
  totalUsers: number;
  onlineUsers: number;
};

function CountPill({
  label,
  value,
  accentDot = false,
}: {
  label: string;
  value: string;
  accentDot?: boolean;
}) {
  return (
    <span
      className={`group inline-flex items-center gap-2 rounded-lg border border-zinc-800/70 bg-zinc-950/35 px-2.5 py-1 backdrop-blur transition hover:border-zinc-700/80 hover:bg-zinc-950/45 ${terminalSurface.insetEdge}`}
    >
      {accentDot ? (
        <span
          className="h-1.5 w-1.5 rounded-full bg-[color:var(--accent)] shadow-[0_0_0_3px_rgba(34,197,94,0.10)]"
          aria-hidden
        />
      ) : (
        <span className="h-1.5 w-1.5 rounded-full bg-zinc-600/70" aria-hidden />
      )}
      <span className="text-[11px] font-semibold tracking-wide text-zinc-400">
        {label}
      </span>
      <span className="min-w-[2.25rem] text-right text-[11px] font-semibold tabular-nums text-zinc-100 transition-opacity duration-200 group-hover:text-white">
        {value}
      </span>
    </span>
  );
}

type TipStartOk = {
  success: true;
  solanaPayUrl: string;
  reference: string;
  treasury: string;
  amountSol: string;
  memo: string;
};

function discordSignInSafe() {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  url.searchParams.delete("callbackUrl");
  window.history.replaceState({}, "", url.toString());
  void signIn("discord", { callbackUrl: "/" });
}

function formatSolUsd(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return `$${n.toFixed(2)}`;
}

function formatPctChange(n: number): string {
  if (!Number.isFinite(n)) return "—";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(1)}%`;
}

function formatCount(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return Math.round(n).toLocaleString("en-US");
}

/** Joyride tooltips render in a portal; ignore those clicks for top-bar dismiss handlers. */
function isInsideGuidedTourUi(node: Node | null): boolean {
  if (!node || !(node instanceof Element)) return false;
  return Boolean(
    node.closest("[class*='react-joyride']") ||
      node.closest("[data-floater-container]") ||
      node.closest("[id^='react-joyride']")
  );
}

/** Caller tour spotlights account links without leaving `/`; block real navigation while active. */
function tourBlocksAccountMenuNav(e: { preventDefault(): void }): boolean {
  if (typeof document === "undefined") return false;
  if (document.body.dataset.mcgbotTourBlockAccountNav !== "1") return false;
  e.preventDefault();
  return true;
}

function formatTimeAgo(createdAt: number, nowMs: number): string {
  if (!Number.isFinite(createdAt) || createdAt <= 0) return "—";
  const diff = Math.max(0, nowMs - createdAt);
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return sec <= 1 ? "just now" : `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return min === 1 ? "1 min ago" : `${min} min ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return hr === 1 ? "1 hour ago" : `${hr} hours ago`;
  const day = Math.floor(hr / 24);
  return day === 1 ? "1 day ago" : `${day} days ago`;
}

export function TopBar() {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const { setOpen: setMobileSidebarOpen } = useMobileSidebar();
  const { notifications } = useNotifications();
  const activeNotificationCount = notifications.filter((n) => !n.exiting).length;
  const [inboxItems, setInboxItems] = useState<InboxNotificationRow[]>([]);
  const [inboxUnread, setInboxUnread] = useState(0);
  const [market, setMarket] = useState<MarketSnapshot | null>(null);
  const [marketLoading, setMarketLoading] = useState(true);
  const [marketUpdatedAtMs, setMarketUpdatedAtMs] = useState<number | null>(null);
  const [userCounts, setUserCounts] = useState<UserCounts | null>(null);
  const [userCountsLoading, setUserCountsLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const loadedOnceRef = useRef(false);
  const prevSolPriceRef = useRef<number | null>(null);
  const flashTimerRef = useRef<number | null>(null);
  const [priceFlash, setPriceFlash] = useState<"up" | "down" | null>(null);
  const [caAnalyzerOpen, setCaAnalyzerOpen] = useState(false);
  const [showMarketWidget, setShowMarketWidget] = useState(true);
  const [open, setOpen] = useState(false);
  const [openNotifications, setOpenNotifications] = useState(false);
  const [tipOpen, setTipOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const topBarRef = useRef<HTMLElement | null>(null);
  const [inGuild, setInGuild] = useState<boolean | null>(null);

  const helpTier = (session?.user as { helpTier?: string } | undefined)?.helpTier;
  const staffSessionBypass =
    helpTier === "admin" || helpTier === "mod" || session?.user?.canModerate === true;
  const hasAccess = Boolean(
    session?.user?.hasDashboardAccess ||
      session?.user?.subscriptionExempt ||
      staffSessionBypass
  );

  const refreshInbox = useCallback(async () => {
    if (status !== "authenticated") {
      setInboxItems([]);
      setInboxUnread(0);
      return;
    }
    try {
      const res = await fetch("/api/me/inbox-notifications", { credentials: "same-origin" });
      const j = (await res.json().catch(() => null)) as {
        items?: InboxNotificationRow[];
        unreadCount?: number;
      } | null;
      if (!res.ok || !j || typeof j !== "object") return;
      setInboxItems(Array.isArray(j.items) ? j.items : []);
      setInboxUnread(typeof j.unreadCount === "number" ? j.unreadCount : 0);
    } catch {
      /* ignore */
    }
  }, [status]);

  useEffect(() => {
    void refreshInbox();
    if (status !== "authenticated") return;
    const id = window.setInterval(() => void refreshInbox(), 60_000);
    return () => window.clearInterval(id);
  }, [refreshInbox, status]);

  useEffect(() => {
    if (openNotifications) void refreshInbox();
  }, [openNotifications, refreshInbox]);

  /** Lets the announcement bar sit flush under this sticky header while the page scrolls. */
  useEffect(() => {
    const el = topBarRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const apply = () => {
      const h = Math.round(el.getBoundingClientRect().height);
      document.documentElement.style.setProperty("--dashboard-topbar-height", `${h}px`);
    };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    window.addEventListener("resize", apply);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", apply);
      document.documentElement.style.removeProperty("--dashboard-topbar-height");
    };
  }, []);

  const markInboxAllRead = useCallback(async () => {
    try {
      const res = await fetch("/api/me/inbox-notifications", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ readAll: true }),
      });
      if (res.ok) void refreshInbox();
    } catch {
      /* ignore */
    }
  }, [refreshInbox]);

  const bellBadgeCount = activeNotificationCount + inboxUnread;

  const accountMenuItem = (active: boolean) =>
    `block w-full px-4 py-2.5 text-left text-sm transition hover:bg-zinc-800 ${
      active ? "bg-zinc-900 text-white" : "text-zinc-200"
    }`;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const fetchCounts = () => {
      if (!cancelled && userCounts == null) setUserCountsLoading(true);
      fetch("/api/public/user-counts")
        .then((res) => (res.ok ? res.json() : null))
        .then((data: unknown) => {
          if (cancelled || !data || typeof data !== "object") return;
          const o = data as Record<string, unknown>;
          if (o.success !== true) return;
          const totalUsers = Number(o.totalUsers);
          const onlineUsers = Number(o.onlineUsers);
          if (!Number.isFinite(totalUsers) || totalUsers < 0) return;
          if (!Number.isFinite(onlineUsers) || onlineUsers < 0) return;
          setUserCounts({
            totalUsers: Math.round(totalUsers),
            onlineUsers: Math.round(onlineUsers),
          });
        })
        .catch(() => {})
        .finally(() => {
          if (!cancelled) setUserCountsLoading(false);
        });
    };

    fetchCounts();
    const id = window.setInterval(fetchCounts, 30_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [userCounts]);

  useEffect(() => {
    if (status !== "authenticated" || !session?.user?.id?.trim()) return;
    let cancelled = false;

    const ping = () => {
      void fetch("/api/me/presence", { method: "POST" }).catch(() => {});
    };

    ping();
    const id = window.setInterval(() => {
      if (!cancelled) ping();
    }, 45_000);

    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [session?.user?.id, status]);

  useEffect(() => {
    let cancelled = false;

    const fetchMarket = () => {
      if (!loadedOnceRef.current) setMarketLoading(true);

      fetch("/api/market")
        .then((res) => res.json())
        .then((data: unknown) => {
          if (cancelled || !data || typeof data !== "object") return;

          const o = data as Record<string, unknown>;
          const solPrice = Number(o.solPrice);
          const change24h = Number(o.change24h);
          if (!Number.isFinite(solPrice) || solPrice <= 0) return;

          const prev = prevSolPriceRef.current;
          if (prev != null && Number.isFinite(prev) && prev > 0 && prev !== solPrice) {
            setPriceFlash(solPrice > prev ? "up" : "down");
            if (flashTimerRef.current != null) {
              window.clearTimeout(flashTimerRef.current);
            }
            flashTimerRef.current = window.setTimeout(() => {
              setPriceFlash(null);
              flashTimerRef.current = null;
            }, 550);
          }
          prevSolPriceRef.current = solPrice;

          setMarket({
            solPrice,
            change24h: Number.isFinite(change24h) ? change24h : 0,
          });
          setMarketUpdatedAtMs(Date.now());
        })
        .catch(() => {
          if (!cancelled) setMarket(null);
        })
        .finally(() => {
          if (!cancelled) {
            setMarketLoading(false);
            loadedOnceRef.current = true;
          }
        });
    };

    // initial fetch
    fetchMarket();

    // repeat every 15s
    const interval = setInterval(fetchMarket, 15000);

    return () => {
      cancelled = true;
      clearInterval(interval);
      if (flashTimerRef.current != null) {
        window.clearTimeout(flashTimerRef.current);
        flashTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (status !== "authenticated") {
      setShowMarketWidget(true);
      return;
    }

    let cancelled = false;

    fetch("/api/dashboard-settings")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: unknown) => {
        if (cancelled || !data || typeof data !== "object") return;
        const raw = (data as Record<string, unknown>).widgets_enabled;
        if (!raw || typeof raw !== "object") return;
        const m = (raw as Record<string, unknown>).market;
        if (typeof m === "boolean") setShowMarketWidget(m);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [status]);

  useEffect(() => {
    if (status !== "authenticated" || !hasAccess) {
      setInGuild(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/subscription/guild-status");
        const json = (await res.json().catch(() => ({}))) as { success?: boolean; inGuild?: boolean | null };
        if (cancelled) return;
        if (!res.ok || json.success !== true) {
          setInGuild(null);
          return;
        }
        setInGuild(typeof json.inGuild === "boolean" ? json.inGuild : null);
      } catch {
        if (!cancelled) setInGuild(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hasAccess, status]);

  useEffect(() => {
    if (!open && !openNotifications) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (isInsideGuidedTourUi(t)) return;
      if (open && menuRef.current && !menuRef.current.contains(t)) {
        setOpen(false);
      }
      if (
        openNotifications &&
        notifRef.current &&
        !notifRef.current.contains(t)
      ) {
        setOpenNotifications(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open, openNotifications]);

  const canTip = status === "authenticated" && hasAccess && inGuild === true;

  const solLineClass =
    market != null && market.change24h >= 0
      ? "text-[color:var(--accent)]"
      : market != null
        ? "text-red-400"
        : "text-zinc-300";

  const marketUpdatedLabel =
    marketUpdatedAtMs == null ? "—" : formatTimeAgo(marketUpdatedAtMs, Date.now());

  const openCaAnalyzer = useCallback(() => {
    setCaAnalyzerOpen(true);
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const tag = t?.tagName?.toLowerCase();
      const inInput =
        tag === "input" ||
        tag === "textarea" ||
        (t != null && (t as any).isContentEditable);

      if (e.key === "Escape") {
        if (caAnalyzerOpen) setCaAnalyzerOpen(false);
        return;
      }

      if (inInput) return;

      if (e.key === "/") {
        e.preventDefault();
        openCaAnalyzer();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [openCaAnalyzer, caAnalyzerOpen]);

  return (
    <>
      <header ref={topBarRef} className={`sticky top-0 z-50 ${dashboardChrome.topBar}`} role="banner">
      {/* TOP ROW (existing header content) */}
      <div className="flex items-center justify-between gap-2 px-3 py-1.5 sm:px-6 sm:py-2">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <button
            type="button"
            onClick={() => setMobileSidebarOpen(true)}
            data-tutorial="nav.openSidebar"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-zinc-800/80 bg-zinc-900/40 text-zinc-300 transition hover:border-zinc-600 hover:bg-zinc-800/60 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/40 lg:hidden"
            aria-label="Open navigation menu"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5" aria-hidden>
              <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
            </svg>
          </button>
          <button
            type="button"
            onClick={openCaAnalyzer}
            data-tutorial="nav.tokenSearchMobile"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-zinc-700/90 bg-zinc-800/60 text-zinc-300 transition hover:border-zinc-600 hover:bg-zinc-800 hover:text-zinc-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500/35 sm:hidden"
            aria-label="Open CA Analyzer"
            title="CA Analyzer (shortcut /)"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4" aria-hidden>
              <path d="M4 19V5M8 19V9M12 19v-6M16 19v-3M20 19V11" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          {status === "loading" ? (
            <div className="h-9 w-24 animate-pulse rounded-md bg-zinc-800/80" />
          ) : (
            <>
              <button
                type="button"
                onClick={openCaAnalyzer}
                data-tutorial="nav.tokenSearch"
                className="hidden h-9 items-center rounded-lg border border-zinc-700/90 bg-zinc-800/60 px-3 text-xs font-semibold text-zinc-200/95 transition hover:border-zinc-600 hover:bg-zinc-800 hover:text-zinc-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500/35 sm:inline-flex"
                aria-label="Open CA Analyzer"
                title="CA Analyzer (shortcut /)"
              >
                Analyze CA
              </button>
              {canTip ? (
                <>
                  <button
                    type="button"
                    onClick={() => setTipOpen(true)}
                    data-tutorial="nav.tip"
                    className="hidden h-9 items-center rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-3 text-xs font-semibold text-emerald-100/95 transition hover:border-emerald-400/45 hover:bg-emerald-500/15 sm:inline-flex"
                  >
                    Tip McGBot
                  </button>
                  <button
                    type="button"
                    onClick={() => setTipOpen(true)}
                    data-tutorial="nav.tipMobile"
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-emerald-500/25 bg-emerald-500/10 text-emerald-100/95 transition hover:border-emerald-400/45 hover:bg-emerald-500/15 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/40 sm:hidden"
                    aria-label="Tip McGBot"
                  >
                    <span className="text-sm font-black leading-none" aria-hidden>
                      ◎
                    </span>
                  </button>
                </>
              ) : null}
              <LinkedWalletCluster />
              <div className="relative" ref={notifRef} data-tutorial="nav.notifications">
                <button
                  type="button"
                  onClick={() => {
                    setOpenNotifications((o) => !o);
                    setOpen(false);
                  }}
                  className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-zinc-700/90 bg-zinc-800/60 text-zinc-300 transition hover:border-zinc-600 hover:bg-zinc-800 hover:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-sky-500/40"
                  aria-expanded={openNotifications}
                  aria-haspopup="true"
                  aria-label="Notifications"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-5 w-5"
                    aria-hidden
                  >
                    <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
                    <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
                  </svg>
                  {bellBadgeCount > 0 ? (
                    <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[color:var(--accent)] px-1 text-[10px] font-semibold leading-none text-black">
                      {bellBadgeCount > 99 ? "99+" : bellBadgeCount}
                    </span>
                  ) : null}
                </button>
                {openNotifications ? (
                  <div
                    className={terminalUi.notificationsPanel}
                    role="region"
                    aria-label="Notification list"
                  >
                    {inboxUnread > 0 ? (
                      <div className="flex items-center justify-end border-b border-zinc-800/90 px-3 py-2">
                        <button
                          type="button"
                          onClick={() => void markInboxAllRead()}
                          className="text-[11px] font-semibold uppercase tracking-wide text-sky-300/90 transition hover:text-sky-200"
                        >
                          Mark messages read
                        </button>
                      </div>
                    ) : null}
                    {inboxItems.length > 0 ? (
                      <ul className={terminalUi.notificationsList}>
                        {inboxItems.map((row) => (
                          <li
                            key={row.id}
                            className={`px-4 py-3 ${row.read_at == null ? "bg-sky-950/15" : ""}`}
                          >
                            <p className="text-sm font-medium text-zinc-100">{row.title || "Notice"}</p>
                            <p className="mt-1 text-sm text-zinc-300">{row.body}</p>
                            <p className="mt-1 text-xs text-zinc-500">
                              {formatTimeAgo(new Date(row.created_at).getTime(), Date.now())}
                            </p>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    {inboxItems.length > 0 && notifications.length > 0 ? (
                      <div className="border-t border-zinc-800/90 px-4 py-2">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Live alerts</p>
                      </div>
                    ) : null}
                    {notifications.length === 0 && inboxItems.length === 0 ? (
                      <p className="px-4 py-8 text-center text-sm text-zinc-500">
                        No notifications yet
                      </p>
                    ) : notifications.length > 0 ? (
                      <ul className={terminalUi.notificationsList}>
                        {notifications.map((n) => (
                          <li
                            key={n.id}
                            className={`px-4 py-3 transition-all duration-200 ease-out motion-reduce:transition-none ${
                              n.exiting
                                ? "translate-x-5 opacity-0 motion-reduce:translate-x-0"
                                : "translate-x-0 opacity-100"
                            }`}
                          >
                            <p className="text-sm text-zinc-100">{n.text}</p>
                            <p className="mt-1 text-xs text-zinc-500">
                              {formatTimeAgo(n.createdAt, Date.now())}
                            </p>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                ) : null}
              </div>

              {session ? (
              <div className="relative" ref={menuRef} data-tutorial="nav.userMenu">
                  <button
                    type="button"
                    onClick={() => {
                      setOpen((o) => !o);
                      setOpenNotifications(false);
                    }}
                    className="flex max-w-full items-center gap-2 rounded-lg border border-transparent py-1 pl-1 pr-2 transition hover:bg-zinc-800/60 hover:ring-2 hover:ring-zinc-600/80 focus:outline-none focus:ring-2 focus:ring-sky-500/40"
                    aria-expanded={open}
                    aria-haspopup="menu"
                    aria-label="Open account menu"
                  >
                    {session.user?.image ? (
                      <img
                        src={session.user.image}
                        alt=""
                        className="h-9 w-9 shrink-0 rounded-full border border-zinc-700 object-cover"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-zinc-700 bg-zinc-800 text-xs font-medium text-zinc-400">
                        {(session.user?.name ?? "?").slice(0, 1).toUpperCase()}
                      </div>
                    )}
                    <span className="hidden max-w-[200px] truncate text-left text-sm font-medium text-zinc-100 sm:inline">
                      {session.user?.name ?? "User"}
                    </span>
                  </button>
                  {open ? (
                    <div className={terminalUi.accountMenu} role="menu">
                      <Link
                        href={userProfileHref({
                          discordId: session.user.id,
                          displayName: session.user.name,
                        })}
                        data-tutorial="nav.menu.profile"
                        role="menuitem"
                        onClick={(e) => {
                          if (tourBlocksAccountMenuNav(e)) return;
                          setOpen(false);
                        }}
                        className={accountMenuItem(
                          userProfilePathMatches(
                            pathname,
                            session.user.id,
                            session.user.name
                          )
                        )}
                      >
                        Profile
                      </Link>
                      <Link
                        href="/settings"
                        data-tutorial="nav.menu.settings"
                        role="menuitem"
                        onClick={(e) => {
                          if (tourBlocksAccountMenuNav(e)) return;
                          setOpen(false);
                        }}
                        className={accountMenuItem(pathname.startsWith("/settings"))}
                      >
                        Settings
                      </Link>
                      <Link
                        href="/help"
                        data-tutorial="nav.menu.help"
                        role="menuitem"
                        aria-keyshortcuts="Shift+/"
                        onClick={(e) => {
                          if (tourBlocksAccountMenuNav(e)) return;
                          setOpen(false);
                        }}
                        className={`flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left text-sm transition hover:bg-zinc-800 ${
                          pathname.startsWith("/help")
                            ? "bg-zinc-900 text-white"
                            : "text-zinc-200"
                        }`}
                      >
                        <span>Help</span>
                        <kbd
                          className="pointer-events-none shrink-0 rounded-md border border-zinc-700/80 bg-zinc-900/50 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-zinc-500"
                          title="Shift + / (question mark)"
                          aria-hidden
                        >
                          ?
                        </kbd>
                      </Link>

                      <div className={terminalUi.menuSectionRule} />
                      <div className="px-4 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-600">
                        Referrals
                      </div>
                      <Link
                        href="/referrals"
                        data-tutorial="nav.menu.referralsOverview"
                        role="menuitem"
                        onClick={(e) => {
                          if (tourBlocksAccountMenuNav(e)) return;
                          setOpen(false);
                        }}
                        className={accountMenuItem(pathname === "/referrals")}
                      >
                        Overview
                      </Link>
                      <Link
                        href="/referrals/performance"
                        data-tutorial="nav.menu.referralsPerformance"
                        role="menuitem"
                        onClick={(e) => {
                          if (tourBlocksAccountMenuNav(e)) return;
                          setOpen(false);
                        }}
                        className={accountMenuItem(pathname === "/referrals/performance")}
                      >
                        Performance
                      </Link>
                      <Link
                        href="/referrals/rewards"
                        data-tutorial="nav.menu.referralsRewards"
                        role="menuitem"
                        onClick={(e) => {
                          if (tourBlocksAccountMenuNav(e)) return;
                          setOpen(false);
                        }}
                        className={accountMenuItem(pathname === "/referrals/rewards")}
                      >
                        Rewards
                      </Link>

                      <div className={terminalUi.menuSectionRule} />
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setOpen(false);
                          signOut();
                        }}
                        className="w-full px-4 py-2.5 text-left text-sm text-zinc-200 transition hover:bg-zinc-800"
                      >
                        Logout
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => discordSignInSafe()}
                  className="rounded-lg bg-[#5865F2] px-3 py-2 text-sm font-semibold text-white transition hover:bg-[#4752c4] focus:outline-none focus:ring-2 focus:ring-sky-500/50"
                >
                  Login with Discord
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* MARKET STRIP ROW */}
      {showMarketWidget && (
        <div className={dashboardChrome.marketStripRow}>
          <div className={dashboardChrome.marketStripTopRule} aria-hidden />
          <div className={dashboardChrome.marketStripBackdrop} aria-hidden />
          <div className="relative z-10 px-3 py-1.5 text-[10px] leading-snug sm:px-6 sm:py-2 sm:text-xs">
            <div className="flex w-full flex-wrap items-center justify-between gap-x-2 gap-y-1.5 sm:gap-x-3">
              <div className="flex shrink-0 items-center gap-2 text-zinc-500">
                {userCountsLoading && !userCounts ? (
                  <div className="flex items-center gap-2">
                    <span className="inline-flex h-7 w-[92px] animate-pulse rounded-lg border border-zinc-800/70 bg-zinc-950/35" />
                    <span className="inline-flex h-7 w-[92px] animate-pulse rounded-lg border border-zinc-800/70 bg-zinc-950/35" />
                  </div>
                ) : userCounts ? (
                  <>
                    <CountPill
                      label="Total users"
                      value={formatCount(userCounts.totalUsers)}
                    />
                    <CountPill
                      label="Online"
                      value={formatCount(userCounts.onlineUsers)}
                      accentDot
                    />
                  </>
                ) : (
                  <span className="text-zinc-600">Users unavailable</span>
                )}
              </div>

              {marketLoading ? (
                <div className="flex justify-end">
                  <span className="text-zinc-600">Loading market…</span>
                </div>
              ) : market ? (
                <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1.5 text-zinc-500">
                <span
                  className={[
                    "flex shrink-0 items-center gap-1 rounded-md border border-transparent px-1.5 py-1 font-semibold tabular-nums transition-colors duration-300",
                    market.change24h >= 0 ? "text-[color:var(--accent)]" : "text-red-400",
                    priceFlash === "up"
                      ? "bg-[color:var(--accent)]/10 border-[color:var(--accent)]/20"
                      : priceFlash === "down"
                        ? "bg-red-500/10 border-red-500/20"
                        : "bg-zinc-900/55 border-zinc-800/55",
                  ].join(" ")}
                >
                  <span>{market.change24h >= 0 ? "▲" : "▼"}</span>
                  <span>
                    SOL {formatSolUsd(market.solPrice)} ({formatPctChange(market.change24h)})
                  </span>
                </span>

                <span className="hidden text-zinc-600 sm:inline" aria-hidden>
                  |
                </span>

                <span className="hidden min-[380px]:inline shrink-0 text-zinc-500 sm:inline">
                  Updated{" "}
                  <span className="font-medium tabular-nums text-zinc-300">{marketUpdatedLabel}</span>
                </span>
                </div>
              ) : (
                <div className="flex justify-end">
                  <span className="text-zinc-600">Market unavailable</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      <div className={dashboardChrome.topBarBottomRule} aria-hidden />
      </header>

      {mounted
        ? createPortal(
            <CaAnalyzerModal open={caAnalyzerOpen} onClose={() => setCaAnalyzerOpen(false)} />,
            document.body
          )
        : null}

      {mounted
        ? createPortal(
            <TipMcgbotModal open={tipOpen} onClose={() => setTipOpen(false)} />,
            document.body
          )
        : null}
    </>
  );
}

function TipMcgbotModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { publicKey, sendTransaction } = useWallet();
  const { connection } = useConnection();
  const { setVisible: openWalletModal } = useWalletModal();
  const [selected, setSelected] = useState<number>(0.1);
  const [customMode, setCustomMode] = useState(false);
  const [custom, setCustom] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [tip, setTip] = useState<TipStartOk | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState<{ signature: string; fromWallet: string | null } | null>(null);
  const [checking, setChecking] = useState(false);
  const [submittedSig, setSubmittedSig] = useState<string | null>(null);

  const presets = [0.05, 0.1, 0.25, 0.5, 1] as const;

  useEffect(() => {
    if (!open) return;
    setTip(null);
    setErr(null);
    setConfirmed(null);
    setChecking(false);
    setBusy(false);
    setCustom("");
    setSelected(0.1);
    setCustomMode(false);
    setSubmittedSig(null);
  }, [open]);

  const amountSol = (() => {
    const v = customMode ? Number(custom) : selected;
    return Number.isFinite(v) && v > 0 ? Math.round(v * 1e9) / 1e9 : null;
  })();

  const amountLabel = amountSol == null ? "—" : `${amountSol.toFixed(amountSol >= 1 ? 2 : 3).replace(/\.?0+$/, "")} SOL`;

  useEffect(() => {
    if (!open || !tip?.reference || confirmed) return;
    let cancelled = false;
    const id = window.setInterval(async () => {
      try {
        setChecking(true);
        const res = await fetch(`/api/tips/status?reference=${encodeURIComponent(tip.reference)}`);
        const json = (await res.json().catch(() => ({}))) as {
          success?: boolean;
          status?: string;
          signature?: string;
          fromWallet?: string | null;
        };
        if (cancelled || !res.ok || json.success !== true) return;
        if (json.status === "confirmed" && typeof json.signature === "string" && json.signature.trim()) {
          setConfirmed({
            signature: json.signature.trim(),
            fromWallet: typeof json.fromWallet === "string" ? json.fromWallet : null,
          });
        }
      } catch {
        /* ignore */
      } finally {
        if (!cancelled) setChecking(false);
      }
    }, 2500);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [confirmed, open, tip?.reference]);

  const startTip = useCallback(async () => {
    if (amountSol == null) return;
    if (!publicKey) {
      openWalletModal(true);
      setErr("Connect your wallet to send a tip.");
      return;
    }
    setBusy(true);
    setErr(null);
    setTip(null);
    setConfirmed(null);
    setSubmittedSig(null);
    try {
      const res = await fetch("/api/tips/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amountSol }),
      });
      const json = (await res.json().catch(() => ({}))) as (TipStartOk & {
        success?: boolean;
        error?: string;
      });
      if (!res.ok || json.success !== true || typeof json.solanaPayUrl !== "string") {
        setErr(typeof (json as any).error === "string" ? (json as any).error : "Could not start tip.");
        return;
      }

      const treasury = new PublicKey(String(json.treasury ?? ""));
      const reference = new PublicKey(String(json.reference ?? ""));
      const memo = typeof json.memo === "string" ? json.memo : "Tip for McGBot";

      const tx = await createTransfer(connection, publicKey, {
        recipient: treasury,
        amount: new BigNumber(String(json.amountSol ?? amountSol)),
        reference,
        memo,
      });

      const sig = await sendTransaction(tx, connection, { skipPreflight: false });
      setSubmittedSig(sig);
      setTip(json as TipStartOk);
      setConfirmed({
        signature: sig,
        fromWallet: publicKey.toBase58(),
      });
      try {
        const subRes = await fetch("/api/tips/submit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ reference: String(json.reference), signature: sig }),
        });
        if (!subRes.ok) {
          const subJson = (await subRes.json().catch(() => ({}))) as { error?: string };
          console.warn("[tip] submit:", subJson.error ?? subRes.status);
        }
      } catch {
        /* DB row may still be confirmed by /api/tips/status chain probe */
      }
    } catch (e) {
      const msg = e && typeof e === "object" && "message" in e ? String((e as Error).message) : "";
      const lower = msg.toLowerCase();
      if (lower.includes("reject") || lower.includes("denied")) {
        setErr("Transaction was cancelled.");
      } else if (/\b403\b|forbidden|access forbidden/i.test(msg)) {
        setErr(
          "Solana RPC blocked this request (403). Set NEXT_PUBLIC_SOLANA_RPC_URL to a provider URL that allows browser reads (e.g. Helius or QuickNode with your API key)."
        );
      } else if (lower.includes("recipient not found")) {
        setErr(
          "Tip treasury is not on this network yet (no account). Fund SOLANA_TIPS_TREASURY_PUBKEY with a little SOL once, and ensure NEXT_PUBLIC_SOLANA_CLUSTER matches that chain."
        );
      } else {
        setErr(msg || "Could not send tip.");
      }
    } finally {
      setBusy(false);
    }
  }, [amountSol, connection, openWalletModal, publicKey, sendTransaction]);

  const onTipPrimaryClick = useCallback(() => {
    if (!publicKey) {
      openWalletModal(true);
      setErr("Connect your wallet to send a tip.");
      return;
    }
    void startTip();
  }, [openWalletModal, publicKey, startTip]);

  if (!open) return null;
  return (
    <div
      className={terminalUi.modalBackdropZ120}
      role="dialog"
      aria-modal="true"
      aria-label="Tip McGBot"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className={terminalUi.modalPanelWideGlass}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-zinc-500">
              Support
            </p>
            <h3 className="mt-1 text-lg font-semibold text-zinc-100">Tip McGBot</h3>
            <p className="mt-1 text-xs text-zinc-500">
              Send a tip when McGBot nails a call.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-md border border-zinc-800 bg-zinc-900/40 text-zinc-300 transition hover:bg-zinc-900/60 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/30"
            aria-label="Close"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-4 w-4"
              aria-hidden
            >
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-zinc-800/70 bg-black/20 p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
              Amount (SOL)
            </p>
            <div className="mt-3 grid grid-cols-5 gap-2">
              {presets.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => {
                    setSelected(p);
                    setCustom("");
                    setCustomMode(false);
                  }}
                  className={[
                    "rounded-lg border px-2 py-2 text-xs font-semibold tabular-nums transition",
                    !customMode && selected === p
                      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-100"
                      : "border-zinc-800 bg-zinc-950/30 text-zinc-200 hover:border-zinc-700",
                  ].join(" ")}
                >
                  {p}
                </button>
              ))}
            </div>

            <div className="mt-3">
              <button
                type="button"
                onClick={() => {
                  setCustomMode(true);
                  if (!custom.trim()) setCustom(String(selected));
                }}
                className={`w-full rounded-lg border px-3 py-2 text-xs font-semibold transition ${
                  customMode
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-100"
                    : "border-zinc-800 bg-zinc-950/30 text-zinc-200 hover:border-zinc-700"
                }`}
              >
                {customMode ? "Custom tip enabled" : "Set custom tip"}
              </button>

              <div className={`mt-2 ${customMode ? "" : "opacity-50"}`}>
                <label className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
                  Custom amount
                </label>
                <input
                  value={custom}
                  onChange={(e) => setCustom(e.target.value)}
                  placeholder={customMode ? "e.g. 0.1337" : "Enable custom tip to enter"}
                  inputMode="decimal"
                  disabled={!customMode}
                  className="mt-1 w-full rounded-lg border border-zinc-800 bg-black/30 px-3 py-2 text-sm text-zinc-100 outline-none ring-emerald-500/20 focus:ring-2 disabled:cursor-not-allowed"
                />
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-3 py-2">
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-emerald-200/70">
                  You’re tipping
                </p>
                <p className="mt-0.5 text-lg font-black tabular-nums text-emerald-100">
                  {amountLabel}
                </p>
              </div>
              <div className="hidden text-right text-[11px] text-emerald-100/70 sm:block">
                Tip for McGBot
              </div>
            </div>

            <button
              type="button"
              onClick={() => onTipPrimaryClick()}
              disabled={busy || amountSol == null}
              className="mt-4 w-full rounded-lg bg-emerald-400 px-4 py-2.5 text-sm font-semibold text-black shadow-lg shadow-black/40 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy ? "Sending…" : publicKey ? "Send tip" : "Connect wallet to tip"}
            </button>

            {err ? (
              <p className="mt-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
                {err}
              </p>
            ) : null}
          </div>

          <div className="rounded-xl border border-zinc-800/70 bg-black/20 p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
              Status
            </p>

            <div className="mt-3 rounded-lg border border-zinc-800 bg-black/20 px-3 py-2">
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-semibold text-zinc-200">Tip amount</span>
                <span className="text-sm font-black tabular-nums text-emerald-200">{amountLabel}</span>
              </div>
              <p className="mt-1 text-[11px] text-zinc-500">Tip for McGBot</p>
            </div>

            {tip ? (
              <div className="mt-3 space-y-3">
                {submittedSig && !confirmed ? (
                  <div className="rounded-lg border border-zinc-800 bg-black/30 p-3">
                    <p className="text-xs text-zinc-400">Submitted</p>
                    <a
                      href={`https://solscan.io/tx/${encodeURIComponent(submittedSig)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 block break-all font-mono text-[11px] text-sky-300 underline-offset-2 hover:underline"
                    >
                      {submittedSig.slice(0, 10)}…{submittedSig.slice(-10)}
                    </a>
                  </div>
                ) : null}

                <div className="rounded-lg border border-zinc-800 bg-black/30 p-3">
                  <p className="text-xs text-zinc-400">Solana Pay link (backup)</p>
                  <p className="mt-1 break-all font-mono text-[11px] text-zinc-200">{tip.solanaPayUrl}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(tip.solanaPayUrl);
                        } catch {
                          /* ignore */
                        }
                      }}
                      className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-200 hover:bg-zinc-800"
                    >
                      Copy link
                    </button>
                    <a
                      href={tip.solanaPayUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-200 hover:bg-zinc-800"
                    >
                      Open in wallet app
                    </a>
                  </div>
                </div>

                {confirmed ? (
                  <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/10 p-3">
                    <p className="text-sm font-semibold text-emerald-100">McGBot received your tip.</p>
                    <p className="mt-1 text-xs text-emerald-100/80">
                      Signature:{" "}
                      <a
                        href={`https://solscan.io/tx/${encodeURIComponent(confirmed.signature)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-mono underline decoration-emerald-400/30 underline-offset-2 hover:decoration-emerald-300/60"
                      >
                        {confirmed.signature.slice(0, 8)}…{confirmed.signature.slice(-8)}
                      </a>
                    </p>
                    {confirmed.fromWallet ? (
                      <p className="mt-1 text-xs text-emerald-100/70">
                        From:{" "}
                        <span className="font-mono">
                          {confirmed.fromWallet.slice(0, 6)}…{confirmed.fromWallet.slice(-6)}
                        </span>
                      </p>
                    ) : null}
                  </div>
                ) : (
                  <div className="rounded-lg border border-zinc-800 bg-black/30 p-3">
                    <p className="text-sm font-semibold text-zinc-100">Waiting for confirmation…</p>
                    <p className="mt-1 text-xs text-zinc-500">
                      {checking ? "Checking the chain…" : "This updates automatically."}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="mt-3 flex min-h-[240px] items-center justify-center rounded-lg border border-zinc-800 bg-black/20 px-4 text-center">
                <p className="text-sm text-zinc-500">
                  Pick an amount and open in your wallet. We’ll confirm it here.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

