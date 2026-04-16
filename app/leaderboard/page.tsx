"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type TimeframeId = "daily" | "weekly" | "monthly" | "all";

type LeaderRow = {
  rank: number;
  username: string;
  avgX: number;
  bestX: number;
  calls: number;
  winRate?: number;
};

type TopCallRow = {
  symbol: string;
  multiplier: number;
  username: string;
  timestamp: string;
  callToATH: string;
};

type LeaderCard = {
  label: "Daily Leader" | "Weekly Leader" | "Monthly Leader";
  username: string;
  bestCall: string;
  multiplier: number;
  avg: number;
  best: number;
  calls: number;
  winRate: number;
  coin?: string;
};

const TIMEFRAMES: { id: TimeframeId; label: string }[] = [
  { id: "daily", label: "Daily" },
  { id: "weekly", label: "Weekly" },
  { id: "monthly", label: "Monthly" },
  { id: "all", label: "All" },
];

const MOCK_USERS: Record<TimeframeId, LeaderRow[]> = {
  daily: [
    { rank: 1, username: "user_1", avgX: 2.8, bestX: 4.2, calls: 5, winRate: 62 },
    { rank: 2, username: "user_2", avgX: 2.1, bestX: 3.4, calls: 4, winRate: 50 },
    { rank: 3, username: "user_3", avgX: 1.7, bestX: 2.6, calls: 6, winRate: 33 },
  ],
  weekly: [
    { rank: 1, username: "SignalKing", avgX: 3.3, bestX: 6.1, calls: 22, winRate: 58 },
    { rank: 2, username: "Luna", avgX: 2.9, bestX: 5.0, calls: 19, winRate: 53 },
    { rank: 3, username: "Dex", avgX: 2.6, bestX: 4.4, calls: 17, winRate: 49 },
  ],
  monthly: [
    { rank: 1, username: "mcgzzy", avgX: 3.8, bestX: 8.4, calls: 61, winRate: 55 },
    { rank: 2, username: "Artemis", avgX: 3.1, bestX: 7.0, calls: 54, winRate: 51 },
    { rank: 3, username: "Nova", avgX: 2.7, bestX: 5.9, calls: 47, winRate: 46 },
  ],
  all: [
    { rank: 1, username: "ArcRunner", avgX: 3.5, bestX: 10.2, calls: 240, winRate: 52 },
    { rank: 2, username: "WhaleWatcher", avgX: 3.0, bestX: 9.1, calls: 211, winRate: 48 },
    { rank: 3, username: "TapeReader", avgX: 2.6, bestX: 7.8, calls: 198, winRate: 44 },
  ],
};

const MOCK_TOP_CALLS: TopCallRow[] = [
  { symbol: "SOLX", multiplier: 4.2, username: "user_1", timestamp: "2h ago", callToATH: "12m" },
  { symbol: "ALPHA", multiplier: 3.8, username: "SignalKing", timestamp: "5h ago", callToATH: "48m" },
  { symbol: "DGN", multiplier: 3.1, username: "mcgzzy", timestamp: "1d ago", callToATH: "2h" },
  { symbol: "PEPE2", multiplier: 2.4, username: "Luna", timestamp: "2d ago", callToATH: "6h" },
  { symbol: "JUP", multiplier: 1.9, username: "Dex", timestamp: "3d ago", callToATH: "1d" },
];

const trendingNow = {
  symbol: "SOLX",
  user: "user_1",
  multiplier: 3.8,
  timeAgo: "12m ago",
};

const mostActive = {
  user: "SignalKing",
  calls1h: 6,
  calls24h: 18,
  avgPerDay: 4.1,
};

