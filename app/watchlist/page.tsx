"use client";

import Link from "next/link";

const MOCK_WATCHLIST = [
  { symbol: "WIF", note: "Momentum", change: "+8.2%", mcap: "$312.4M" },
  { symbol: "JUP", note: "Support", change: "-1.4%", mcap: "$1.2B" },
  { symbol: "BONK", note: "Breakout", change: "+3.0%", mcap: "$1.8B" },
  { symbol: "PYTH", note: "Earnings", change: "+0.9%", mcap: "$612.0M" },
] as const;

export default function WatchlistPage() {
  return (
    <div className="mx-auto max-w-[1200px] px-4 sm:px-6 py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-zinc-100">
            Watchlist
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Your pinned tokens for quick monitoring. Editing and alerts coming soon.
          </p>
        </div>
        <Link
          href="/"
          className="rounded-lg border border-[#1a1a1a] bg-[#0a0a0a] px-3 py-2 text-sm font-semibold text-zinc-200 transition hover:border-[#2a2a2a] hover:bg-zinc-900/30"
        >
          Back to Dashboard
        </Link>
      </div>

      <div className="mt-6 rounded-xl border border-zinc-900 bg-zinc-950/40 p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {MOCK_WATCHLIST.map((row) => (
            <div
              key={row.symbol}
              className="rounded-xl border border-[#1a1a1a] bg-gradient-to-b from-zinc-900/55 to-zinc-900/25 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-zinc-100">
                    {row.symbol}
                  </div>
                  <div className="mt-1 text-xs text-zinc-500">{row.note}</div>
                </div>
                <span className="rounded-full border border-zinc-700/60 bg-zinc-900/40 px-2.5 py-0.5 text-[11px] font-medium tabular-nums text-zinc-200">
                  {row.mcap}
                </span>
              </div>
              <div
                className={`mt-4 text-sm font-semibold tabular-nums ${
                  row.change.startsWith("+")
                    ? "text-[color:var(--accent)]"
                    : row.change.startsWith("-")
                      ? "text-red-400"
                      : "text-zinc-400"
                }`}
              >
                {row.change}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 rounded-xl border border-dashed border-zinc-800 bg-zinc-900/20 p-4">
          <p className="text-sm text-zinc-400">
            Next: add token search + pin/unpin + alerts from here.
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            For now, use the top search (<span className="font-semibold text-zinc-300">/</span>) and
            keep this page as the destination for your future pinned list.
          </p>
        </div>
      </div>
    </div>
  );
}

