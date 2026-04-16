'use client';

import { useEffect, useRef, useState } from "react";

type MarketSnapshot = {
  solPrice: number;
  change24h: number;
  pumpVolume: number;
  activeTraders: number;
};

export default function MarketPanel() {
  const [market, setMarket] = useState<MarketSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const prevPrice = useRef<number | null>(null);
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/market")
      .then((res) => res.json())
      .then((data) => {
        if (cancelled || !data) return;

        const solPrice = Number(data.solPrice);
        const change24h = Number(data.change24h);
        const pumpVolume = Number(data.pumpVolume);
        const activeTraders = Number(data.activeTraders);

        if (!Number.isFinite(solPrice)) return;

        if (prevPrice.current !== null && solPrice !== prevPrice.current) {
          setFlash(true);
          setTimeout(() => setFlash(false), 300);
        }
        prevPrice.current = solPrice;

        setMarket({
          solPrice,
          change24h,
          pumpVolume,
          activeTraders,
        });
      })
      .catch(() => setMarket(null))
      .finally(() => setLoading(false));

    return () => {
      cancelled = true;
    };
  }, []);

  const color =
    market && market.change24h >= 0
      ? "text-[#39FF14]"
      : "text-red-400";

  return (
    <div className="flex items-center gap-3 text-sm text-zinc-400">
      {loading ? (
        <span className="text-zinc-500">Loading market...</span>
      ) : market ? (
        <>
          <span className={`font-medium tabular-nums text-white ${flash ? "animate-pulse" : ""} transition`}>
            📊 SOL ${market.solPrice.toFixed(2)}
          </span>
          <span className={`tabular-nums ${color}`}>
            ({market.change24h.toFixed(2)}%)
          </span>

          <span className="text-zinc-600">|</span>

          <span className="text-zinc-400">
            PumpFun Vol: ${Math.round(market.pumpVolume / 1e6)}M
          </span>

          <span className="text-zinc-600">|</span>

          <span className="text-zinc-400">
            Traders: {market.activeTraders.toLocaleString()}
          </span>
        </>
      ) : (
        <span className="text-zinc-500">Market unavailable</span>
      )}
    </div>
  );
}