const MOCK_MCGBOT_TOP_CALLS: Record<TimeframeId, TopCallRow[]> = {
  daily: [
    { symbol: "BOME", multiplier: 3.4, username: "McGBot", timestamp: "30m ago", callToATH: "7m" },
    { symbol: "WIF", multiplier: 2.8, username: "McGBot", timestamp: "1h ago", callToATH: "22m" },
    { symbol: "BONK", multiplier: 2.1, username: "McGBot", timestamp: "3h ago", callToATH: "1h" },
  ],
  weekly: [
    { symbol: "SOLX", multiplier: 5.2, username: "McGBot", timestamp: "Tue", callToATH: "35m" },
    { symbol: "DEV123", multiplier: 4.1, username: "McGBot", timestamp: "Wed", callToATH: "2h" },
    { symbol: "ABC", multiplier: 3.6, username: "McGBot", timestamp: "Thu", callToATH: "4h" },
  ],
  monthly: [
    { symbol: "ALPHA", multiplier: 6.6, username: "McGBot", timestamp: "Apr 2", callToATH: "1h" },
    { symbol: "DGN", multiplier: 5.9, username: "McGBot", timestamp: "Apr 8", callToATH: "3h" },
    { symbol: "SOLX", multiplier: 5.1, username: "McGBot", timestamp: "Apr 12", callToATH: "52m" },
  ],
  all: [
    { symbol: "APEX", multiplier: 8.0, username: "McGBot", timestamp: "Mar 2026", callToATH: "1d" },
    { symbol: "MOON", multiplier: 7.2, username: "McGBot", timestamp: "Feb 2026", callToATH: "2d" },
    { symbol: "GEM", multiplier: 6.2, username: "McGBot", timestamp: "Jan 2026", callToATH: "3d" },
  ],
};

const MOCK_LEADERS: LeaderCard[] = [
  { label: "Daily Leader", username: "user_1", bestCall: "SOLX", multiplier: 4.2, avg: 2.8, best: 4.2, calls: 5, winRate: 62 },
  { label: "Weekly Leader", username: "SignalKing", bestCall: "ALPHA", multiplier: 6.1, avg: 3.3, best: 6.1, calls: 22, winRate: 58 },
  { label: "Monthly Leader", username: "mcgzzy", bestCall: "DGN", multiplier: 8.4, avg: 3.8, best: 8.4, calls: 61, winRate: 55 },
];

function fmtX(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "—";
  return `${n.toFixed(1)}x`;
}

function parseCallToAthMinutes(value: string): number {
  const v = value.trim().toLowerCase();
  const m = v.match(/^(\d+)\s*m$/);
  if (m) return Number(m[1]);
  const h = v.match(/^(\d+)\s*h$/);
  if (h) return Number(h[1]) * 60;
  const d = v.match(/^(\d+)\s*d$/);
  if (d) return Number(d[1]) * 60 * 24;
  return Number.POSITIVE_INFINITY;
}

function symbolBadge(symbol: string) {
  const s = symbol.trim().toUpperCase();
  const letters = s.replace(/[^A-Z0-9]/g, "").slice(0, 2) || "—";
  return letters.length >= 2 ? letters.slice(0, 2) : `${letters}•`.slice(0, 2);
}

