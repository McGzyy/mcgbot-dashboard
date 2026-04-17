"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/ui/avatar";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type TimeframeId = "daily" | "weekly" | "monthly" | "all";

type LeaderRow = {
  rank: number;
  username: string;
  avatarSrc?: string;
  avgX: number;
  bestX: number;
  calls: number;
  winRate?: number;
  /** vs prior window: positive up, negative down, 0 / omit = flat */
  rankDelta?: number;
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
  avatarSrc?: string;
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

type PerfPoint = {
  time: string;
  avgMultiplier: number;
  winRate: number;
  calls: number;
};

const performanceDataMap: Record<"W" | "M" | "3M" | "A", PerfPoint[]> = {
  W: [
    { time: "Mon", avgMultiplier: 3.1, winRate: 52, calls: 8 },
    { time: "Tue", avgMultiplier: 3.4, winRate: 55, calls: 10 },
    { time: "Wed", avgMultiplier: 2.9, winRate: 49, calls: 7 },
    { time: "Thu", avgMultiplier: 3.6, winRate: 58, calls: 12 },
    { time: "Fri", avgMultiplier: 4.2, winRate: 61, calls: 9 },
    { time: "Sat", avgMultiplier: 3.8, winRate: 56, calls: 6 },
    { time: "Sun", avgMultiplier: 4.0, winRate: 59, calls: 11 },
  ],
  M: [
    { time: "Week 1", avgMultiplier: 2.6, winRate: 46, calls: 48 },
    { time: "Week 2", avgMultiplier: 3.0, winRate: 51, calls: 63 },
    { time: "Week 3", avgMultiplier: 3.4, winRate: 54, calls: 58 },
    { time: "Week 4", avgMultiplier: 3.2, winRate: 49, calls: 70 },
  ],
  "3M": [
    { time: "Jan", avgMultiplier: 2.1, winRate: 41, calls: 180 },
    { time: "Feb", avgMultiplier: 2.7, winRate: 47, calls: 220 },
    { time: "Mar", avgMultiplier: 3.0, winRate: 50, calls: 205 },
    { time: "Apr", avgMultiplier: 3.5, winRate: 55, calls: 260 },
    { time: "May", avgMultiplier: 3.1, winRate: 52, calls: 240 },
    { time: "Jun", avgMultiplier: 3.8, winRate: 58, calls: 280 },
  ],
  A: [
    { time: "2022", avgMultiplier: 1.6, winRate: 34, calls: 520 },
    { time: "2023", avgMultiplier: 2.4, winRate: 42, calls: 980 },
    { time: "2024", avgMultiplier: 3.2, winRate: 51, calls: 1320 },
    { time: "2025", avgMultiplier: 3.7, winRate: 56, calls: 1680 },
  ],
};

const rankDataMap: Record<"W" | "M" | "Y" | "A", { time: string; rank: number }[]> = {
  W: [
    { time: "Mon", rank: 18 },
    { time: "Tue", rank: 15 },
    { time: "Wed", rank: 12 },
    { time: "Thu", rank: 14 },
    { time: "Fri", rank: 9 },
    { time: "Sat", rank: 7 },
    { time: "Sun", rank: 12 },
  ],
  M: [
    { time: "Week 1", rank: 22 },
    { time: "Week 2", rank: 18 },
    { time: "Week 3", rank: 14 },
    { time: "Week 4", rank: 10 },
  ],
  Y: [
    { time: "Jan", rank: 40 },
    { time: "Mar", rank: 32 },
    { time: "May", rank: 25 },
    { time: "Jul", rank: 18 },
    { time: "Sep", rank: 12 },
    { time: "Dec", rank: 8 },
  ],
  A: [
    { time: "2022", rank: 80 },
    { time: "2023", rank: 45 },
    { time: "2024", rank: 20 },
    { time: "2025", rank: 12 },
  ],
};

function buildUserLeaderboard(tf: TimeframeId): LeaderRow[] {
  return Array.from({ length: 50 }, (_, i) => {
    const rank = i + 1;
    const n = i;
    const username = `${tf}_caller_${rank}`;
    return {
      rank,
      username,
      avatarSrc:
        n % 4 === 0
          ? undefined
          : `https://api.dicebear.com/7.x/thumbs/png?seed=${encodeURIComponent(username)}`,
      avgX: Math.round((Math.max(1.2, 3.85 - n * 0.045) * 10)) / 10,
      bestX: Math.round((Math.max(2.0, 10.2 - n * 0.16) * 10)) / 10,
      calls: Math.max(8, 248 - n * 5),
      winRate: Math.max(36, 59 - (n % 14)),
      rankDelta: n % 3 === 0 ? 0 : n % 3 === 1 ? 1 : -1,
    };
  });
}

const MOCK_USER_LEADERBOARD: Record<TimeframeId, LeaderRow[]> = {
  daily: buildUserLeaderboard("daily"),
  weekly: buildUserLeaderboard("weekly"),
  monthly: buildUserLeaderboard("monthly"),
  all: buildUserLeaderboard("all"),
};

function buildTopCalls(tf: TimeframeId, who: "users" | "bot"): TopCallRow[] {
  const symbols = [
    "SOLX",
    "ALPHA",
    "DGN",
    "PEPE2",
    "JUP",
    "WIF",
    "BONK",
    "BOME",
    "GIGA",
    "POPCAT",
  ];

  const timeByTf: Record<TimeframeId, string[]> = {
    daily: ["5m ago", "12m ago", "30m ago", "1h ago", "2h ago"],
    weekly: ["Mon", "Tue", "Wed", "Thu", "Fri"],
    monthly: ["Apr 2", "Apr 8", "Apr 12", "Apr 18", "Apr 23"],
    all: ["Jan 2026", "Feb 2026", "Mar 2026", "2025", "2024"],
  };

  const toAthByTf: Record<TimeframeId, string[]> = {
    daily: ["5m", "7m", "12m", "22m", "48m"],
    weekly: ["35m", "1h", "2h", "4h", "8h"],
    monthly: ["52m", "1h", "3h", "6h", "1d"],
    all: ["1d", "2d", "3d", "5d", "7d"],
  };

  return Array.from({ length: 50 }, (_, i) => {
    const n = i;
    const rank = i + 1;
    const sym = symbols[n % symbols.length];
    const timestamp = timeByTf[tf][n % timeByTf[tf].length];
    const callToATH = toAthByTf[tf][n % toAthByTf[tf].length];
    const multiplier = Math.round(Math.max(1.4, (who === "bot" ? 8.2 : 7.4) - n * 0.12) * 10) / 10;
    const username =
      who === "bot" ? "McGBot" : `${tf}_caller_${Math.max(1, 1 + (n % 50))}`;

    return { symbol: sym, multiplier, username, timestamp, callToATH };
  });
}

const MOCK_INDIV_CALLS: Record<TimeframeId, TopCallRow[]> = {
  daily: buildTopCalls("daily", "users"),
  weekly: buildTopCalls("weekly", "users"),
  monthly: buildTopCalls("monthly", "users"),
  all: buildTopCalls("all", "users"),
};

const trendingNow = {
  symbol: "SOLX",
  user: "user_1",
  multiplier: 3.8,
  timeAgo: "12m ago",
};

const MOCK_MCGBOT_TOP_CALLS: Record<TimeframeId, TopCallRow[]> = {
  daily: buildTopCalls("daily", "bot"),
  weekly: buildTopCalls("weekly", "bot"),
  monthly: buildTopCalls("monthly", "bot"),
  all: buildTopCalls("all", "bot"),
};

const MOCK_LEADERS: LeaderCard[] = [
  {
    label: "Daily Leader",
    username: "user_1",
    avatarSrc: undefined,
    bestCall: "SOLX",
    multiplier: 4.2,
    avg: 2.8,
    best: 4.2,
    calls: 5,
    winRate: 62,
  },
  {
    label: "Weekly Leader",
    username: "SignalKing",
    avatarSrc: `https://api.dicebear.com/7.x/thumbs/png?seed=${encodeURIComponent("SignalKing")}`,
    bestCall: "ALPHA",
    multiplier: 6.1,
    avg: 3.3,
    best: 6.1,
    calls: 22,
    winRate: 58,
  },
  {
    label: "Monthly Leader",
    username: "mcgzzy",
    avatarSrc: `https://api.dicebear.com/7.x/thumbs/png?seed=${encodeURIComponent("mcgzzy")}`,
    bestCall: "DGN",
    multiplier: 8.4,
    avg: 3.8,
    best: 8.4,
    calls: 61,
    winRate: 55,
  },
];

/** Mock: community avg time call → ATH */
const USER_AVG_TO_ATH = "68m";
/** Mock: community avg time call → 2x */
const USER_AVG_TO_2X = "14m";

type BotMilestoneRow = {
  token: string;
  milestone: "2x" | "3x" | "5x" | "10x" | "ATH";
  timeTo: string;
  ago: string;
};

type LiveBotActivityRow = {
  token: string;
  mc: number;
  ago: string;
};

const MOCK_BOT_MILESTONES: BotMilestoneRow[] = [
  { token: "BOME", milestone: "2x", timeTo: "5m", ago: "just now" },
  { token: "WIF", milestone: "3x", timeTo: "22m", ago: "2m ago" },
  { token: "BONK", milestone: "ATH", timeTo: "1h", ago: "10m ago" },
  { token: "POPCAT", milestone: "5x", timeTo: "2h", ago: "28m ago" },
  { token: "GIGA", milestone: "10x", timeTo: "6h", ago: "1h ago" },
];

const MOCK_LIVE_BOT_ACTIVITY: LiveBotActivityRow[] = [
  { token: "SOLX", mc: 15400, ago: "2m ago" },
  { token: "WIF", mc: 28100, ago: "5m ago" },
  { token: "BONK", mc: 120000, ago: "12m ago" },
  { token: "BOME", mc: 8600, ago: "18m ago" },
  { token: "POPCAT", mc: 44500, ago: "33m ago" },
];

function fmtX(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "—";
  return `${n.toFixed(1)}x`;
}

function fmtMC(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}m`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return `${Math.round(n)}`;
}

function avatarUrlFor(name: string): string | undefined {
  const cleaned = (name ?? "").trim();
  if (!cleaned) return undefined;
  if (cleaned === "McGBot") return undefined;
  return `https://api.dicebear.com/7.x/thumbs/png?seed=${encodeURIComponent(cleaned)}`;
}

