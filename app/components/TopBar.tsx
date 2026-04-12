"use client";

import Link from "next/link";
import { signIn, signOut, useSession } from "next-auth/react";
import { useEffect, useRef, useState } from "react";

type MarketSnapshot = {
  solPrice: number;
  solChangePct: number;
};

export function TopBar() {
  const { data: session, status } = useSession();
  const [market, setMarket] = useState<MarketSnapshot | null>(null);
  const [marketLoading, setMarketLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    setMarketLoading(true);

    fetch("/api/market")
      .then((res) => res.json())
      .then((data: unknown) => {
        if (cancelled || !data || typeof data !== "object") return;
        const o = data as Record<string, unknown>;
        const solPrice = Number(o.solPrice);
        const solChangePct = Number(o.solChangePct);
        if (!Number.isFinite(solPrice) || !Number.isFinite(solChangePct)) return;
        setMarket({ solPrice, solChangePct });
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
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const solLineClass =
    market != null && market.solChangePct >= 0
      ? "text-emerald-400"
      : market != null
        ? "text-red-400"
        : "text-zinc-300";

  return (
    <header
      className="sticky top-0 z-50 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-zinc-800 bg-zinc-900/80 px-4 py-2 text-sm backdrop-blur sm:px-6"
      role="banner"
    >
      <div
        className="flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-1"
        role="region"
        aria-label="Market pulse"
      >
        {marketLoading ? (
          <p className="text-zinc-500">Loading market...</p>
        ) : (
          <>
            <p className={`min-w-0 font-medium tabular-nums ${solLineClass}`}>
              📊 SOL{" "}
              {market != null ? `$${market.solPrice.toFixed(2)}` : "$—"} (
              {market != null
                ? `${market.solChangePct >= 0 ? "+" : ""}${market.solChangePct.toFixed(1)}%`
                : "—"}
              )
            </p>
            <p className="shrink-0 text-zinc-500">
              PumpFun Vol: — | Active Traders: —
            </p>
          </>
        )}
      </div>

      <div className="relative flex shrink-0 items-center gap-3" ref={menuRef}>
        {status === "loading" ? (
          <div className="h-9 w-24 animate-pulse rounded-md bg-zinc-800/80" />
        ) : session ? (
          <>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setOpen((o) => !o)}
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
                    {(session.user?.name ?? "?").slice(0, 1).toUpperCase()}
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
          </>
        ) : (
          <button
            type="button"
            onClick={() => signIn("discord")}
            className="rounded-lg bg-[#5865F2] px-3 py-2 text-sm font-semibold text-white transition hover:bg-[#4752c4] focus:outline-none focus:ring-2 focus:ring-sky-500/50"
          >
            Login with Discord
          </button>
        )}
      </div>
    </header>
  );
}