function TopCallsList({
  rows,
  tone = "default",
}: {
  rows: TopCallRow[];
  tone?: "default" | "muted";
}) {
  const sorted = useMemo(
    () => [...rows].sort((a, b) => b.multiplier - a.multiplier),
    [rows]
  );

  const shell =
    tone === "muted"
      ? "rounded-xl border border-[#1a1a1a]/80 bg-[#080808] p-3 opacity-[0.94]"
      : "rounded-xl border border-[#1a1a1a] bg-[#0a0a0a] p-3";

  return (
    <div className={shell}>
      <ul>
        {sorted.map((row, i) => {
          return (
            <li
              key={`${row.symbol}-${row.username}-${row.timestamp}-${i}`}
              className={`flex items-stretch justify-between gap-3 rounded-lg border px-3 py-2.5 transition-all duration-150 hover:bg-zinc-900/60 hover:border-zinc-700 border-b border-zinc-900 last:border-b-0 ${
                i === 0
                  ? "bg-emerald-500/5 border-emerald-500/20 shadow-[0_0_20px_rgba(34,197,94,0.08)]"
                  : "border-[#1a1a1a] bg-transparent"
              }`}
            >
              <div
                className={`my-0.5 w-[2px] rounded-full ${
                  i === 0 ? "bg-emerald-400" : "bg-zinc-700"
                }`}
                aria-hidden
              />
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <div className="w-7 shrink-0 text-right text-xs font-medium tabular-nums text-zinc-500">
                  #{i + 1}
                </div>
                <div
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#1a1a1a] bg-[#050505] text-[10px] font-bold tabular-nums text-zinc-300"
                  aria-hidden
                >
                  {symbolBadge(row.symbol)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="font-semibold text-zinc-100">{row.symbol}</span>
                    <span className="text-xs text-zinc-600">{row.username}</span>
                  </div>
                  <div className="mt-0.5 text-[11px] text-zinc-600">{row.timestamp}</div>
                </div>
              </div>
              <div className="shrink-0 text-right">
                <div
                  className={`text-base font-semibold tabular-nums ${
                    i === 0 ? "text-emerald-300" : "text-emerald-400"
                  }`}
                >
                  {fmtX(row.multiplier)}
                </div>
                <div className="text-[11px] text-zinc-500">{row.callToATH}</div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default function LeaderboardPage() {
  const router = useRouter();
  const [usersTimeframe, setUsersTimeframe] = useState<TimeframeId>("daily");
  const [mcgbotTimeframe, setMcgbotTimeframe] = useState<TimeframeId>("daily");

  useEffect(() => {
    const scrollToBot = () => {
      if (window.location.hash !== "#bot-performance") return;
      const el = document.getElementById("bot-performance");
      if (el) el.scrollIntoView({ behavior: "smooth" });
    };

    scrollToBot();
    window.addEventListener("hashchange", scrollToBot);
    return () => window.removeEventListener("hashchange", scrollToBot);
  }, []);

  const userRows = useMemo(
    () => MOCK_USERS[usersTimeframe] ?? [],
    [usersTimeframe]
  );
  const mcgbotRows = useMemo(
    () => MOCK_MCGBOT_TOP_CALLS[mcgbotTimeframe] ?? [],
    [mcgbotTimeframe]
  );

  const botAllCalls = useMemo(() => MOCK_MCGBOT_TOP_CALLS.all ?? [], []);

  const botSummary = useMemo(() => {
    const best = botAllCalls.reduce(
      (top, c) => (c.multiplier > top.multiplier ? c : top),
      botAllCalls[0] ?? {
        symbol: "—",
        multiplier: 0,
        username: "McGBot",
        timestamp: "—",
        callToATH: "—",
      }
    );

    const avgMultiplier =
      botAllCalls.length > 0
        ? botAllCalls.reduce((sum, c) => sum + c.multiplier, 0) / botAllCalls.length
        : 0;

    return {
      bestSymbol: best.symbol,
      bestMultiplier: best.multiplier,
      avgMultiplier,
      totalCalls: 18420,
      winRate: 54,
    };
  }, [botAllCalls]);

  const fastestBotCalls = useMemo(() => {
    return [...botAllCalls]
      .sort((a, b) => parseCallToAthMinutes(a.callToATH) - parseCallToAthMinutes(b.callToATH))
      .slice(0, 3);
  }, [botAllCalls]);

  const allUsers = useMemo(() => MOCK_USERS.all ?? [], []);

  const allTimeRecords = useMemo(() => {
    const highestMultiplierUser = allUsers.reduce(
      (best, r) => (r.bestX > best.bestX ? r : best),
      allUsers[0] ?? { rank: 0, username: "—", avgX: 0, bestX: 0, calls: 0 }
    );

    const bestAverageUser = allUsers.reduce(
      (best, r) => (r.avgX > best.avgX ? r : best),
      allUsers[0] ?? { rank: 0, username: "—", avgX: 0, bestX: 0, calls: 0 }
    );

    const mostCalls = allUsers.reduce(
      (best, r) => (r.calls > best.calls ? r : best),
      allUsers[0] ?? { rank: 0, username: "—", avgX: 0, bestX: 0, calls: 0 }
    );

    const bestWinRateUser = allUsers.reduce(
      (best, r) => ((r.winRate ?? -1) > (best.winRate ?? -1) ? r : best),
      allUsers[0] ?? { rank: 0, username: "—", avgX: 0, bestX: 0, calls: 0 }
    );

    return {
      highestMultiplierUser,
      bestAverageUser,
      mostCalls,
      bestWinRateUser,
    };
  }, [allUsers]);

  const Table = ({ rows }: { rows: LeaderRow[] }) => (
    <div className="rounded-xl border border-[#1a1a1a] bg-[#0a0a0a] p-4">
      <div className="overflow-x-auto">
        <div className="min-w-[720px]">
          <div className="flex items-end justify-between gap-4 border-b border-[#1a1a1a] pb-3 text-[10px] font-medium uppercase tracking-widest text-zinc-600 sm:text-[11px]">
            <div className="min-w-0 flex-1">User</div>
            <div className="flex items-end gap-3">
              <div className="text-right min-w-[60px]">Avg X</div>
              <div className="text-right min-w-[60px]">Best X</div>
            </div>
          </div>

          <div className="space-y-1 pt-2">
            {rows.map((r) => (
              <div
                key={`${r.rank}-${r.username}`}
                className={[
                  "flex items-center justify-between rounded-lg border px-3 py-2 transition-colors",
                  "hover:bg-zinc-900/60 hover:shadow-[0_0_8px_rgba(255,255,255,0.03)]",
                  r.rank === 1
                    ? "bg-yellow-500/5 border-yellow-500/10"
                    : "border-transparent",
                ].join(" ")}
              >
                <div className="min-w-0 flex-1 pr-3">
                  <div className="flex items-baseline gap-2">
                    <div className="shrink-0 text-xs tabular-nums text-zinc-500">#{r.rank}</div>
                    <div className="min-w-0 truncate text-sm font-medium text-zinc-200">
                      {r.username}
                    </div>
                  </div>
                  <div className="mt-0.5 pl-7 text-xs text-zinc-500">
                    {r.calls} calls
                    {typeof r.winRate === "number" ? ` · ${r.winRate.toFixed(0)}% win` : ""}
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-3">
                  <div className="text-right min-w-[60px] text-sm font-semibold tabular-nums text-[#39FF14]">
                    {fmtX(r.avgX)}
                  </div>
                  <div className="text-right min-w-[60px] text-sm font-semibold tabular-nums text-amber-300">
                    {fmtX(r.bestX)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  const sectionTitle = "text-base font-semibold tracking-tight text-zinc-100";

  return (
    <div className="mx-auto w-full max-w-[1100px] space-y-6 px-4 py-6">
      <div>
        <h1 className="text-xl font-semibold text-zinc-100">Leaderboard</h1>
        <p className="text-sm text-zinc-600">
          Leaders, records, top calls, and user rankings
        </p>
      </div>

      {/* 1) Leaders */}
      <section className="space-y-4">
        <div>
          <h2 className={sectionTitle}>Leaders</h2>
          <p className="mt-0.5 text-xs text-zinc-600">Top performers by period (mocked)</p>
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          {MOCK_LEADERS.map((w) => (
            <div
              key={w.label}
              className="relative group cursor-pointer"
              onClick={() => router.push(`/profile/${w.username}`)}
            >
              <div className="rounded-xl border border-[#2a2415] bg-gradient-to-br from-[#161308] via-[#0c0c0c] to-[#0a0a0a] p-6 shadow-[0_0_28px_rgba(255,215,0,0.12)] transition-shadow hover:shadow-[0_0_36px_rgba(255,215,0,0.18)]">
                <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-yellow-500/80">
                  {w.label}
                </p>
                <p className="text-base font-medium text-zinc-100">{w.username}</p>
                <p className="mt-3 text-xs text-zinc-600">Best call</p>
                <div className="mt-1 flex items-end justify-between gap-3">
                  <span className="text-sm font-medium text-zinc-200">{w.bestCall}</span>
                  <span className="text-2xl font-bold tabular-nums leading-none text-[#39FF14]">
                    {fmtX(w.multiplier)}
                  </span>
                </div>
                {w.coin ? (
                  <p className="mt-3 text-xs text-zinc-600">Coin: {w.coin}</p>
                ) : null}
              </div>

              <div
                className="absolute z-50 hidden w-64 top-full mt-2 rounded-xl border border-zinc-800 bg-[#0a0a0a] p-4 shadow-lg transition-all duration-150 group-hover:block"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="mb-2 text-sm font-medium text-zinc-100">{w.username}</div>
                <div className="space-y-1 text-xs text-zinc-400">
                  <div>Avg: {w.avg}x</div>
                  <div>Best: {w.best}x</div>
                  <div>Calls: {w.calls}</div>
                  <div>Win Rate: {w.winRate}%</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 2) All-Time Records */}
      <section className="space-y-4 border-t border-[#1a1a1a] pt-6">
        <div>
          <h2 className={sectionTitle}>All-Time Records</h2>
          <p className="mt-0.5 text-xs text-zinc-600">Standings across all timeframes (mocked)</p>
        </div>
        <div className="mb-6 rounded-xl border border-zinc-900 bg-zinc-950/40 p-4">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,2fr)_auto_minmax(0,1fr)] lg:items-stretch">
            <div className="grid h-full grid-cols-2 gap-3">
              <div className="rounded-xl border border-[#1a1a1a] bg-zinc-900/40 p-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-zinc-400">
                    Highest Multiplier
                  </p>
                <span className="text-base" aria-hidden>
                  ⚡
                </span>
              </div>
              <p className="mt-2.5 text-2xl font-bold tabular-nums tracking-tight text-[#39FF14]">
                {fmtX(allTimeRecords.highestMultiplierUser?.bestX ?? 0)}
              </p>
              <p className="mt-1.5 text-xs text-zinc-500">
                {allTimeRecords.highestMultiplierUser?.username ?? "—"}
              </p>
            </div>
              <div className="rounded-xl border border-[#1a1a1a] bg-zinc-900/40 p-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-zinc-400">
                    Best Average
                  </p>
                <span className="text-base" aria-hidden>
                  📈
                </span>
              </div>
              <p className="mt-2.5 text-2xl font-bold tabular-nums tracking-tight text-[#39FF14]">
                {fmtX(allTimeRecords.bestAverageUser?.avgX ?? 0)}
              </p>
              <p className="mt-1.5 text-xs text-zinc-500">
                {allTimeRecords.bestAverageUser?.username ?? "—"}
              </p>
            </div>
              <div className="rounded-xl border border-[#1a1a1a] bg-zinc-900/40 p-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-zinc-400">
                    Most Calls
                  </p>
                <span className="text-base" aria-hidden>
                  📞
                </span>
              </div>
              <p className="mt-2.5 text-2xl font-bold tabular-nums tracking-tight text-zinc-100">
                {Number.isFinite(allTimeRecords.mostCalls?.calls)
                  ? allTimeRecords.mostCalls?.calls
                  : "—"}
              </p>
              <p className="mt-1.5 text-xs text-zinc-500">
                {allTimeRecords.mostCalls?.username ?? "—"}
              </p>
            </div>
              <div className="rounded-xl border border-[#1a1a1a] bg-zinc-900/40 p-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-zinc-400">
                    Best Win Rate
                  </p>
                <span className="text-base" aria-hidden>
                  🎯
                </span>
              </div>
              <p className="mt-2.5 text-2xl font-bold tabular-nums tracking-tight text-zinc-100">
                {typeof allTimeRecords.bestWinRateUser?.winRate === "number"
                  ? `${allTimeRecords.bestWinRateUser.winRate.toFixed(0)}%`
                  : "—"}
              </p>
              <p className="mt-1.5 text-xs text-zinc-500">
                {allTimeRecords.bestWinRateUser?.username ?? "—"}
              </p>
            </div>
          </div>

            <div className="mx-2 hidden w-px bg-zinc-800 lg:block" />

            <div className="flex h-full flex-col gap-4">
              <div className="group relative overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/30 p-4">
              <div className="pointer-events-none absolute inset-0 bg-[#39FF14]/5 blur-2xl opacity-40 transition-opacity duration-300 group-hover:opacity-70" />

              <div className="relative z-10 flex items-center justify-between gap-6">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-xs text-zinc-300">
                    {trendingNow.symbol.slice(0, 2)}
                  </div>

                  <div className="min-w-0">
                    <div className="text-sm text-zinc-400">🔥 Trending Now (1h)</div>
                    <div className="truncate text-base font-semibold text-zinc-100">
                      {trendingNow.symbol}
                    </div>
                    <div className="text-xs text-zinc-500">
                      {trendingNow.user} • {trendingNow.timeAgo}
                    </div>
                  </div>
                </div>

                <div className="shrink-0 text-right">
                  <div className="text-base font-bold tabular-nums text-[#39FF14]">
                    {fmtX(trendingNow.multiplier)}
                  </div>
                  <div className="text-[10px] text-zinc-500">current</div>
                </div>
              </div>
            </div>

              <div className="group relative overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/30 p-4">
              <div className="pointer-events-none absolute inset-0 bg-zinc-500/5 blur-2xl opacity-35 transition-opacity duration-300 group-hover:opacity-55" />

              <div className="relative z-10 flex items-center justify-between gap-6">
                <div className="min-w-0">
                  <div className="text-sm text-zinc-400">⚡ Most Active (1h)</div>
                  <div className="truncate text-base font-semibold text-zinc-100">
                    {mostActive.user}
                  </div>
                  <div className="text-xs text-zinc-500">
                    {mostActive.calls1h} calls (1h) • {mostActive.calls24h} calls (24h)
                  </div>
                  <div className="mt-1 text-xs text-zinc-500">
                    Avg/day: {mostActive.avgPerDay.toFixed(1)} calls
                  </div>
                </div>

                <div className="shrink-0 text-right">
                  <div className="text-lg font-bold tabular-nums text-emerald-400">
                    {mostActive.calls1h}
                  </div>
                  <div className="text-[10px] text-zinc-500">calls (1h)</div>
                </div>
              </div>
            </div>
          </div>
        </div>
        </div>
      </section>

      {/* USER PERFORMANCE */}
      <div className="mt-10 rounded-xl border border-zinc-900 bg-[#050505]/60 p-5">
        <div className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-3">
          User Performance
        </div>

        {/* User Leaderboard */}
        <section className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className={sectionTitle}>User Leaderboard</h2>
              <p className="mt-0.5 text-xs text-zinc-600">Leaderboard table (mocked)</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {TIMEFRAMES.map((tf) => {
                const active = usersTimeframe === tf.id;
                return (
                  <button
                    key={tf.id}
                    type="button"
                    onClick={() => setUsersTimeframe(tf.id)}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                      active
                        ? "border-[#39FF14]/40 bg-[#0a0a0a] text-white"
                        : "border-[#1a1a1a] bg-[#050505] text-zinc-500 hover:text-white"
                    }`}
                  >
                    {tf.label}
                  </button>
                );
              })}
            </div>
          </div>
          <Table rows={userRows} />
        </section>

        {/* Indiv. Call Leaderboard */}
        <div className="mt-8">
          <section className="space-y-4">
            <div>
              <h2 className={sectionTitle}>Indiv. Call Leaderboard</h2>
              <p className="mt-0.5 text-xs text-zinc-600">
                Top individual calls ranked by multiplier (mocked)
              </p>
            </div>
            <TopCallsList rows={MOCK_TOP_CALLS} tone="default" />
          </section>
        </div>
      </div>

      {/* BOT PERFORMANCE */}
      <div id="bot-performance" className="mt-16 rounded-xl border border-zinc-900 bg-[#050505]/60 p-5">
        <div className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-3">
          Bot Performance
        </div>

        {/* Bot summary stats */}
        <div className="mt-6 grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-[#1a1a1a] bg-zinc-900/40 p-3">
            <div className="flex items-start justify-between gap-2">
              <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-zinc-400">
                Best Bot Call (All-Time)
              </p>
              <span className="text-base" aria-hidden>
                🏆
              </span>
            </div>
            <p className="mt-2.5 text-2xl font-bold tabular-nums tracking-tight text-[#39FF14]">
              {fmtX(botSummary.bestMultiplier)}
            </p>
            <p className="mt-1.5 text-xs text-zinc-500">{botSummary.bestSymbol}</p>
          </div>

          <div className="rounded-xl border border-[#1a1a1a] bg-zinc-900/40 p-3">
            <div className="flex items-start justify-between gap-2">
              <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-zinc-400">
                Avg Multiplier
              </p>
              <span className="text-base" aria-hidden>
                📈
              </span>
            </div>
            <p className="mt-2.5 text-2xl font-bold tabular-nums tracking-tight text-[#39FF14]">
              {fmtX(botSummary.avgMultiplier)}
            </p>
            <p className="mt-1.5 text-xs text-zinc-500">Across tracked bot calls</p>
          </div>

          <div className="rounded-xl border border-[#1a1a1a] bg-zinc-900/40 p-3">
            <div className="flex items-start justify-between gap-2">
              <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-zinc-400">
                Total Calls
              </p>
              <span className="text-base" aria-hidden>
                📞
              </span>
            </div>
            <p className="mt-2.5 text-2xl font-bold tabular-nums tracking-tight text-zinc-100">
              {botSummary.totalCalls.toLocaleString()}
            </p>
            <p className="mt-1.5 text-xs text-zinc-500">All-time bot-issued calls</p>
          </div>

          <div className="rounded-xl border border-[#1a1a1a] bg-zinc-900/40 p-3">
            <div className="flex items-start justify-between gap-2">
              <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-zinc-400">
                Win Rate
              </p>
              <span className="text-base" aria-hidden>
                🎯
              </span>
            </div>
            <p className="mt-2.5 text-2xl font-bold tabular-nums tracking-tight text-zinc-100">
              {botSummary.winRate}%
            </p>
            <p className="mt-1.5 text-xs text-zinc-500">Mock aggregate</p>
          </div>
        </div>

        {/* Fastest Calls */}
        <div className="mt-6">
          <div className="mb-2">
            <h3 className="text-sm font-semibold text-zinc-100">Fastest Calls (Call → ATH)</h3>
            <p className="mt-0.5 text-xs text-zinc-600">Shortest time from call to ATH (mocked)</p>
          </div>

          <div className="rounded-xl border border-[#1a1a1a]/80 bg-[#080808] p-3 opacity-[0.94]">
            <ul className="space-y-2">
              {fastestBotCalls.map((c, idx) => (
                <li
                  key={`${c.symbol}-${c.callToATH}-${idx}`}
                  className="flex items-center justify-between gap-3 rounded-lg border border-[#1a1a1a] bg-transparent px-3 py-2.5"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#1a1a1a] bg-[#050505] text-[10px] font-bold tabular-nums text-zinc-300"
                      aria-hidden
                    >
                      {symbolBadge(c.symbol)}
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-zinc-100">{c.symbol}</div>
                      <div className="text-[11px] text-zinc-600">Call → ATH</div>
                    </div>
                  </div>

                  <div className="shrink-0 text-right">
                    <div className="text-sm font-semibold tabular-nums text-[#39FF14]">
                      {fmtX(c.multiplier)}
                    </div>
                    <div className="text-[11px] text-zinc-500">{c.callToATH}</div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Top McGBot Calls */}
        <div className="mt-6 rounded-xl border border-[#1a1a1a]/90 bg-[#060606] p-4 ring-1 ring-black/20">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className={sectionTitle}>Top McGBot Calls</h2>
              <span className="rounded border border-zinc-700/80 bg-zinc-900/40 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                Bot
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {TIMEFRAMES.map((tf) => {
                const active = mcgbotTimeframe === tf.id;
                return (
                  <button
                    key={tf.id}
                    type="button"
                    onClick={() => setMcgbotTimeframe(tf.id)}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                      active
                        ? "border-zinc-600 bg-zinc-900/50 text-zinc-200"
                        : "border-[#1a1a1a] bg-[#050505] text-zinc-600 hover:text-zinc-300"
                    }`}
                  >
                    {tf.label}
                  </button>
                );
              })}
            </div>
          </div>
          <p className="mt-2 text-xs text-zinc-600">Automated call highlights (mocked)</p>
          <div className="mt-6">
            <TopCallsList rows={mcgbotRows} tone="muted" />
          </div>
        </div>
      </div>
    </div>
  );
}