function symbolBadge(symbol: string) {
  const s = symbol.trim().toUpperCase();
  const letters = s.replace(/[^A-Z0-9]/g, "").slice(0, 2) || "—";
  return letters.length >= 2 ? letters.slice(0, 2) : `${letters}•`.slice(0, 2);
}

function RankDelta({ delta }: { delta?: number }) {
  if (delta === undefined || delta === 0) {
    return <span className="text-[10px] tabular-nums text-zinc-600">—</span>;
  }
  if (delta > 0) {
    return (
      <span className="text-[10px] font-medium tabular-nums text-emerald-400">
        ▲ +{delta}
      </span>
    );
  }
  return (
    <span className="text-[10px] font-medium tabular-nums text-red-400/90">
      ▼ {delta}
    </span>
  );
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
      <ul className="space-y-1">
        {sorted.map((row, i) => {
          return (
            <li
              key={`${row.symbol}-${row.username}-${row.timestamp}-${i}`}
              className={[
                "flex items-center justify-between rounded-lg border px-3 py-2 transition-all duration-150",
                "hover:bg-zinc-900/60",
                i === 0
                  ? "border-emerald-500/10 bg-emerald-500/5"
                  : "border-transparent",
              ].join(" ")}
            >
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <div className="w-8 shrink-0 text-right text-xs font-medium tabular-nums text-zinc-500">
                  #{i + 1}
                </div>
                <div
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#1a1a1a] bg-[#050505] text-[10px] font-bold tabular-nums text-zinc-300"
                  aria-hidden
                >
                  {symbolBadge(row.symbol)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-zinc-100">{row.symbol}</div>
                  <div className="truncate text-xs text-zinc-500">
                    {row.username} · {row.timestamp}
                  </div>
                </div>
              </div>
              <div className="shrink-0 text-right min-w-[70px]">
                <div className="text-base font-bold tabular-nums text-emerald-400">{fmtX(row.multiplier)}</div>
                <div className="text-xs text-zinc-500">{row.callToATH}</div>
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
  const [userPage, setUserPage] = useState(1);
  const [indivTimeframe, setIndivTimeframe] = useState<TimeframeId>("daily");
  const [indivPage, setIndivPage] = useState(1);
  const [mcgbotTimeframe, setMcgbotTimeframe] = useState<TimeframeId>("daily");
  const [mcgbotPage, setMcgbotPage] = useState(1);
  const [range, setRange] = useState<"D" | "W" | "M" | "A">("D");
  const [timeframe, setTimeframe] = useState<"W" | "M" | "Y" | "A">("W");

  const timeframeLabel =
    {
      D: "24h",
      W: "7d",
      M: "30d",
      A: "All time",
    }[range] ?? "24h";

  const rankDeltaToday = range === "D" ? 2 : range === "W" ? -1 : range === "M" ? 0 : 1;
  const rankImproving = rankDeltaToday > 0;
  void performanceDataMap;

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

  const fullUserList = useMemo(
    () => MOCK_USER_LEADERBOARD[usersTimeframe] ?? [],
    [usersTimeframe]
  );

  const userRows = useMemo(
    () => fullUserList.slice((userPage - 1) * 10, userPage * 10),
    [fullUserList, userPage]
  );

  const indivRows = useMemo(() => {
    const ITEMS_PER_PAGE = 10;
    const calls = MOCK_INDIV_CALLS[indivTimeframe] ?? [];
    const start = (indivPage - 1) * ITEMS_PER_PAGE;
    const end = start + ITEMS_PER_PAGE;
    return calls.slice(start, end);
  }, [indivPage, indivTimeframe]);
  const mcgbotRows = useMemo(
    () =>
      (MOCK_MCGBOT_TOP_CALLS[mcgbotTimeframe] ?? []).slice(
        (mcgbotPage - 1) * 10,
        mcgbotPage * 10
      ),
    [mcgbotPage, mcgbotTimeframe]
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
      avgToAth: "52m",
      avgTo2x: "14m",
    };
  }, [botAllCalls]);

  const allUsers = useMemo(() => MOCK_USER_LEADERBOARD.all ?? [], []);

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
          <div className="flex items-end justify-between gap-3 border-b border-[#1a1a1a] pb-2 text-[10px] font-medium uppercase tracking-widest text-zinc-600 sm:text-[11px]">
            <div className="min-w-0 flex-1">User</div>
            <div className="w-12 shrink-0 text-center">Δ</div>
            <div className="flex shrink-0 items-end gap-2 sm:gap-3">
              <div className="text-right min-w-[56px]">Avg X</div>
              <div className="text-right min-w-[56px]">Best X</div>
            </div>
          </div>

          <div className="space-y-1 pt-1.5">
            {rows.map((r) => (
              <div
                key={`${r.rank}-${r.username}`}
                className={[
                  "flex items-center justify-between gap-3 rounded-lg border px-3 py-1.5 transition-all",
                  "hover:bg-zinc-900/60 hover:shadow-[0_0_8px_rgba(255,255,255,0.03)]",
                  r.rank === 1
                    ? "bg-yellow-500/5 border-yellow-500/10"
                    : "border-transparent",
                ].join(" ")}
              >
                <div className="min-w-0 flex-1 pr-2">
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

                <div className="flex w-12 shrink-0 items-center justify-center">
                  <RankDelta delta={r.rankDelta} />
                </div>

                <div className="flex shrink-0 items-center gap-2 sm:gap-3">
                  <div className="text-right min-w-[56px] text-xs font-semibold tabular-nums text-[#39FF14]">
                    {fmtX(r.avgX)}
                  </div>
                  <div className="text-right min-w-[56px] text-xs font-semibold tabular-nums text-amber-300">
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

      <div className="mb-6 rounded-xl border border-zinc-800 bg-zinc-950 p-4">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <div className="text-sm text-zinc-400">Your Performance</div>
            <div className="font-medium text-white">Rank Over Time</div>
          </div>

          <div className="flex gap-2">
            {(["W", "M", "Y", "A"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTimeframe(t)}
                className={`px-2 py-1 text-xs rounded-md border transition ${
                  timeframe === t
                    ? "border-green-500 text-green-400"
                    : "border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-500"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={rankDataMap[timeframe]}>
              <CartesianGrid stroke="#27272a" strokeDasharray="3 3" />
              <XAxis
                dataKey="time"
                stroke="#71717a"
                fontSize={12}
                tickLine={false}
                axisLine={false}
              />
              <YAxis reversed stroke="#71717a" fontSize={12} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#09090b",
                  border: "1px solid #27272a",
                  borderRadius: "8px",
                }}
                labelStyle={{ color: "#a1a1aa" }}
              />
              <Line
                type="monotone"
                dataKey="rank"
                stroke="#22c55e"
                strokeWidth={2}
                dot={false}
                isAnimationActive={true}
                style={{ filter: "drop-shadow(0 0 6px rgba(34,197,94,0.4))" }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
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
              className="group relative cursor-pointer transition-all"
              onClick={() => router.push(`/profile/${w.username}`)}
            >
              <div className="relative rounded-xl border border-[#2a2415] bg-gradient-to-br from-[#161308] via-[#0c0c0c] to-[#0a0a0a] p-6 shadow-[0_0_28px_rgba(255,215,0,0.12)] transition-all hover:bg-zinc-900/60 hover:shadow-[0_0_36px_rgba(255,215,0,0.18)]">
                <div className="pr-20">
                  <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-yellow-500/80">
                    {w.label}
                  </p>
                  <p className="text-base font-medium text-zinc-100">{w.username}</p>
                  <p className="mt-3 text-xs text-zinc-600">Best call</p>
                  <div className="mt-1">
                    <span className="text-sm font-medium text-zinc-200">{w.bestCall}</span>
                  </div>
                  {w.coin ? <p className="mt-3 text-xs text-zinc-600">Coin: {w.coin}</p> : null}
                </div>

                <div className="absolute right-6 top-5 h-10 w-10 overflow-hidden rounded-full opacity-90 transition-opacity hover:opacity-100">
                  <Avatar src={w.avatarSrc} name={w.username} size="lg" />
                </div>

                <div className="absolute bottom-5 right-6">
                  <span className="text-lg font-semibold tabular-nums text-green-400">
                    {fmtX(w.multiplier)}
                  </span>
                </div>
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
              <div className="relative rounded-xl border border-[#1a1a1a] bg-zinc-900/40 p-3">
                <div className="pr-16">
                  <div className="flex items-start justify-between gap-2">
                    <p className="mb-1 text-xs font-semibold tracking-wide text-zinc-300">
                      HIGHEST MULTIPLIER
                    </p>
                    <span className="text-base" aria-hidden />
                  </div>
                  <p className="mt-2.5 text-2xl font-bold tabular-nums tracking-tight text-[#39FF14]">
                    {fmtX(allTimeRecords.highestMultiplierUser?.bestX ?? 0)}
                  </p>
                  <p className="mt-1.5 text-xs text-zinc-500">
                    {allTimeRecords.highestMultiplierUser?.username ?? "—"}
                  </p>
                </div>

                <div className="absolute right-6 top-5 h-8 w-8 overflow-hidden rounded-full opacity-90 transition-opacity hover:opacity-100">
                  <Avatar
                    src={allTimeRecords.highestMultiplierUser?.avatarSrc}
                    name={allTimeRecords.highestMultiplierUser?.username ?? "—"}
                    size="md"
                  />
                </div>
              </div>
              <div className="relative rounded-xl border border-[#1a1a1a] bg-zinc-900/40 p-3">
                <div className="pr-16">
                  <div className="flex items-start justify-between gap-2">
                    <p className="mb-1 text-xs font-semibold tracking-wide text-zinc-300">
                      BEST AVERAGE
                    </p>
                    <span className="text-base" aria-hidden />
                  </div>
                  <p className="mt-2.5 text-2xl font-bold tabular-nums tracking-tight text-[#39FF14]">
                    {fmtX(allTimeRecords.bestAverageUser?.avgX ?? 0)}
                  </p>
                  <p className="mt-1.5 text-xs text-zinc-500">
                    {allTimeRecords.bestAverageUser?.username ?? "—"}
                  </p>
                </div>

                <div className="absolute right-6 top-5 h-8 w-8 overflow-hidden rounded-full opacity-90 transition-opacity hover:opacity-100">
                  <Avatar
                    src={allTimeRecords.bestAverageUser?.avatarSrc}
                    name={allTimeRecords.bestAverageUser?.username ?? "—"}
                    size="md"
                  />
                </div>
              </div>
              <div className="relative rounded-xl border border-[#1a1a1a] bg-zinc-900/40 p-3">
                <div className="pr-16">
                  <div className="flex items-start justify-between gap-2">
                    <p className="mb-1 text-xs font-semibold tracking-wide text-zinc-300">
                      MOST CALLS
                    </p>
                    <span className="text-base" aria-hidden />
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

                <div className="absolute right-6 top-5 h-8 w-8 overflow-hidden rounded-full opacity-90 transition-opacity hover:opacity-100">
                  <Avatar
                    src={allTimeRecords.mostCalls?.avatarSrc}
                    name={allTimeRecords.mostCalls?.username ?? "—"}
                    size="md"
                  />
                </div>
              </div>
              <div className="relative rounded-xl border border-[#1a1a1a] bg-zinc-900/40 p-3">
                <div className="pr-16">
                  <div className="flex items-start justify-between gap-2">
                    <p className="mb-1 text-xs font-semibold tracking-wide text-zinc-300">
                      BEST WIN RATE
                    </p>
                    <span className="text-base" aria-hidden />
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

                <div className="absolute right-6 top-5 h-8 w-8 overflow-hidden rounded-full opacity-90 transition-opacity hover:opacity-100">
                  <Avatar
                    src={allTimeRecords.bestWinRateUser?.avatarSrc}
                    name={allTimeRecords.bestWinRateUser?.username ?? "—"}
                    size="md"
                  />
                </div>
              </div>
          </div>

            <div className="mx-2 hidden w-px bg-zinc-800 lg:block" />

            <div className="flex h-full flex-col gap-4">
              <div
                className={[
                  "group relative overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/30 p-4",
                  rankImproving ? "ring-1 ring-green-500/20 shadow-[0_0_18px_rgba(34,197,94,0.12)]" : "",
                ].join(" ")}
              >
              <div className="pointer-events-none absolute inset-0 bg-zinc-500/5 blur-2xl opacity-35 transition-opacity duration-300 group-hover:opacity-55" />

              <div className="relative z-10">
                <div className="flex items-start justify-between gap-3">
                  <div className="text-sm text-zinc-400">Your Rank</div>
                  <div className="flex gap-1">
                    {(["D", "W", "M", "A"] as const).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setRange(t)}
                        className={`px-2 py-0.5 text-xs rounded border transition ${
                          range === t
                            ? "border-green-400 text-green-400"
                            : "border-zinc-700 text-zinc-400 hover:border-green-400"
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mt-2 flex items-center justify-between">
                  <div>
                    <div className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
                      GLOBAL RANK
                    </div>
                    <div className="mt-0.5 text-4xl font-bold tracking-tight text-white drop-shadow-[0_0_6px_rgba(34,197,94,0.3)]">
                      #12
                    </div>
                    <div
                      className={`mt-1 text-xs ${
                        rankDeltaToday > 0
                          ? "text-green-400"
                          : rankDeltaToday < 0
                            ? "text-red-400"
                            : "text-zinc-500"
                      }`}
                    >
                      {rankDeltaToday > 0
                        ? `↑ +${rankDeltaToday} today`
                        : rankDeltaToday < 0
                          ? `↓ ${rankDeltaToday} today`
                          : "— today"}
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-sm text-zinc-500">Win Rate</div>
                    <div className="font-medium text-zinc-200">58%</div>
                  </div>
                </div>

                <div className="mt-2 text-xs text-zinc-500">18 calls • {timeframeLabel}</div>
              </div>
            </div>

              <div className="group relative overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/30 p-4">
              <div className="pointer-events-none absolute inset-0 bg-[#39FF14]/5 blur-2xl opacity-40 transition-opacity duration-300 group-hover:opacity-70" />

              <div className="relative z-10 flex items-center justify-between gap-6">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-xs text-zinc-300">
                    {trendingNow.symbol.slice(0, 2)}
                  </div>

                  <div className="min-w-0">
                    <div className="text-sm text-zinc-400">Trending Now (1h)</div>
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
          </div>
        </div>
        </div>
      </section>

      {/* USER PERFORMANCE */}
      <div className="mt-10 rounded-xl border border-zinc-900 bg-[#050505]/60 p-5">
        <div className="mb-3 text-xs font-semibold tracking-wide text-zinc-400">
          User Performance
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-xl border border-[#1a1a1a] bg-zinc-900/40 p-3">
            <div className="flex items-start justify-between gap-2">
              <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-zinc-400">
                AVG CALL → ATH
              </p>
              <span className="text-base" aria-hidden />
            </div>
            <p className="mt-2.5 text-2xl font-bold tabular-nums tracking-tight text-[#39FF14]">
              {USER_AVG_TO_ATH}
            </p>
            <p className="mt-1.5 text-xs text-zinc-500">Community calls (mocked)</p>
          </div>

          <div className="rounded-xl border border-[#1a1a1a] bg-zinc-900/40 p-3">
            <div className="flex items-start justify-between gap-2">
              <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-zinc-400">
                AVG → 2X
              </p>
              <span className="text-base" aria-hidden />
            </div>
            <p className="mt-2.5 text-2xl font-bold tabular-nums tracking-tight text-[#39FF14]">
              {USER_AVG_TO_2X}
            </p>
            <p className="mt-1.5 text-xs text-zinc-500">Community calls (mocked)</p>
          </div>
        </div>

        {/* User Leaderboard */}
        <section className="mt-6 space-y-4">
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
                    onClick={() => {
                      setUsersTimeframe(tf.id);
                      setUserPage(1);
                    }}
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
          <div className="mt-4 flex flex-wrap items-center justify-center gap-1.5">
            {[1, 2, 3, 4, 5].map((p) => {
              const active = userPage === p;
              return (
                <button
                  key={p}
                  type="button"
                  aria-current={active ? "page" : undefined}
                  onClick={() => setUserPage(p)}
                  className={`min-w-[2.25rem] rounded-lg border px-2.5 py-1.5 text-xs font-semibold tabular-nums transition-colors ${
                    active
                      ? "border-[#39FF14]/45 bg-[#0a0a0a] text-[#39FF14]"
                      : "border-[#1a1a1a] bg-[#050505] text-zinc-500 hover:border-zinc-700 hover:text-zinc-200"
                  }`}
                >
                  {p}
                </button>
              );
            })}
          </div>
        </section>

        {/* Indiv. Call Leaderboard */}
        <div className="mt-8">
          <section className="space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className={sectionTitle}>Indiv. Call Leaderboard</h2>
                <p className="mt-0.5 text-xs text-zinc-600">
                  Top individual calls ranked by multiplier (mocked)
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {TIMEFRAMES.map((tf) => {
                  const active = indivTimeframe === tf.id;
                  return (
                    <button
                      key={tf.id}
                      type="button"
                    onClick={() => {
                      setIndivTimeframe(tf.id);
                      setIndivPage(1);
                    }}
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
            <TopCallsList rows={indivRows} tone="default" />
            <div className="mt-4 flex flex-wrap items-center justify-center gap-1.5">
              {[1, 2, 3, 4, 5].map((p) => {
                const active = indivPage === p;
                return (
                  <button
                    key={p}
                    type="button"
                    aria-current={active ? "page" : undefined}
                    onClick={() => setIndivPage(p)}
                    className={`min-w-[2.25rem] rounded-lg border px-2.5 py-1.5 text-xs font-semibold tabular-nums transition-colors ${
                      active
                        ? "border-[#39FF14]/45 bg-[#0a0a0a] text-[#39FF14]"
                        : "border-[#1a1a1a] bg-[#050505] text-zinc-500 hover:border-zinc-700 hover:text-zinc-200"
                    }`}
                  >
                    {p}
                  </button>
                );
              })}
            </div>
          </section>
        </div>
      </div>

      {/* BOT PERFORMANCE */}
      <div id="bot-performance" className="mt-16 rounded-xl border border-zinc-900 bg-[#050505]/60 p-5">
        <div className="mb-3 text-xs font-semibold tracking-wide text-zinc-400">
          Bot Performance
        </div>

        {/* Bot summary stats */}
        <div className="mt-6 grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-[#1a1a1a] bg-zinc-900/40 p-3">
            <div className="flex items-start justify-between gap-2">
              <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-zinc-400">
                Best Bot Call (All-Time)
              </p>
              <span className="text-base" aria-hidden />
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
              <span className="text-base" aria-hidden />
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
              <span className="text-base" aria-hidden />
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
              <span className="text-base" aria-hidden />
            </div>
            <p className="mt-2.5 text-2xl font-bold tabular-nums tracking-tight text-zinc-100">
              {botSummary.winRate}%
            </p>
            <p className="mt-1.5 text-xs text-zinc-500">Mock aggregate</p>
          </div>

          <div className="rounded-xl border border-[#1a1a1a] bg-zinc-900/40 p-3">
            <div className="flex items-start justify-between gap-2">
              <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-zinc-400">
                Avg → ATH
              </p>
              <span className="text-base" aria-hidden />
            </div>
            <p className="mt-2.5 text-2xl font-bold tabular-nums tracking-tight text-[#39FF14]">
              {botSummary.avgToAth}
            </p>
            <p className="mt-1.5 text-xs text-zinc-500">Mean call → ATH (mocked)</p>
          </div>

          <div className="rounded-xl border border-[#1a1a1a] bg-zinc-900/40 p-3">
            <div className="flex items-start justify-between gap-2">
              <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-zinc-400">
                Avg → 2x
              </p>
              <span className="text-base" aria-hidden />
            </div>
            <p className="mt-2.5 text-2xl font-bold tabular-nums tracking-tight text-[#39FF14]">
              {botSummary.avgTo2x}
            </p>
            <p className="mt-1.5 text-xs text-zinc-500">Mean call → 2x (mocked)</p>
          </div>
        </div>

        {/* Activity */}
        <div className="mt-6 grid grid-cols-2 gap-6 items-stretch">
          {/* Recent Milestone Hits */}
          <div className="h-full max-h-[340px] flex flex-col rounded-xl border border-zinc-900 bg-[#050505]/40 p-4">
            <div className="mb-2">
              <h3 className="text-sm font-semibold text-zinc-100">Recent Milestone Hits</h3>
              <p className="mt-0.5 text-xs text-zinc-600">Call → milestone activity (mocked)</p>
            </div>
            <div className="flex-1 overflow-y-auto rounded-xl border border-[#1a1a1a]/60 bg-[#080808] p-3 opacity-[0.94] scrollbar-thin scrollbar-thumb-zinc-700/40 scrollbar-track-transparent">
              <ul className="space-y-0.5">
                {MOCK_BOT_MILESTONES.map((row, idx) => (
                  <li
                    key={`${row.token}-${row.milestone}-${idx}`}
                    className="flex items-center justify-between gap-3 rounded-lg border border-[#1a1a1a]/60 bg-transparent px-3 py-1 transition-all duration-150 hover:bg-zinc-900/60"
                  >
                    <div className="min-w-0 flex-1 truncate text-[11px] text-zinc-200">
                      <span className="font-semibold text-zinc-100">{row.token}</span>{" "}
                      <span className="text-zinc-600">
                        {row.milestone === "ATH" ? "reached" : "hit"}
                      </span>{" "}
                      <span
                        className={[
                          "font-semibold tabular-nums",
                          row.milestone === "ATH" ? "text-amber-300" : "text-[#39FF14]",
                        ].join(" ")}
                      >
                        {row.milestone}
                      </span>{" "}
                      <span className="text-zinc-600">in</span>{" "}
                      <span className="tabular-nums text-zinc-400">{row.timeTo}</span>
                    </div>
                    <div className="shrink-0 text-right text-[10px] tabular-nums text-zinc-600">
                      {row.ago}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Live Bot Activity */}
          <div className="h-full max-h-[340px] flex flex-col rounded-xl border border-zinc-900 bg-[#050505]/40 p-4">
            <div className="mb-2">
              <h3 className="text-sm font-semibold text-zinc-100">Live Bot Activity</h3>
              <p className="mt-0.5 text-xs text-zinc-600">Recent bot calls (mocked)</p>
            </div>
            <div className="flex-1 overflow-y-auto rounded-xl border border-[#1a1a1a]/60 bg-[#080808] p-3 opacity-[0.94] scrollbar-thin scrollbar-thumb-zinc-700/40 scrollbar-track-transparent">
              <ul className="space-y-0.5">
                {MOCK_LIVE_BOT_ACTIVITY.map((row, idx) => (
                  <li
                    key={`${row.token}-${row.ago}-${idx}`}
                    className="flex items-center justify-between gap-3 rounded-lg border border-[#1a1a1a]/60 bg-transparent px-3 py-1 transition-all duration-150 hover:bg-zinc-900/60"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[11px] font-semibold text-zinc-100">
                        {row.token}
                      </div>
                      <div className="truncate text-[10px] text-zinc-500">
                        McGBot called {row.token} @{" "}
                        <span className="font-semibold tabular-nums text-[#39FF14]">
                          {fmtMC(row.mc)} MC
                        </span>
                      </div>
                    </div>
                    <div className="shrink-0 text-right text-[10px] tabular-nums text-zinc-600">
                      {row.ago}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
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
                    onClick={() => {
                      setMcgbotTimeframe(tf.id);
                      setMcgbotPage(1);
                    }}
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
          <p className="mt-2 text-xs text-zinc-600">Automated call highlights (mocked)</p>
          <div className="mt-6">
            <TopCallsList rows={mcgbotRows} tone="muted" />
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-1.5">
            {[1, 2, 3, 4, 5].map((p) => {
              const active = mcgbotPage === p;
              return (
                <button
                  key={p}
                  type="button"
                  aria-current={active ? "page" : undefined}
                  onClick={() => setMcgbotPage(p)}
                  className={`min-w-[2.25rem] rounded-lg border px-2.5 py-1.5 text-xs font-semibold tabular-nums transition-colors ${
                    active
                      ? "border-[#39FF14]/45 bg-[#0a0a0a] text-[#39FF14]"
                      : "border-[#1a1a1a] bg-[#050505] text-zinc-500 hover:border-zinc-700 hover:text-zinc-200"
                  }`}
                >
                  {p}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
