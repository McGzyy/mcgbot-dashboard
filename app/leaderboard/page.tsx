"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
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

/** Mock “signed-in” caller — highlighted on the current timeframe’s page 1 */
function mockViewerUsername(tf: TimeframeId): string {
  return `${tf}_caller_6`;
}

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
  tone?: "default" | "muted" | "bot";
}) {
  const sorted = useMemo(
    () => [...rows].sort((a, b) => b.multiplier - a.multiplier),
    [rows]
  );

  const shell =
    tone === "muted"
      ? "rounded-xl border border-[#1a1a1a]/80 bg-[#080808] p-3 opacity-[0.94]"
      : tone === "bot"
        ? "rounded-xl border border-sky-500/20 bg-sky-950/15 p-3 ring-1 ring-sky-500/10"
        : "rounded-xl border border-emerald-500/20 bg-emerald-950/10 p-3 ring-1 ring-emerald-500/10";

  const topRow =
    tone === "bot"
      ? "border-sky-400/20 bg-sky-500/10 shadow-[0_0_20px_-8px_rgba(56,189,248,0.35)]"
      : "border-emerald-500/10 bg-emerald-500/5";

  return (
    <div className={shell}>
      <ul className="space-y-1">
        {sorted.map((row, i) => {
          return (
            <li
              key={`${row.symbol}-${row.username}-${row.timestamp}-${i}`}
              className={[
                "flex items-center justify-between rounded-lg border px-3 py-2 transition-all duration-150",
                tone === "bot"
                  ? "hover:bg-sky-950/40"
                  : tone === "muted"
                    ? "hover:bg-zinc-900/50"
                    : "hover:bg-emerald-950/30",
                i === 0 ? topRow : "border-transparent",
              ].join(" ")}
            >
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <div className="w-8 shrink-0 text-right text-xs font-medium tabular-nums text-zinc-500">
                  #{i + 1}
                </div>
                <div
                  className={[
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border text-[10px] font-bold tabular-nums",
                    tone === "bot"
                      ? "border-sky-500/25 bg-sky-950/50 text-sky-200"
                      : tone === "muted"
                        ? "border-[#1a1a1a] bg-[#050505] text-zinc-300"
                        : "border-emerald-500/20 bg-emerald-950/40 text-emerald-200/90",
                  ].join(" ")}
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
              <div className="min-w-[70px] shrink-0 text-right">
                <div
                  className={`text-base font-bold tabular-nums ${
                    tone === "bot" ? "text-sky-300" : "text-emerald-400"
                  }`}
                >
                  {fmtX(row.multiplier)}
                </div>
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
    const scrollToHashSection = () => {
      const id = window.location.hash.replace(/^#/, "");
      if (!id) return;
      const el = document.getElementById(id);
      if (el) el.scrollIntoView({ behavior: "smooth" });
    };

    scrollToHashSection();
    window.addEventListener("hashchange", scrollToHashSection);
    return () => window.removeEventListener("hashchange", scrollToHashSection);
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

  const podiumRowClass = (rank: number) => {
    if (rank === 1) {
      return "border-yellow-500/20 bg-gradient-to-r from-yellow-500/[0.09] via-yellow-500/[0.03] to-transparent shadow-[0_0_24px_-10px_rgba(234,179,8,0.22)]";
    }
    if (rank === 2) {
      return "border-zinc-400/15 bg-gradient-to-r from-zinc-300/[0.06] via-zinc-400/[0.02] to-transparent";
    }
    if (rank === 3) {
      return "border-amber-700/25 bg-gradient-to-r from-amber-600/[0.1] via-amber-700/[0.03] to-transparent";
    }
    return "border-transparent";
  };

  const Table = ({ rows }: { rows: LeaderRow[] }) => {
    const youHandle = mockViewerUsername(usersTimeframe);
    return (
      <div className="rounded-xl border border-emerald-500/15 bg-black/30 p-4 ring-1 ring-emerald-500/10">
        <div className="overflow-x-auto">
          <div className="min-w-[720px]">
            <div className="flex items-end justify-between gap-3 border-b border-emerald-500/10 pb-2 text-[10px] font-medium uppercase tracking-widest text-zinc-600 sm:text-[11px]">
              <div className="min-w-0 flex-1 pl-1">User</div>
              <div className="w-12 shrink-0 text-center">Δ</div>
              <div className="flex shrink-0 items-end gap-2 sm:gap-3">
                <div className="text-right min-w-[56px]">Avg X</div>
                <div className="text-right min-w-[56px]">Best X</div>
              </div>
            </div>

            <div className="space-y-1.5 pt-2">
              {rows.map((r) => {
                const isYou = r.username === youHandle;
                return (
                  <div
                    key={`${r.rank}-${r.username}`}
                    className={[
                      "group/row flex items-center justify-between gap-3 rounded-xl border px-2.5 py-2 transition-all duration-200 sm:px-3",
                      "hover:bg-emerald-950/30 hover:shadow-[0_0_18px_-6px_rgba(16,185,129,0.12)]",
                      podiumRowClass(r.rank),
                      isYou
                        ? "ring-1 ring-emerald-400/35 ring-offset-2 ring-offset-[#050505]"
                        : "",
                    ].join(" ")}
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-2.5 pr-1 sm:gap-3">
                      <div className="w-7 shrink-0 text-right text-[11px] font-semibold tabular-nums text-zinc-500 sm:w-8">
                        #{r.rank}
                      </div>
                      <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-full ring-1 ring-white/10 transition group-hover/row:ring-emerald-500/25">
                        <Avatar src={r.avatarSrc} name={r.username} size="sm" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="truncate text-sm font-medium text-zinc-100">{r.username}</span>
                          {isYou ? (
                            <span className="shrink-0 rounded border border-emerald-400/40 bg-emerald-500/15 px-1.5 py-0 text-[9px] font-bold uppercase tracking-wider text-emerald-200">
                              You
                            </span>
                          ) : null}
                          {r.rank <= 3 && !isYou ? (
                            <span
                              className={[
                                "shrink-0 rounded px-1.5 py-0 text-[9px] font-bold uppercase tracking-wider",
                                r.rank === 1
                                  ? "border border-yellow-500/25 bg-yellow-500/10 text-yellow-200/95"
                                  : r.rank === 2
                                    ? "border border-zinc-400/20 bg-zinc-400/10 text-zinc-200"
                                    : "border border-amber-600/25 bg-amber-600/10 text-amber-200/90",
                              ].join(" ")}
                            >
                              {r.rank === 1 ? "Gold" : r.rank === 2 ? "Silver" : "Bronze"}
                            </span>
                          ) : null}
                        </div>
                        <div className="mt-0.5 text-xs text-zinc-500">
                          {r.calls} calls
                          {typeof r.winRate === "number" ? ` · ${r.winRate.toFixed(0)}% win` : ""}
                        </div>
                      </div>
                    </div>

                    <div className="flex w-12 shrink-0 items-center justify-center">
                      <RankDelta delta={r.rankDelta} />
                    </div>

                    <div className="flex shrink-0 items-center gap-2 sm:gap-3">
                      <div className="text-right min-w-[56px] text-xs font-semibold tabular-nums text-emerald-400">
                        {fmtX(r.avgX)}
                      </div>
                      <div className="text-right min-w-[56px] text-xs font-semibold tabular-nums text-amber-300">
                        {fmtX(r.bestX)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const sectionTitle = "text-base font-semibold tracking-tight text-zinc-100";
  const navPill =
    "rounded-full border border-zinc-800/90 bg-zinc-950/70 px-3 py-1.5 text-[11px] font-medium text-zinc-400 outline-none transition-all duration-200 hover:-translate-y-px hover:border-cyan-500/40 hover:bg-zinc-900/80 hover:text-cyan-100 hover:shadow-[0_12px_40px_-24px_rgba(0,0,0,0.85)] focus-visible:ring-2 focus-visible:ring-cyan-500/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[#070708] active:translate-y-0";

  return (
    <div className="min-h-screen bg-[#070708] bg-[radial-gradient(ellipse_120%_80%_at_50%_-18%,rgba(34,211,238,0.12),transparent_55%)] text-zinc-100">
      <div className="mx-auto w-full max-w-[1100px] space-y-8 px-4 py-8 sm:px-6 lg:py-10">
        <header className="relative overflow-hidden rounded-2xl border border-zinc-800/50 bg-gradient-to-br from-zinc-900/90 via-zinc-950 to-[#070708] p-6 shadow-[0_24px_60px_-40px_rgba(0,0,0,0.88)] ring-1 ring-white/[0.05] sm:p-8">
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(105deg,transparent_35%,rgba(34,211,238,0.06)_48%,transparent_62%)] opacity-90" />
          <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-cyan-500/[0.07] blur-3xl" />
          <div className="pointer-events-none absolute -bottom-20 -left-16 h-56 w-56 rounded-full bg-emerald-600/[0.06] blur-3xl" />
          <div className="relative">
            <p className="text-[10px] font-bold uppercase tracking-[0.32em] text-cyan-400/90">
              McGBot Terminal
            </p>
            <h1 className="mt-2 bg-gradient-to-b from-white via-zinc-100 to-zinc-400 bg-clip-text text-2xl font-bold tracking-tight text-transparent sm:text-4xl sm:tracking-tighter">
              Leaderboards
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-zinc-400">
              The public scoreboard for callers and automation. Verified runs, clean multiples, and
              rank that actually moves — built to make you want the top row.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-2 rounded-full border border-zinc-800/90 bg-black/35 px-3 py-1.5 text-[11px] text-zinc-400">
                <span
                  className="relative flex h-2 w-2"
                  aria-hidden
                >
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400/60 opacity-60" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.65)]" />
                </span>
                Boards track verified calls
              </span>
              <Link
                href="/"
                className="inline-flex items-center rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1.5 text-[11px] font-semibold text-emerald-100/95 transition hover:border-emerald-400/45 hover:bg-emerald-500/15"
              >
                Post calls · climb ranks →
              </Link>
            </div>
            <nav
              className="mt-6 flex flex-wrap gap-2 border-t border-zinc-800/60 pt-5"
              aria-label="Jump to leaderboard section"
            >
              <a href="#leaders" className={navPill}>
                Spotlight
              </a>
              <a href="#records" className={navPill}>
                Records
              </a>
              <a href="#rank" className={navPill}>
                Rank trend
              </a>
              <a href="#community-performance" className={navPill}>
                Community
              </a>
              <a href="#user-boards" className={navPill}>
                Caller boards
              </a>
              <a href="#bot-performance" className={navPill}>
                McGBot
              </a>
            </nav>
          </div>
        </header>

      <div id="rank" className="mb-2 scroll-mt-28 rounded-2xl border border-zinc-800/50 bg-gradient-to-b from-zinc-900/55 to-zinc-950/95 p-5 shadow-[0_20px_50px_-36px_rgba(0,0,0,0.85)] ring-1 ring-white/[0.04] sm:p-6">
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
                className={`rounded-md border px-2 py-1 text-xs transition ${
                  timeframe === t
                    ? "border-cyan-500/50 bg-cyan-500/10 text-cyan-200 shadow-[0_0_16px_-4px_rgba(34,211,238,0.35)]"
                    : "border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-white"
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
                stroke="#22d3ee"
                strokeWidth={2}
                dot={false}
                isAnimationActive={true}
                style={{ filter: "drop-shadow(0 0 8px rgba(34,211,238,0.45))" }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 1) Leaders */}
      <section id="leaders" className="scroll-mt-28 space-y-4">
        <div>
          <h2 className={sectionTitle}>Leaders</h2>
          <p className="mt-1 text-xs leading-relaxed text-zinc-500">
            Faces on the board rotate with performance — the strip is reserved for people who ship
            signals others actually follow.
          </p>
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          {MOCK_LEADERS.map((w) => (
            <div
              key={w.label}
              className="group relative cursor-pointer transition-all"
              onClick={() => router.push(`/profile/${w.username}`)}
            >
              <div className="relative rounded-xl border border-[#2a2415] bg-gradient-to-br from-[#161308] via-[#0c0c0c] to-[#0a0a0a] p-6 shadow-[0_0_28px_rgba(255,215,0,0.12)] transition-all hover:bg-zinc-900/60 hover:shadow-[0_0_36px_rgba(255,215,0,0.18)]">
                <div className="absolute left-4 top-4 flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-black/50 text-xs font-black tabular-nums text-zinc-200 shadow-inner backdrop-blur-sm">
                  {w.label === "Daily Leader" ? "1" : w.label === "Weekly Leader" ? "2" : "3"}
                </div>
                <div className="pr-20 pl-12">
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
                  <span className="text-lg font-semibold tabular-nums text-emerald-400">
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
      <section id="records" className="scroll-mt-28 space-y-4 border-t border-zinc-800/60 pt-8">
        <div>
          <h2 className={sectionTitle}>All-Time Records</h2>
          <p className="mt-1 text-xs leading-relaxed text-zinc-500">
            Highest multiplier, best average, volume, and win-rate standouts — snapshot metrics.
          </p>
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
                  <p className="mt-2.5 text-2xl font-bold tabular-nums tracking-tight text-emerald-400">
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
                  <p className="mt-2.5 text-2xl font-bold tabular-nums tracking-tight text-emerald-400">
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
                  rankImproving
                    ? "ring-1 ring-emerald-500/20 shadow-[0_0_18px_rgba(16,185,129,0.12)]"
                    : "",
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
                            ? "border-emerald-500/55 text-emerald-300"
                            : "border-zinc-700 text-zinc-400 hover:border-emerald-500/40"
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
                    <div className="mt-0.5 text-4xl font-bold tracking-tight text-white drop-shadow-[0_0_6px_rgba(16,185,129,0.28)]">
                      #12
                    </div>
                    <div
                      className={`mt-1 text-xs ${
                        rankDeltaToday > 0
                          ? "text-emerald-400"
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
              <div className="pointer-events-none absolute inset-0 bg-emerald-500/10 blur-2xl opacity-40 transition-opacity duration-300 group-hover:opacity-70" />

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
                  <div className="text-base font-bold tabular-nums text-emerald-400">
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

      {/* COMMUNITY — same shell pattern as McGBot; emerald accent vs sky */}
      <section id="community-performance" className="relative mt-16 scroll-mt-28">
        <div
          className="pointer-events-none absolute -top-5 left-1/2 h-px w-[min(100%,48rem)] -translate-x-1/2 bg-gradient-to-r from-transparent via-emerald-500/35 to-transparent"
          aria-hidden
        />
        <div className="relative overflow-hidden rounded-2xl border border-emerald-500/25 bg-gradient-to-br from-emerald-950/25 via-[#070a08] to-zinc-950 shadow-[0_0_0_1px_rgba(16,185,129,0.12),0_28px_70px_-42px_rgba(0,0,0,0.92)] ring-1 ring-emerald-400/15">
          <div
            className="pointer-events-none absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-emerald-400/90 via-emerald-500/60 to-teal-600/50"
            aria-hidden
          />
          <div className="relative border-b border-emerald-500/15 bg-emerald-950/20 px-5 py-5 sm:px-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-md bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.22em] text-emerald-100 ring-1 ring-emerald-400/35">
                    Community
                  </span>
                  <span className="rounded-md bg-zinc-950/80 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-400 ring-1 ring-zinc-700/80">
                    Manual calls
                  </span>
                </div>
                <h2 className="mt-3 text-lg font-semibold tracking-tight text-zinc-50 sm:text-xl">
                  Community performance & leaderboards
                </h2>
                <p className="mt-2 max-w-2xl text-xs leading-relaxed text-emerald-100/45 sm:text-sm">
                  Callers, timing aggregates, and ranked tables for human-sourced activity — same layout
                  language as McGBot below (emerald vs sky).
                </p>
              </div>
            </div>
          </div>

          <div className="relative space-y-8 px-5 py-6 sm:px-6">
            <div className="flex flex-col gap-3 rounded-xl border border-emerald-500/15 bg-gradient-to-r from-emerald-950/35 via-emerald-950/10 to-transparent px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-5">
              <p className="text-sm leading-snug text-zinc-300">
                <span className="font-semibold text-zinc-50">Get your handle in lights.</span>{" "}
                Ranks reward verified calls and clean risk — grind the terminal, then watch this row
                flip to your name.
              </p>
              <Link
                href="/help"
                className="inline-flex shrink-0 items-center justify-center rounded-lg border border-emerald-400/35 bg-emerald-500/15 px-3 py-2 text-xs font-semibold text-emerald-50 transition hover:bg-emerald-500/25"
              >
                How to qualify →
              </Link>
            </div>

            <div id="user-snapshot" className="scroll-mt-28">
              <h3 className={`${sectionTitle}`}>Snapshot KPIs</h3>
              <p className="mt-0.5 text-xs text-emerald-100/40">
                Community aggregate timing (sample).
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-emerald-500/15 bg-emerald-950/20 p-4 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)]">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-400">
                    Avg call → ATH
                  </p>
                  <p className="mt-2.5 text-2xl font-bold tabular-nums tracking-tight text-emerald-300">
                    {USER_AVG_TO_ATH}
                  </p>
                  <p className="mt-1.5 text-xs text-zinc-500">Community aggregate (sample)</p>
                </div>
                <div className="rounded-xl border border-emerald-500/15 bg-emerald-950/20 p-4 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)]">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-400">
                    Avg → 2x
                  </p>
                  <p className="mt-2.5 text-2xl font-bold tabular-nums tracking-tight text-emerald-300">
                    {USER_AVG_TO_2X}
                  </p>
                  <p className="mt-1.5 text-xs text-zinc-500">Community aggregate (sample)</p>
                </div>
              </div>
            </div>

            <div
              id="user-boards"
              className="scroll-mt-28 space-y-8 border-t border-emerald-500/10 pt-8"
            >
        {/* User Leaderboard */}
        <section className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className={sectionTitle}>User Leaderboard</h2>
              <p className="mt-1 text-xs leading-relaxed text-zinc-500">
                Avg / best multiple and win rate by caller — matches timeframe tabs.
              </p>
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
                        ? "border-emerald-400/50 bg-emerald-500/15 text-emerald-50 shadow-[0_0_14px_-4px_rgba(16,185,129,0.35)]"
                        : "border-emerald-500/10 bg-black/20 text-zinc-400 hover:border-emerald-500/30 hover:text-zinc-100"
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
                      ? "border-emerald-400/50 bg-emerald-500/15 text-emerald-100"
                      : "border-emerald-500/10 bg-black/25 text-zinc-500 hover:border-emerald-500/25 hover:text-zinc-200"
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
                <p className="mt-1 text-xs leading-relaxed text-zinc-500">
                  Highest single-call multiples and time-to-ATH — ranked list.
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
                          ? "border-emerald-400/50 bg-emerald-500/15 text-emerald-50 shadow-[0_0_14px_-4px_rgba(16,185,129,0.35)]"
                          : "border-emerald-500/10 bg-black/20 text-zinc-400 hover:border-emerald-500/30 hover:text-zinc-100"
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
                        ? "border-emerald-400/50 bg-emerald-500/15 text-emerald-100"
                        : "border-emerald-500/10 bg-black/25 text-zinc-500 hover:border-emerald-500/25 hover:text-zinc-200"
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
          </div>
        </div>
      </section>

      {/* BOT — same layout pattern as community; sky accent */}
      <section id="bot-performance" className="relative mt-16 scroll-mt-28">
        <div
          className="pointer-events-none absolute -top-5 left-1/2 h-px w-[min(100%,48rem)] -translate-x-1/2 bg-gradient-to-r from-transparent via-sky-500/35 to-transparent"
          aria-hidden
        />
        <div className="relative overflow-hidden rounded-2xl border border-sky-500/25 bg-gradient-to-br from-sky-950/35 via-[#070c10] to-zinc-950 shadow-[0_0_0_1px_rgba(56,189,248,0.12),0_28px_70px_-42px_rgba(0,0,0,0.92)] ring-1 ring-sky-400/15">
          <div
            className="pointer-events-none absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-sky-400/90 via-sky-500/60 to-cyan-600/50"
            aria-hidden
          />
          <div className="relative border-b border-sky-500/15 bg-sky-950/20 px-5 py-5 sm:px-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-md bg-sky-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.22em] text-sky-100 ring-1 ring-sky-400/35">
                    McGBot
                  </span>
                  <span className="rounded-md bg-zinc-950/80 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-400 ring-1 ring-zinc-700/80">
                    Automated calls
                  </span>
                </div>
                <h2 className="mt-3 text-lg font-semibold tracking-tight text-zinc-50 sm:text-xl">
                  Bot performance & call feed
                </h2>
                <p className="mt-2 max-w-2xl text-xs leading-relaxed text-sky-100/50 sm:text-sm">
                  Everything here is bot-issued — compare directly with the community hub above using
                  the same KPI cards, feeds, and ranked lists.
                </p>
              </div>
            </div>
          </div>

          <div className="relative space-y-6 px-5 py-6 sm:px-6">
            <div className="flex flex-col gap-3 rounded-xl border border-sky-500/15 bg-gradient-to-r from-sky-950/35 via-sky-950/10 to-transparent px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-5">
              <p className="text-sm leading-snug text-zinc-300">
                <span className="font-semibold text-zinc-50">Automation has its own ladder.</span>{" "}
                Same layout as community — compare your manual edge vs McGBot&apos;s consistency on
                multiples, speed, and hit rate.
              </p>
              <Link
                href="/settings"
                className="inline-flex shrink-0 items-center justify-center rounded-lg border border-sky-400/35 bg-sky-500/15 px-3 py-2 text-xs font-semibold text-sky-50 transition hover:bg-sky-500/25"
              >
                Bot settings →
              </Link>
            </div>
        {/* Bot summary stats */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          <div className="rounded-xl border border-sky-500/15 bg-sky-950/20 p-4 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)]">
            <div className="flex items-start justify-between gap-2">
              <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-zinc-400">
                Best Bot Call (All-Time)
              </p>
              <span className="text-base" aria-hidden />
            </div>
            <p className="mt-2.5 text-2xl font-bold tabular-nums tracking-tight text-sky-300">
              {fmtX(botSummary.bestMultiplier)}
            </p>
            <p className="mt-1.5 text-xs text-zinc-500">{botSummary.bestSymbol}</p>
          </div>

          <div className="rounded-xl border border-sky-500/15 bg-sky-950/20 p-4 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)]">
            <div className="flex items-start justify-between gap-2">
              <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-zinc-400">
                Avg Multiplier
              </p>
              <span className="text-base" aria-hidden />
            </div>
            <p className="mt-2.5 text-2xl font-bold tabular-nums tracking-tight text-sky-300">
              {fmtX(botSummary.avgMultiplier)}
            </p>
            <p className="mt-1.5 text-xs text-zinc-500">Across tracked bot calls</p>
          </div>

          <div className="rounded-xl border border-sky-500/15 bg-sky-950/20 p-4 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)]">
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

          <div className="rounded-xl border border-sky-500/15 bg-sky-950/20 p-4 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)]">
            <div className="flex items-start justify-between gap-2">
              <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-zinc-400">
                Win Rate
              </p>
              <span className="text-base" aria-hidden />
            </div>
            <p className="mt-2.5 text-2xl font-bold tabular-nums tracking-tight text-zinc-100">
              {botSummary.winRate}%
            </p>
            <p className="mt-1.5 text-xs text-zinc-500">Aggregate (sample)</p>
          </div>

          <div className="rounded-xl border border-sky-500/15 bg-sky-950/20 p-4 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)]">
            <div className="flex items-start justify-between gap-2">
              <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-zinc-400">
                Avg → ATH
              </p>
              <span className="text-base" aria-hidden />
            </div>
            <p className="mt-2.5 text-2xl font-bold tabular-nums tracking-tight text-sky-300">
              {botSummary.avgToAth}
            </p>
            <p className="mt-1.5 text-xs text-zinc-500">Mean call → ATH (sample)</p>
          </div>

          <div className="rounded-xl border border-sky-500/15 bg-sky-950/20 p-4 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)]">
            <div className="flex items-start justify-between gap-2">
              <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-zinc-400">
                Avg → 2x
              </p>
              <span className="text-base" aria-hidden />
            </div>
            <p className="mt-2.5 text-2xl font-bold tabular-nums tracking-tight text-sky-300">
              {botSummary.avgTo2x}
            </p>
            <p className="mt-1.5 text-xs text-zinc-500">Mean call → 2x (sample)</p>
          </div>
        </div>

        {/* Activity */}
        <div className="mt-2 grid grid-cols-1 gap-4 lg:grid-cols-2 lg:items-stretch">
          {/* Recent Milestone Hits */}
          <div className="flex h-full max-h-[340px] flex-col rounded-xl border border-sky-500/15 bg-sky-950/15 p-4 ring-1 ring-sky-500/10">
            <div className="mb-2 flex items-start justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold text-zinc-100">Recent Milestone Hits</h3>
                <p className="mt-0.5 text-xs text-sky-100/40">
                  Bot milestones (sample) — call → 2x / ATH timing
                </p>
              </div>
              <span className="shrink-0 rounded bg-sky-500/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-sky-200/90">
                Bot
              </span>
            </div>
            <div className="flex-1 overflow-y-auto rounded-xl border border-sky-500/10 bg-black/30 p-3 scrollbar-thin scrollbar-thumb-sky-900/60 scrollbar-track-transparent">
              <ul className="space-y-0.5">
                {MOCK_BOT_MILESTONES.map((row, idx) => (
                  <li
                    key={`${row.token}-${row.milestone}-${idx}`}
                    className="flex items-center justify-between gap-3 rounded-lg border border-sky-500/10 bg-sky-950/10 px-3 py-1.5 transition-all duration-150 hover:bg-sky-950/35"
                  >
                    <div className="min-w-0 flex-1 truncate text-[11px] text-zinc-200">
                      <span className="font-semibold text-zinc-100">{row.token}</span>{" "}
                      <span className="text-zinc-600">
                        {row.milestone === "ATH" ? "reached" : "hit"}
                      </span>{" "}
                      <span
                        className={[
                          "font-semibold tabular-nums",
                          row.milestone === "ATH" ? "text-amber-300" : "text-sky-300",
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
          <div className="flex h-full max-h-[340px] flex-col rounded-xl border border-sky-500/15 bg-sky-950/15 p-4 ring-1 ring-sky-500/10">
            <div className="mb-2 flex items-start justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold text-zinc-100">Live Bot Activity</h3>
                <p className="mt-0.5 text-xs text-sky-100/40">Latest McGBot entries (sample)</p>
              </div>
              <span className="shrink-0 rounded bg-sky-500/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-sky-200/90">
                Bot
              </span>
            </div>
            <div className="flex-1 overflow-y-auto rounded-xl border border-sky-500/10 bg-black/30 p-3 scrollbar-thin scrollbar-thumb-sky-900/60 scrollbar-track-transparent">
              <ul className="space-y-0.5">
                {MOCK_LIVE_BOT_ACTIVITY.map((row, idx) => (
                  <li
                    key={`${row.token}-${row.ago}-${idx}`}
                    className="flex items-center justify-between gap-3 rounded-lg border border-sky-500/10 bg-sky-950/10 px-3 py-1.5 transition-all duration-150 hover:bg-sky-950/35"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[11px] font-semibold text-zinc-100">
                        {row.token}
                      </div>
                      <div className="truncate text-[10px] text-zinc-500">
                        McGBot called {row.token} @{" "}
                        <span className="font-semibold tabular-nums text-sky-300">
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
        <div className="mt-2 rounded-xl border border-sky-500/20 bg-sky-950/10 p-4 ring-1 ring-sky-500/10">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className={sectionTitle}>Top McGBot Calls</h2>
              <span className="rounded-md border border-sky-400/35 bg-sky-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-sky-100">
                Bot only
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
                        ? "border-sky-400/50 bg-sky-500/15 text-sky-50 shadow-[0_0_14px_-4px_rgba(56,189,248,0.45)]"
                        : "border-sky-500/10 bg-black/20 text-zinc-400 hover:border-sky-500/30 hover:text-zinc-100"
                    }`}
                  >
                    {tf.label}
                  </button>
                );
              })}
            </div>
          </div>
          <p className="mt-2 text-xs text-zinc-500">
            Automated call highlights — sample list; pair with live bot feed when wired.
          </p>
          <div className="mt-6">
            <TopCallsList rows={mcgbotRows} tone="bot" />
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
                      ? "border-sky-400/50 bg-sky-500/15 text-sky-100"
                      : "border-sky-500/10 bg-black/25 text-zinc-500 hover:border-sky-500/25 hover:text-zinc-200"
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
      </section>
      </div>
    </div>
  );
}
