"use client";

import { useMemo, useState } from "react";
import PanelCard from "@/components/PanelCard";

type WindowId = "rolling24h" | "today";

type LeaderRow = {
  username: string;
  calls: number;
};

const MOCK_TODAY: LeaderRow[] = [
  { username: "alpha_sniper", calls: 22 },
  { username: "trend_hunter", calls: 19 },
  { username: "sol_scanner", calls: 16 },
  { username: "degen_dev", calls: 12 },
  { username: "user_caller_1", calls: 9 },
];

const MOCK_24H: LeaderRow[] = [
  { username: "trend_hunter", calls: 31 },
  { username: "alpha_sniper", calls: 27 },
  { username: "sol_scanner", calls: 23 },
  { username: "user_caller_1", calls: 18 },
  { username: "degen_dev", calls: 14 },
];

function badgeStyleForRank(rank: number): string {
  if (rank === 1) return "border-yellow-500/30 bg-yellow-500/10 text-yellow-200";
  if (rank === 2) return "border-zinc-500/40 bg-zinc-500/10 text-zinc-100";
  if (rank === 3) return "border-orange-500/30 bg-orange-500/10 text-orange-200";
  return "border-zinc-700/60 bg-zinc-900/40 text-zinc-200";
}

export default function DailyLeaderboardPanel() {
  const [windowId, setWindowId] = useState<WindowId>("rolling24h");

  const rows = useMemo(() => {
    const base = windowId === "today" ? MOCK_TODAY : MOCK_24H;
    return [...base].sort((a, b) => b.calls - a.calls).slice(0, 5);
  }, [windowId]);

  return (
    <PanelCard title="🏆 Daily Leaderboard" titleClassName="normal-case">
      <div className="mt-2 flex items-center justify-between gap-3">
        <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 p-1">
          <button
            type="button"
            onClick={() => setWindowId("rolling24h")}
            className={`rounded-md px-2 py-1 text-xs transition-all ${
              windowId === "rolling24h"
                ? "border border-zinc-500/30 bg-zinc-500/10 font-semibold text-zinc-100"
                : "text-zinc-500 hover:bg-white/5 hover:text-white"
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
                : "text-zinc-500 hover:bg-white/5 hover:text-white"
            }`}
          >
            Today
          </button>
        </div>
        <div className="text-[11px] text-zinc-500">
          {windowId === "rolling24h" ? "Rolling 24h" : "Resets daily"}
        </div>
      </div>

      <div className="mt-3 rounded-xl border border-zinc-900 bg-zinc-950/40 p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
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
      </div>
    </PanelCard>
  );
}

