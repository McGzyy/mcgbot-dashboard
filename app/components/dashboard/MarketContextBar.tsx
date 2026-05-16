"use client";

import { useEffect, useState } from "react";

type MarketSnap = {
  solPrice: number;
  change24h: number;
  btcPrice: number;
  btcChange24h: number;
};

function formatUsd(price: number): string {
  if (!Number.isFinite(price) || price <= 0) return "—";
  if (price >= 1_000_000) return `$${(price / 1_000_000).toFixed(2)}M`;
  if (price >= 10_000) return `$${(price / 1_000).toFixed(1)}k`;
  if (price >= 1_000) return `$${price.toFixed(0)}`;
  return `$${price.toFixed(2)}`;
}

function formatChg(pct: number): string {
  if (!Number.isFinite(pct)) return "—";
  return `${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%`;
}

function AssetPill({
  label,
  price,
  change24h,
}: {
  label: string;
  price: string;
  change24h: number;
}) {
  const up = change24h >= 0;
  return (
    <div
      className={`flex min-w-0 items-center gap-2 rounded-lg border px-2.5 py-1.5 sm:px-3 ${
        up
          ? "border-emerald-500/25 bg-emerald-500/[0.07]"
          : "border-red-500/20 bg-red-500/[0.06]"
      }`}
    >
      <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-500">{label}</span>
      <span className="truncate text-sm font-bold tabular-nums text-zinc-100">{price}</span>
      <span
        className={`shrink-0 text-[11px] font-semibold tabular-nums ${
          up ? "text-emerald-300/95" : "text-red-300/90"
        }`}
      >
        {formatChg(change24h)}
      </span>
    </div>
  );
}

/** SOL/BTC regime strip — common on trading terminals for macro context. */
export function MarketContextBar() {
  const [snap, setSnap] = useState<MarketSnap | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/market", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((j: unknown) => {
        if (cancelled || !j || typeof j !== "object") return;
        const o = j as Record<string, unknown>;
        const solPrice = Number(o.solPrice);
        if (!Number.isFinite(solPrice)) return;
        setSnap({
          solPrice,
          change24h: Number(o.change24h) || 0,
          btcPrice: Number(o.btcPrice) || 0,
          btcChange24h: Number(o.btcChange24h) || 0,
        });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  if (!snap) {
    return (
      <div
        className="flex min-w-0 flex-wrap gap-2"
        aria-hidden
        data-tutorial="dashboard.marketContext"
      >
        <div className="h-9 w-28 animate-pulse rounded-lg border border-zinc-800/60 bg-zinc-900/40" />
        <div className="h-9 w-28 animate-pulse rounded-lg border border-zinc-800/60 bg-zinc-900/40" />
      </div>
    );
  }

  return (
    <div
      className="flex min-w-0 flex-wrap items-center gap-2"
      data-tutorial="dashboard.marketContext"
    >
      <AssetPill label="SOL" price={formatUsd(snap.solPrice)} change24h={snap.change24h} />
      <AssetPill label="BTC" price={formatUsd(snap.btcPrice)} change24h={snap.btcChange24h} />
      <p className="hidden text-[10px] text-zinc-600 sm:block">24h · CoinGecko</p>
    </div>
  );
}
