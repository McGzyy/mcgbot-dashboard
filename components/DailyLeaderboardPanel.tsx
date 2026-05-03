"use client";

import { useEffect, useMemo, useState } from "react";
import PanelCard from "@/components/PanelCard";
import { terminalSurface } from "@/lib/terminalDesignTokens";

type WindowId = "rolling24h" | "today";

type LeaderRow = {
  username: string;
  calls: number;
};

function badgeStyleForRank(rank: number): string {
  if (rank === 1) return "border-yellow-500/30 bg-yellow-500/10 text-yellow-200";
  if (rank === 2) return "border-zinc-500/40 bg-zinc-500/10 text-zinc-100";
  if (rank === 3) return "border-orange-500/30 bg-orange-500/10 text-orange-200";
  return "border-zinc-700/60 bg-zinc-900/40 text-zinc-200";
}

export default function DailyLeaderboardPanel() {
  const [windowId, setWindowId] = useState<WindowId>("rolling24h");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<LeaderRow[]>([]);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    void (async () => {
      try {
        const res = await fetch(
          `/api/leaderboard/daily?window=${encodeURIComponent(windowId)}`,
          { signal: controller.signal }
        );
        const json = (await res.json().catch(() => ({}))) as {
          success?: boolean;
          rows?: LeaderRow[];
          error?: string;
        };
        if (cancelled) return;
        if (!res.ok || json.success !== true || !Array.isArray(json.rows)) {
          setError(typeof json.error === "string" ? json.error : "Could not load leaderboard.");
          setData([]);
          return;
        }
        setData(json.rows);
        setError(null);
      } catch (e) {
        if (cancelled) return;
        setError("Could not load leaderboard.");
        setData([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [windowId]);

  const rows = useMemo(() => {
    return [...data].sort((a, b) => b.calls - a.calls).slice(0, 5);
  }, [data]);

  return (
    <PanelCard title="Daily leaderboard" titleClassName="normal-case">
      <div className="mt-2 flex items-center justify-between gap-3">
        <div className="flex items-center gap-1 rounded-lg border border-zinc-700/50 bg-zinc-900/40 p-1">
          <button
            type="button"
            onClick={() => setWindowId("rolling24h")}
            className={`rounded-md px-2 py-1 text-xs transition-all ${
              windowId === "rolling24h"
                ? "border border-zinc-500/30 bg-zinc-500/10 font-semibold text-zinc-100"
                : "text-zinc-500 hover:bg-zinc-800/40 hover:text-white"
            }`}
          >
            24h
          </button>
          <button
            type="button"
            onClick={() => setWindowId("today")}
            className={`rounded-md px-2 py-1 text-xs transition-all ${
              windowId === "today"
                ? "border border-zinc-500/30 bg-zinc-500/10 font-semibold text-zinc-100"
                : "text-zinc-500 hover:bg-zinc-800/40 hover:text-white"
            }`}
          >
            Today
          </button>
        </div>
        <div className="text-[11px] text-zinc-500">
          {loading ? "Loading…" : windowId === "rolling24h" ? "Rolling 24h" : "Resets daily"}
        </div>
      </div>

      <div
        className={`mt-3 rounded-xl border border-zinc-900 bg-zinc-950/40 p-2 ${terminalSurface.insetEdgeSoft}`}
      >
        {error ? (
          <div className="flex min-h-[90px] items-center justify-center px-3 py-6 text-center">
            <p className="text-sm text-red-200/90">{error}</p>
          </div>
        ) : loading && rows.length === 0 ? (
          <div className="flex min-h-[90px] items-center justify-center px-3 py-6">
            <p className="text-sm text-zinc-500">Loading…</p>
          </div>
        ) : rows.length === 0 ? (
          <div className="flex min-h-[90px] items-center justify-center px-3 py-6 text-center">
            <p className="text-sm text-zinc-500">No calls yet. Leaderboards populate once calls start coming in.</p>
          </div>
        ) : (
          <ul className="space-y-1">
            {rows.map((row, idx) => {
              const rank = idx + 1;
              return (
                <li
                  key={`${windowId}-${row.username}`}
                  className="flex items-center justify-between gap-3 rounded-lg border border-[#1a1a1a] bg-zinc-900/20 px-3 py-2 transition-colors hover:bg-zinc-900/35"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="w-6 shrink-0 text-center text-xs font-semibold tabular-nums text-zinc-500">
                      #{rank}
                    </span>
                    <span className="min-w-0 truncate text-sm font-semibold text-zinc-100">
                      {row.username}
                    </span>
                  </div>
                  <span
                    className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[11px] font-medium tabular-nums ${badgeStyleForRank(
                      rank
                    )}`}
                  >
                    {row.calls} calls
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </PanelCard>
  );
}

