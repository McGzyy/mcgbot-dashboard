"use client";

import { useNotifications } from "@/app/contexts/NotificationsContext";
import { dashboardChrome } from "@/lib/roleTierStyles";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signIn, signOut, useSession } from "next-auth/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type MarketSnapshot = {
  solPrice: number;
  change24h: number;
  pumpVolume: number;
  activeTraders: number;
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

/** USD with $ and K / M suffix (e.g. $2.4M). */
function formatUsdCompact(n: number): string {
  if (!Number.isFinite(n) || n < 0) return "—";
  if (n >= 1_000_000) {
    const v = n / 1_000_000;
    const s = v >= 10 ? v.toFixed(0) : v.toFixed(1);
    return `$${s.replace(/\.0$/, "")}M`;
  }
  if (n >= 1_000) {
    const v = n / 1_000;
    const s = v >= 10 ? v.toFixed(0) : v.toFixed(1);
    return `$${s.replace(/\.0$/, "")}K`;
  }
  return `$${Math.round(n)}`;
}

function formatCount(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return Math.round(n).toLocaleString("en-US");
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
  const { notifications } = useNotifications();
  const activeNotificationCount = notifications.filter((n) => !n.exiting).length;
  const [market, setMarket] = useState<MarketSnapshot | null>(null);
  const [marketLoading, setMarketLoading] = useState(true);
  const [marketUpdatedAtMs, setMarketUpdatedAtMs] = useState<number | null>(null);
  const [mounted, setMounted] = useState(false);
  const loadedOnceRef = useRef(false);
  const prevSolPriceRef = useRef<number | null>(null);
  const flashTimerRef = useRef<number | null>(null);
  const [priceFlash, setPriceFlash] = useState<"up" | "down" | null>(null);
  const [tokenSearchOpen, setTokenSearchOpen] = useState(false);
  const [tokenSearchQuery, setTokenSearchQuery] = useState("");
  const [showMarketWidget, setShowMarketWidget] = useState(true);
  const [open, setOpen] = useState(false);
  const [openNotifications, setOpenNotifications] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  const accountMenuItem = (active: boolean) =>
    `block w-full px-4 py-2.5 text-left text-sm transition hover:bg-zinc-800 ${
      active ? "bg-zinc-900 text-white" : "text-zinc-200"
    }`;

  useEffect(() => {
    setMounted(true);
  }, []);

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
          const pumpVolume = Number(o.pumpVolume);
          const activeTraders = Number(o.activeTraders);

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
            pumpVolume: Number.isFinite(pumpVolume) ? pumpVolume : 0,
            activeTraders: Number.isFinite(activeTraders) ? activeTraders : 0,
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
    if (!open && !openNotifications) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
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

  const solLineClass =
    market != null && market.change24h >= 0
      ? "text-[color:var(--accent)]"
      : market != null
        ? "text-red-400"
        : "text-zinc-300";

  const marketUpdatedLabel =
    marketUpdatedAtMs == null ? "—" : formatTimeAgo(marketUpdatedAtMs, Date.now());

  const openTokenSearch = useCallback(() => {
    setTokenSearchOpen(true);
    setTokenSearchQuery("");
  }, []);

  const openDexScreenerSearch = useCallback(() => {
    const q = tokenSearchQuery.trim();
    if (!q) return;
    window.open(
      `https://dexscreener.com/search?q=${encodeURIComponent(q)}`,
      "_blank",
      "noopener,noreferrer"
    );
  }, [tokenSearchQuery]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const tag = t?.tagName?.toLowerCase();
      const inInput =
        tag === "input" ||
        tag === "textarea" ||
        (t != null && (t as any).isContentEditable);

      if (e.key === "Escape") {
        if (tokenSearchOpen) setTokenSearchOpen(false);
        return;
      }

      if (inInput) return;

      if (e.key === "/") {
        e.preventDefault();
        openTokenSearch();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [openTokenSearch, tokenSearchOpen]);

  return (
    <>
      <header className={`sticky top-0 z-50 ${dashboardChrome.topBar}`} role="banner">
      {/* TOP ROW (existing header content) */}
      <div className="flex items-center justify-between px-4 sm:px-6 py-2">
        <div className="min-w-0 flex-1" aria-hidden />

        <div className="flex shrink-0 items-center gap-3">
          {status === "loading" ? (
            <div className="h-9 w-24 animate-pulse rounded-md bg-zinc-800/80" />
          ) : (
            <>
              <button
                type="button"
                onClick={openTokenSearch}
                className="hidden h-9 items-center gap-2 rounded-lg border border-zinc-800/70 bg-zinc-900/25 px-3 text-sm text-zinc-300 transition hover:border-zinc-700 hover:bg-zinc-900/40 hover:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-[color:var(--accent)]/20 sm:flex"
                aria-label="Open token search"
              >
                <span className="text-zinc-400">Search…</span>
                <span className="rounded-md border border-zinc-800/70 bg-zinc-900/30 px-1.5 py-0.5 text-[11px] font-semibold text-zinc-400">
                  /
                </span>
              </button>
              <div className="relative" ref={notifRef}>
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
                  {activeNotificationCount > 0 ? (
                    <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[color:var(--accent)] px-1 text-[10px] font-semibold leading-none text-black">
                      {activeNotificationCount > 99
                        ? "99+"
                        : activeNotificationCount}
                    </span>
                  ) : null}
                </button>
                {openNotifications ? (
                  <div
                    className="absolute right-0 z-50 mt-2 max-h-96 w-80 overflow-y-auto rounded-xl border border-[#1a1a1a] bg-[#0a0a0a] shadow-xl"
                    role="region"
                    aria-label="Notification list"
                  >
                    {notifications.length === 0 ? (
                      <p className="px-4 py-8 text-center text-sm text-zinc-500">
                        No notifications yet
                      </p>
                    ) : (
                      <ul className="divide-y divide-[#1a1a1a]">
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
                    )}
                  </div>
                ) : null}
              </div>

              {session ? (
                <div className="relative" ref={menuRef}>
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
                    <span className="max-w-[140px] truncate text-left text-sm font-medium text-zinc-100 sm:max-w-[200px]">
                      {session.user?.name ?? "User"}
                    </span>
                  </button>
                  {open ? (
                    <div
                      className="absolute right-0 top-full z-50 mt-2 min-w-[220px] rounded-lg border border-[#1a1a1a] bg-[#0a0a0a] py-1 shadow-lg"
                      role="menu"
                    >
                      <Link
                        href={`/user/${encodeURIComponent(session.user.id)}`}
                        role="menuitem"
                        onClick={() => setOpen(false)}
                        className={accountMenuItem(
                          pathname === `/user/${session.user.id}` ||
                            pathname === `/user/${encodeURIComponent(session.user.id)}`
                        )}
                      >
                        Profile
                      </Link>
                      <Link
                        href="/settings"
                        role="menuitem"
                        onClick={() => setOpen(false)}
                        className={accountMenuItem(pathname.startsWith("/settings"))}
                      >
                        Settings
                      </Link>
                      <Link
                        href="/help"
                        role="menuitem"
                        aria-keyshortcuts="Shift+/"
                        onClick={() => setOpen(false)}
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

                      <div className="my-1 border-t border-[#1a1a1a]" />
                      <div className="px-4 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-600">
                        Referrals
                      </div>
                      <Link
                        href="/referrals"
                        role="menuitem"
                        onClick={() => setOpen(false)}
                        className={accountMenuItem(pathname === "/referrals")}
                      >
                        Overview
                      </Link>
                      <Link
                        href="/referrals/performance"
                        role="menuitem"
                        onClick={() => setOpen(false)}
                        className={accountMenuItem(pathname === "/referrals/performance")}
                      >
                        Performance
                      </Link>
                      <Link
                        href="/referrals/rewards"
                        role="menuitem"
                        onClick={() => setOpen(false)}
                        className={accountMenuItem(pathname === "/referrals/rewards")}
                      >
                        Rewards
                      </Link>

                      <div className="my-1 border-t border-[#1a1a1a]" />
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
          <div className="relative z-10 px-4 py-2 text-xs sm:px-6">
            {marketLoading ? (
              <div className="flex w-full justify-end">
                <span className="text-zinc-600">Loading market…</span>
              </div>
            ) : market ? (
              <div className="flex w-full flex-wrap items-center justify-end gap-x-3 gap-y-1.5 text-zinc-500">
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

                <span className="rounded-md border border-zinc-800/55 bg-zinc-900/55 px-2 py-1 text-zinc-400">
                  PumpFun Vol{" "}
                  <span className="font-medium text-zinc-200">{formatUsdCompact(market.pumpVolume)}</span>
                </span>

                <span className="rounded-md border border-zinc-800/55 bg-zinc-900/55 px-2 py-1 text-zinc-400">
                  Traders <span className="font-medium text-zinc-200">{formatCount(market.activeTraders)}</span>
                </span>

                <span className="shrink-0 text-zinc-500">
                  Updated{" "}
                  <span className="font-medium tabular-nums text-zinc-300">{marketUpdatedLabel}</span>
                </span>
              </div>
            ) : (
              <div className="flex w-full justify-end">
                <span className="text-zinc-600">Market unavailable</span>
              </div>
            )}
          </div>
        </div>
      )}
      <div className={dashboardChrome.topBarBottomRule} aria-hidden />
      </header>

      {mounted
        ? createPortal(
            <TokenSearchModal
              open={tokenSearchOpen}
              query={tokenSearchQuery}
              setQuery={setTokenSearchQuery}
              onClose={() => setTokenSearchOpen(false)}
              onSearch={openDexScreenerSearch}
            />,
            document.body
          )
        : null}
    </>
  );
}

function TokenSearchModal({
  open,
  query,
  setQuery,
  onClose,
  onSearch,
}: {
  open: boolean;
  query: string;
  setQuery: (v: string) => void;
  onClose: () => void;
  onSearch: () => void;
}) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-black/60 px-4 py-10"
      role="dialog"
      aria-modal="true"
      aria-label="Token search"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="mt-10 w-full max-w-xl rounded-xl border border-[#1a1a1a] bg-[#0a0a0a] p-4 shadow-xl shadow-black/50 backdrop-blur">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-zinc-100">Token Search</h3>
            <p className="mt-1 text-xs text-zinc-500">
              Paste a contract address, symbol, or pair name.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-[#1a1a1a] bg-[#0a0a0a] px-2 py-1 text-xs text-zinc-300 hover:bg-[#0a0a0a]"
            aria-label="Close"
          >
            Esc
          </button>
        </div>

        <div className="mt-4 space-y-3">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g. So111... / SOL / WIF"
            className="w-full rounded-lg border border-[#1a1a1a] bg-[#050505] px-3 py-2 text-sm text-zinc-200 outline-none ring-[color:var(--accent)]/20 focus:ring-2"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") onSearch();
            }}
          />

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-[#1a1a1a] bg-[#0a0a0a] px-3 py-1.5 text-xs font-medium text-zinc-300 hover:bg-[#0a0a0a]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onSearch}
              disabled={query.trim() === ""}
              className="rounded-md bg-[color:var(--accent)] px-3 py-1.5 text-xs font-medium text-black shadow-lg shadow-black/40 transition hover:bg-green-500 disabled:opacity-60"
            >
              Search
            </button>
          </div>

          <p className="text-xs text-zinc-500">
            Tip: press <span className="font-semibold text-zinc-300">/</span>{" "}
            anywhere to open this.
          </p>
        </div>
      </div>
    </div>
  );
}
