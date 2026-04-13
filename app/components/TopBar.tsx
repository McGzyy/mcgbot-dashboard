"use client";

import { useNotifications } from "@/app/contexts/NotificationsContext";
import Link from "next/link";
import { signIn, signOut, useSession } from "next-auth/react";
import { useEffect, useRef, useState } from "react";

type MarketSnapshot = {
  solPrice: number;
  change24h: number;
  pumpVolume: number;
  activeTraders: number;
};

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
  const { notifications } = useNotifications();
  const activeNotificationCount = notifications.filter((n) => !n.exiting).length;
  const [market, setMarket] = useState<MarketSnapshot | null>(null);
  const [marketLoading, setMarketLoading] = useState(true);
  const [showMarketWidget, setShowMarketWidget] = useState(true);
  const [open, setOpen] = useState(false);
  const [openNotifications, setOpenNotifications] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    setMarketLoading(true);

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
        setMarket({
          solPrice,
          change24h: Number.isFinite(change24h) ? change24h : 0,
          pumpVolume: Number.isFinite(pumpVolume) ? pumpVolume : 0,
          activeTraders: Number.isFinite(activeTraders) ? activeTraders : 0,
        });
      })
      .catch(() => {
        if (!cancelled) setMarket(null);
      })
      .finally(() => {
        if (!cancelled) setMarketLoading(false);
      });

    return () => {
      cancelled = true;
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
      ? "text-emerald-400"
      : market != null
        ? "text-red-400"
        : "text-zinc-300";

  return (
    <header
      className="sticky top-0 z-50 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-zinc-800 bg-zinc-900/80 px-4 py-2 text-sm backdrop-blur sm:px-6"
      role="banner"
    >
      {showMarketWidget ? (
        <div
          className="flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-1"
          role="region"
          aria-label="Market pulse"
        >
          {marketLoading ? (
            <p className="text-zinc-500">Loading market...</p>
          ) : market != null ? (
            <p className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-sm">
              <span className={`font-medium tabular-nums ${solLineClass}`}>
                📊 SOL {formatSolUsd(market.solPrice)} (
                {formatPctChange(market.change24h)})
              </span>
              <span className="text-zinc-600" aria-hidden>
                |
              </span>
              <span className="tabular-nums text-zinc-400">
                PumpFun Vol: {formatUsdCompact(market.pumpVolume)}
              </span>
              <span className="text-zinc-600" aria-hidden>
                |
              </span>
              <span className="tabular-nums text-zinc-400">
                Traders: {formatCount(market.activeTraders)}
              </span>
            </p>
          ) : (
            <p className="text-zinc-500">Market unavailable</p>
          )}
        </div>
      ) : (
        <div className="min-w-0 flex-1" aria-hidden />
      )}

      <div className="flex shrink-0 items-center gap-3">
        {status === "loading" ? (
          <div className="h-9 w-24 animate-pulse rounded-md bg-zinc-800/80" />
        ) : (
          <>
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
                  <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-emerald-500 px-1 text-[10px] font-semibold leading-none text-zinc-950">
                    {activeNotificationCount > 99
                      ? "99+"
                      : activeNotificationCount}
                  </span>
                ) : null}
              </button>
              {openNotifications ? (
                <div
                  className="absolute right-0 z-50 mt-2 max-h-96 w-80 overflow-y-auto rounded-xl border border-zinc-800 bg-zinc-900 shadow-xl"
                  role="region"
                  aria-label="Notification list"
                >
                  {notifications.length === 0 ? (
                    <p className="px-4 py-8 text-center text-sm text-zinc-500">
                      No notifications yet
                    </p>
                  ) : (
                    <ul className="divide-y divide-zinc-800">
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
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setOpen((o) => !o);
                      setOpenNotifications(false);
                    }}
                    className="shrink-0 rounded-full border border-transparent transition hover:ring-2 hover:ring-zinc-600 focus:outline-none focus:ring-2 focus:ring-sky-500/40"
                    aria-expanded={open}
                    aria-haspopup="menu"
                    aria-label="Open account menu"
                  >
                    {session.user?.image ? (
                      <img
                        src={session.user.image}
                        alt=""
                        className="h-9 w-9 rounded-full border border-zinc-700 object-cover"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="flex h-9 w-9 items-center justify-center rounded-full border border-zinc-700 bg-zinc-800 text-xs font-medium text-zinc-400">
                        {(session.user?.name ?? "?")
                          .slice(0, 1)
                          .toUpperCase()}
                      </div>
                    )}
                  </button>
                  <span className="max-w-[140px] truncate text-sm font-medium text-zinc-300 sm:max-w-[200px]">
                    {session.user?.name ?? "User"}
                  </span>
                </div>
                {open ? (
                  <div
                    className="absolute right-0 top-full z-50 mt-2 min-w-[180px] rounded-lg border border-zinc-800 bg-zinc-900 py-1 shadow-lg"
                    role="menu"
                  >
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => setOpen(false)}
                      className="w-full px-4 py-2.5 text-left text-sm text-zinc-500 transition hover:bg-zinc-800 hover:text-zinc-300"
                    >
                      Profile
                    </button>
                    <Link
                      href="/settings"
                      role="menuitem"
                      onClick={() => setOpen(false)}
                      className="block w-full px-4 py-2.5 text-left text-sm text-zinc-200 transition hover:bg-zinc-800"
                    >
                      Settings
                    </Link>
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
                onClick={() => signIn("discord")}
                className="rounded-lg bg-[#5865F2] px-3 py-2 text-sm font-semibold text-white transition hover:bg-[#4752c4] focus:outline-none focus:ring-2 focus:ring-sky-500/50"
              >
                Login with Discord
              </button>
            )}
          </>
        )}
      </div>
    </header>
  );
}
