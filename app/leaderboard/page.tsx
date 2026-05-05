"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Avatar } from "@/components/ui/avatar";
import { formatRelativeTime } from "@/lib/modUiUtils";
import { looksLikeDiscordSnowflake } from "@/lib/discordIdentity";
import { useNotifications } from "@/app/contexts/NotificationsContext";
import { useTokenChartModal } from "@/app/contexts/TokenChartModalContext";
import { tokenChartLabel } from "@/lib/tradingViewEmbed";
import { TokenCallThumb } from "@/components/TokenCallThumb";
import { resolveTokenAvatarUrl } from "@/lib/resolveTokenAvatarUrl";
import { terminalChrome, terminalSurface } from "@/lib/terminalDesignTokens";

type TimeframeId = "daily" | "weekly" | "monthly" | "all";

type LeaderRow = {
  rank: number;
  /** Display label (may differ in casing from Discord login). */
  username: string;
  /** Discord snowflake for `/user/...` links. */
  discordId?: string;
  avatarSrc?: string;
  avgX: number;
  bestX: number;
  calls: number;
  winRate?: number;
  /** vs prior window: positive up, negative down, 0 / omit = flat */
  rankDelta?: number;
};

type TopCallRow = {
  id?: string;
  symbol: string;
  callCa: string;
  /** Dex / snapshot icon when present — same source as Call log. */
  tokenImageUrl?: string | null;
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

// Mock boards removed: this page now renders only API-backed data (or empty states).
const MOCK_USER_LEADERBOARD: Record<TimeframeId, LeaderRow[]> = {
  daily: [],
  weekly: [],
  monthly: [],
  all: [],
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

    return { symbol: sym, multiplier, username, timestamp, callToATH, callCa: "" };
  });
}

const MOCK_INDIV_CALLS: Record<TimeframeId, TopCallRow[]> = {
  daily: [],
  weekly: [],
  monthly: [],
  all: [],
};

const MOCK_MCGBOT_TOP_CALLS: Record<TimeframeId, TopCallRow[]> = {
  daily: [],
  weekly: [],
  monthly: [],
  all: [],
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

type BotMilestoneRow = {
  token: string;
  callCa: string;
  tokenImageUrl?: string | null;
  milestone: string;
  peakMultiple: number;
  ago: string;
};

type LiveBotActivityRow = {
  token: string;
  callCa: string;
  tokenImageUrl?: string | null;
  mc: number;
  ago: string;
};

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
  onOpenChart,
}: {
  rows: TopCallRow[];
  tone?: "default" | "muted" | "bot";
  onOpenChart?: (row: TopCallRow) => void;
}) {
  const sorted = useMemo(
    () => [...rows].sort((a, b) => b.multiplier - a.multiplier),
    [rows]
  );

  const shell =
    tone === "muted"
      ? "rounded-xl border border-zinc-800/80 bg-zinc-950/90 p-3 opacity-[0.94]"
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
              key={row.id ?? `${row.symbol}-${row.username}-${row.timestamp}-${i}`}
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
                <TokenCallThumb
                  symbol={row.symbol}
                  tokenImageUrl={row.tokenImageUrl}
                  mint={row.callCa}
                  tone={tone}
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-zinc-100">{row.symbol}</div>
                  <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-zinc-500">
                    <span className="truncate">
                      {row.username} · {row.timestamp}
                    </span>
                    {onOpenChart && row.callCa ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenChart(row);
                        }}
                        className={
                          tone === "bot"
                            ? "shrink-0 rounded border border-sky-500/35 bg-sky-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sky-100 transition hover:bg-sky-500/25"
                            : tone === "muted"
                              ? "shrink-0 rounded border border-zinc-700/80 bg-zinc-900/60 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-300 transition hover:border-zinc-600 hover:text-zinc-100"
                              : "shrink-0 rounded border border-emerald-500/35 bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-100 transition hover:bg-emerald-500/25"
                        }
                      >
                        Chart
                      </button>
                    ) : null}
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
  const { data: session } = useSession();
  const viewerDiscordId = session?.user?.id?.trim() ?? "";
  const { addNotification } = useNotifications();
  const { openTokenChart } = useTokenChartModal();
  const openIndivChart = useCallback(
    (row: TopCallRow) => {
      if (!row.callCa) return;
      openTokenChart({
        chain: "solana",
        contractAddress: row.callCa,
        tokenTicker: row.symbol,
        tokenImageUrl:
          resolveTokenAvatarUrl({ tokenImageUrl: row.tokenImageUrl, mint: row.callCa }) ?? null,
      });
    },
    [openTokenChart]
  );

  const copyMintToClipboard = useCallback(
    async (ca: string) => {
      const mint = ca.trim();
      if (!mint) {
        addNotification({
          id: crypto.randomUUID(),
          text: "No contract address on this row.",
          type: "call",
          createdAt: Date.now(),
          priority: "low",
          silent: true,
        });
        return;
      }
      try {
        await navigator.clipboard.writeText(mint);
        addNotification({
          id: crypto.randomUUID(),
          text: "Contract address copied to clipboard.",
          type: "call",
          createdAt: Date.now(),
          priority: "low",
          silent: true,
        });
      } catch {
        addNotification({
          id: crypto.randomUUID(),
          text: "Could not copy — allow clipboard access for this site.",
          type: "call",
          createdAt: Date.now(),
          priority: "low",
          silent: true,
        });
      }
    },
    [addNotification]
  );
  const [usersTimeframe, setUsersTimeframe] = useState<TimeframeId>("daily");
  const [userPage, setUserPage] = useState(1);
  const [indivTimeframe, setIndivTimeframe] = useState<TimeframeId>("daily");
  const [indivPage, setIndivPage] = useState(1);
  const [indivRows, setIndivRows] = useState<TopCallRow[]>([]);
  const [indivTotal, setIndivTotal] = useState(0);
  const [indivLoading, setIndivLoading] = useState(true);
  const [mcgbotTimeframe, setMcgbotTimeframe] = useState<TimeframeId>("daily");
  const [mcgbotPage, setMcgbotPage] = useState(1);
  const [mcgbotTopRows, setMcgbotTopRows] = useState<TopCallRow[]>([]);
  const [mcgbotTopTotal, setMcgbotTopTotal] = useState(0);
  const [mcgbotTopLoading, setMcgbotTopLoading] = useState(true);
  /** #1 bot call by ATH multiple (all-time), for the “Best Bot Call” KPI — from top-calls, not aggregate board. */
  const [botBestAllTimeKpi, setBotBestAllTimeKpi] = useState<{ symbol: string; multiplier: number } | null>(
    null
  );
  const [botBestAllTimeKpiReady, setBotBestAllTimeKpiReady] = useState(false);
  const [botBestAllTimeKpiForbidden, setBotBestAllTimeKpiForbidden] = useState(false);
  const [usersLoading, setUsersLoading] = useState(true);
  const [usersBoards, setUsersBoards] = useState<Record<TimeframeId, LeaderRow[]>>({
    daily: [],
    weekly: [],
    monthly: [],
    all: [],
  });
  const [botBoards, setBotBoards] = useState<Record<TimeframeId, LeaderRow[]>>({
    daily: [],
    weekly: [],
    monthly: [],
    all: [],
  });
  const [botFeedLoading, setBotFeedLoading] = useState(true);
  const [botMilestones, setBotMilestones] = useState<BotMilestoneRow[]>([]);
  const [botLiveActivity, setBotLiveActivity] = useState<LiveBotActivityRow[]>([]);
  const [spotlightLoading, setSpotlightLoading] = useState(true);
  const [spotlight, setSpotlight] = useState<{
    daily: LeaderRow | null;
    weekly: LeaderRow | null;
    monthly: LeaderRow | null;
  }>({ daily: null, weekly: null, monthly: null });

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

  const periodFor = (tf: TimeframeId): string => {
    if (tf === "daily") return "today";
    if (tf === "weekly") return "week";
    if (tf === "monthly") return "30d";
    return "all";
  };

  function normalizeBoardRows(raw: unknown): LeaderRow[] {
    if (!Array.isArray(raw)) return [];
    const out: LeaderRow[] = [];
    for (const item of raw) {
      if (!item || typeof item !== "object") continue;
      const o = item as Record<string, unknown>;
      const rank = typeof o.rank === "number" ? o.rank : Number(o.rank) || 0;
      const username = typeof o.username === "string" ? o.username.trim() : "";
      const discordRaw = o.discordId ?? o.discord_id;
      const discordId =
        typeof discordRaw === "string" && discordRaw.trim()
          ? discordRaw.trim()
          : "";
      const avgX = typeof o.avgX === "number" ? o.avgX : Number(o.avgX) || 0;
      const bestMultiple =
        typeof o.bestMultiple === "number" ? o.bestMultiple : Number(o.bestMultiple) || 0;
      const totalCalls =
        typeof o.totalCalls === "number" ? o.totalCalls : Number(o.totalCalls) || 0;
      const wins = typeof o.wins === "number" ? o.wins : Number(o.wins) || 0;
      const avRaw = o.avatarUrl ?? o.avatar_url ?? o.discord_avatar_url;
      const avatarFromApi =
        typeof avRaw === "string" && avRaw.trim() ? avRaw.trim().slice(0, 800) : undefined;
      if (!rank || !username) continue;
      out.push({
        rank,
        username,
        discordId: discordId || undefined,
        avatarSrc: avatarFromApi || avatarUrlFor(username),
        avgX,
        bestX: bestMultiple,
        calls: totalCalls,
        winRate: totalCalls > 0 ? Math.round((wins / totalCalls) * 100) : 0,
      });
    }
    return out;
  }

  useEffect(() => {
    let cancelled = false;
    setUsersLoading(true);
    void (async () => {
      try {
        const results = await Promise.all(
          (["daily", "weekly", "monthly", "all"] as const).map(async (tf) => {
            const res = await fetch(
              `/api/leaderboard?type=user&period=${encodeURIComponent(periodFor(tf))}`,
              { credentials: "same-origin" }
            );
            const json = (await res.json().catch(() => null)) as unknown;
            return [tf, normalizeBoardRows(res.ok ? json : [])] as const;
          })
        );
        if (cancelled) return;
        setUsersBoards((prev) => {
          const next = { ...prev };
          for (const [tf, rows] of results) next[tf] = rows;
          return next;
        });
      } catch {
        if (!cancelled) {
          setUsersBoards({ daily: [], weekly: [], monthly: [], all: [] });
        }
      } finally {
        if (!cancelled) setUsersLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const results = await Promise.all(
          (["daily", "weekly", "monthly", "all"] as const).map(async (tf) => {
            const res = await fetch(
              `/api/leaderboard?type=bot&period=${encodeURIComponent(periodFor(tf))}`,
              { credentials: "same-origin" }
            );
            const json = (await res.json().catch(() => null)) as unknown;
            return [tf, normalizeBoardRows(res.ok ? json : [])] as const;
          })
        );
        if (cancelled) return;
        setBotBoards((prev) => {
          const next = { ...prev };
          for (const [tf, rows] of results) next[tf] = rows;
          return next;
        });
      } catch {
        if (!cancelled) {
          setBotBoards({ daily: [], weekly: [], monthly: [], all: [] });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!viewerDiscordId) {
      setBotMilestones([]);
      setBotLiveActivity([]);
      setBotFeedLoading(false);
      return;
    }
    setBotFeedLoading(true);
    void (async () => {
      try {
        const res = await fetch("/api/leaderboard/bot-feed", {
          credentials: "same-origin",
          cache: "no-store",
        });
        const json = (await res.json().catch(() => ({}))) as {
          success?: boolean;
          milestones?: unknown[];
          live?: unknown[];
        };
        if (cancelled) return;
        if (!res.ok || json.success !== true) {
          setBotMilestones([]);
          setBotLiveActivity([]);
          return;
        }
        const rawM = Array.isArray(json.milestones) ? json.milestones : [];
        const rawL = Array.isArray(json.live) ? json.live : [];
        const nextM: BotMilestoneRow[] = [];
        for (const item of rawM) {
          if (!item || typeof item !== "object") continue;
          const o = item as Record<string, unknown>;
          const token = typeof o.token === "string" ? o.token : "—";
          const callCaRaw = o.callCa ?? o.call_ca;
          const callCa =
            typeof callCaRaw === "string" ? callCaRaw.trim() : String(callCaRaw ?? "").trim();
          const imgRaw = o.tokenImageUrl ?? o.token_image_url;
          const tokenImageUrl =
            typeof imgRaw === "string" && imgRaw.trim() ? imgRaw.trim().slice(0, 800) : null;
          const milestone = typeof o.milestone === "string" ? o.milestone : "2x";
          const peak =
            typeof o.peakMultiple === "number" && Number.isFinite(o.peakMultiple)
              ? o.peakMultiple
              : Number(o.peakMultiple) || 0;
          const iso = typeof o.callTimeIso === "string" ? o.callTimeIso : "";
          nextM.push({
            token,
            callCa,
            tokenImageUrl,
            milestone,
            peakMultiple: peak,
            ago: formatRelativeTime(iso),
          });
        }
        const nextL: LiveBotActivityRow[] = [];
        for (const item of rawL) {
          if (!item || typeof item !== "object") continue;
          const o = item as Record<string, unknown>;
          const token = typeof o.token === "string" ? o.token : "—";
          const callCaRaw = o.callCa ?? o.call_ca;
          const callCa =
            typeof callCaRaw === "string" ? callCaRaw.trim() : String(callCaRaw ?? "").trim();
          const imgRaw = o.tokenImageUrl ?? o.token_image_url;
          const tokenImageUrl =
            typeof imgRaw === "string" && imgRaw.trim() ? imgRaw.trim().slice(0, 800) : null;
          const mc =
            typeof o.mc === "number" && Number.isFinite(o.mc) ? o.mc : Number(o.mc) || 0;
          const iso = typeof o.callTimeIso === "string" ? o.callTimeIso : "";
          nextL.push({ token, callCa, tokenImageUrl, mc, ago: formatRelativeTime(iso) });
        }
        setBotMilestones(nextM);
        setBotLiveActivity(nextL);
      } catch {
        if (!cancelled) {
          setBotMilestones([]);
          setBotLiveActivity([]);
        }
      } finally {
        if (!cancelled) setBotFeedLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [viewerDiscordId]);

  useEffect(() => {
    let cancelled = false;
    setIndivLoading(true);
    const limit = 10;
    const offset = (indivPage - 1) * limit;
    void (async () => {
      try {
        const res = await fetch(
          `/api/leaderboard/top-calls?type=user&period=${encodeURIComponent(periodFor(indivTimeframe))}&limit=${limit}&offset=${offset}`,
          { credentials: "same-origin" }
        );
        const json = (await res.json().catch(() => null)) as unknown;
        if (cancelled) return;
        if (!res.ok || !json || typeof json !== "object") {
          setIndivRows([]);
          setIndivTotal(0);
          return;
        }
        const payload = json as {
          rows?: unknown[];
          total?: unknown;
        };
        const total =
          typeof payload.total === "number" && Number.isFinite(payload.total)
            ? payload.total
            : Number(payload.total) || 0;
        setIndivTotal(total);
        const rawRows = Array.isArray(payload.rows) ? payload.rows : [];
        const mapped: TopCallRow[] = [];
        for (const item of rawRows) {
          if (!item || typeof item !== "object") continue;
          const r = item as Record<string, unknown>;
          const id = r.id != null ? String(r.id) : undefined;
          const symbol = typeof r.symbol === "string" ? r.symbol : "—";
          const multRaw = r.multiplier;
          const multiplier =
            typeof multRaw === "number" && Number.isFinite(multRaw)
              ? multRaw
              : Number(multRaw) || 0;
          const username = typeof r.username === "string" ? r.username : "—";
          const iso = typeof r.callTimeIso === "string" ? r.callTimeIso : null;
          const callToATH = typeof r.callToAth === "string" ? r.callToAth : "—";
          const imgRaw = r.tokenImageUrl ?? r.token_image_url;
          const tokenImageUrl =
            typeof imgRaw === "string" && imgRaw.trim()
              ? imgRaw.trim().slice(0, 800)
              : null;
          const callCaRaw = r.callCa ?? r.call_ca;
          const callCa =
            typeof callCaRaw === "string" ? callCaRaw.trim() : String(callCaRaw ?? "").trim();
          mapped.push({
            id,
            symbol,
            callCa,
            tokenImageUrl,
            multiplier,
            username,
            timestamp: formatRelativeTime(iso),
            callToATH,
          });
        }
        setIndivRows(mapped);
      } catch {
        if (!cancelled) {
          setIndivRows([]);
          setIndivTotal(0);
        }
      } finally {
        if (!cancelled) setIndivLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [indivPage, indivTimeframe]);

  useEffect(() => {
    let cancelled = false;
    if (!viewerDiscordId) {
      setMcgbotTopRows([]);
      setMcgbotTopTotal(0);
      setMcgbotTopLoading(false);
      return;
    }
    setMcgbotTopLoading(true);
    const limit = 10;
    const offset = (mcgbotPage - 1) * limit;
    void (async () => {
      try {
        const res = await fetch(
          `/api/leaderboard/top-calls?type=bot&period=${encodeURIComponent(periodFor(mcgbotTimeframe))}&limit=${limit}&offset=${offset}`,
          { credentials: "same-origin" }
        );
        const json = (await res.json().catch(() => null)) as unknown;
        if (cancelled) return;
        if (res.status === 403 || !res.ok || !json || typeof json !== "object") {
          setMcgbotTopRows([]);
          setMcgbotTopTotal(0);
          return;
        }
        const payload = json as {
          rows?: unknown[];
          total?: unknown;
        };
        const total =
          typeof payload.total === "number" && Number.isFinite(payload.total)
            ? payload.total
            : Number(payload.total) || 0;
        setMcgbotTopTotal(total);
        const rawRows = Array.isArray(payload.rows) ? payload.rows : [];
        const mapped: TopCallRow[] = [];
        for (const item of rawRows) {
          if (!item || typeof item !== "object") continue;
          const r = item as Record<string, unknown>;
          const id = r.id != null ? String(r.id) : undefined;
          const symbol = typeof r.symbol === "string" ? r.symbol : "—";
          const multRaw = r.multiplier;
          const multiplier =
            typeof multRaw === "number" && Number.isFinite(multRaw)
              ? multRaw
              : Number(multRaw) || 0;
          const username = typeof r.username === "string" ? r.username : "—";
          const iso = typeof r.callTimeIso === "string" ? r.callTimeIso : null;
          const callToATH = typeof r.callToAth === "string" ? r.callToAth : "—";
          const imgRaw = r.tokenImageUrl ?? r.token_image_url;
          const tokenImageUrl =
            typeof imgRaw === "string" && imgRaw.trim()
              ? imgRaw.trim().slice(0, 800)
              : null;
          const callCaRaw = r.callCa ?? r.call_ca;
          const callCa =
            typeof callCaRaw === "string" ? callCaRaw.trim() : String(callCaRaw ?? "").trim();
          mapped.push({
            id,
            symbol,
            callCa,
            tokenImageUrl,
            multiplier,
            username,
            timestamp: formatRelativeTime(iso),
            callToATH,
          });
        }
        setMcgbotTopRows(mapped);
      } catch {
        if (!cancelled) {
          setMcgbotTopRows([]);
          setMcgbotTopTotal(0);
        }
      } finally {
        if (!cancelled) setMcgbotTopLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mcgbotPage, mcgbotTimeframe, viewerDiscordId]);

  useEffect(() => {
    let cancelled = false;
    if (!viewerDiscordId) {
      setBotBestAllTimeKpi(null);
      setBotBestAllTimeKpiForbidden(false);
      setBotBestAllTimeKpiReady(true);
      return;
    }
    setBotBestAllTimeKpiReady(false);
    setBotBestAllTimeKpiForbidden(false);
    void (async () => {
      try {
        const res = await fetch(
          `/api/leaderboard/top-calls?type=bot&period=${encodeURIComponent("all")}&limit=1&offset=0`,
          { credentials: "same-origin" }
        );
        const json = (await res.json().catch(() => null)) as unknown;
        if (cancelled) return;
        if (res.status === 403) {
          setBotBestAllTimeKpiForbidden(true);
          setBotBestAllTimeKpi(null);
          return;
        }
        if (!res.ok || !json || typeof json !== "object") {
          setBotBestAllTimeKpi(null);
          return;
        }
        const rawRows = Array.isArray((json as { rows?: unknown[] }).rows)
          ? (json as { rows: unknown[] }).rows
          : [];
        const first = rawRows[0];
        if (!first || typeof first !== "object") {
          setBotBestAllTimeKpi(null);
          return;
        }
        const r = first as Record<string, unknown>;
        const symbol = typeof r.symbol === "string" ? r.symbol : "—";
        const multRaw = r.multiplier;
        const multiplier =
          typeof multRaw === "number" && Number.isFinite(multRaw)
            ? multRaw
            : Number(multRaw) || 0;
        setBotBestAllTimeKpi({ symbol, multiplier });
      } catch {
        if (!cancelled) setBotBestAllTimeKpi(null);
      } finally {
        if (!cancelled) setBotBestAllTimeKpiReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [viewerDiscordId]);

  const userRows = useMemo(
    () => (usersBoards[usersTimeframe] ?? []).slice((userPage - 1) * 10, userPage * 10),
    [usersBoards, usersTimeframe, userPage]
  );

  const indivPageCount = Math.min(5, Math.max(1, Math.ceil(indivTotal / 10) || 1));

  useEffect(() => {
    setIndivPage((p) => Math.min(p, indivPageCount));
  }, [indivPageCount]);

  const userPageCount = Math.min(
    5,
    Math.max(1, Math.ceil((usersBoards[usersTimeframe]?.length ?? 0) / 10) || 1)
  );

  useEffect(() => {
    setUserPage((p) => Math.min(p, userPageCount));
  }, [userPageCount]);

  const mcgbotPageCount = Math.min(5, Math.max(1, Math.ceil(mcgbotTopTotal / 10) || 1));

  useEffect(() => {
    setMcgbotPage((p) => Math.min(p, mcgbotPageCount));
  }, [mcgbotPageCount]);

  const botSummary = useMemo(() => {
    const all = botBoards.all ?? [];
    const best = all[0] ?? null;
    return {
      bestSymbol: best ? best.username : "—",
      bestMultiplier: best ? best.bestX : 0,
      avgMultiplier: all.length > 0 ? all.reduce((sum, r) => sum + r.avgX, 0) / all.length : 0,
      totalCalls: all.reduce((sum, r) => sum + r.calls, 0),
      winRate: 0,
      avgToAth: "—",
      avgTo2x: "—",
    };
  }, [botBoards.all]);

  const bestBotCallKpiDisplay = useMemo(() => {
    if (!viewerDiscordId) {
      return {
        mult: botSummary.bestMultiplier,
        label: botSummary.bestSymbol,
        labelMuted: false,
      };
    }
    if (!botBestAllTimeKpiReady) {
      return {
        mult: botSummary.bestMultiplier,
        label: "Loading…",
        labelMuted: true,
      };
    }
    if (botBestAllTimeKpiForbidden) {
      return {
        mult: botSummary.bestMultiplier,
        label: "Bot call detail requires the right plan",
        labelMuted: true,
      };
    }
    if (botBestAllTimeKpi && botBestAllTimeKpi.multiplier > 0) {
      return {
        mult: botBestAllTimeKpi.multiplier,
        label: botBestAllTimeKpi.symbol,
        labelMuted: false,
      };
    }
    return {
      mult: botSummary.bestMultiplier,
      label: "No qualifying bot calls yet",
      labelMuted: true,
    };
  }, [
    viewerDiscordId,
    botBestAllTimeKpiReady,
    botBestAllTimeKpiForbidden,
    botBestAllTimeKpi,
    botSummary.bestMultiplier,
    botSummary.bestSymbol,
  ]);

  const allTimeRecords = useMemo(() => {
    const empty: LeaderRow = {
      rank: 0,
      username: "—",
      avgX: 0,
      bestX: 0,
      calls: 0,
      winRate: undefined,
    };

    const all = usersBoards.all ?? [];
    if (all.length === 0) {
      return {
        highestMultiplierUser: empty,
        bestAverageUser: empty,
        mostCalls: empty,
        bestWinRateUser: { ...empty, winRate: undefined },
      };
    }

    const byBestX = all.reduce((a, b) => (b.bestX > a.bestX ? b : a), all[0]);
    const byAvgX = all.reduce((a, b) => (b.avgX > a.avgX ? b : a), all[0]);
    const byCalls = all.reduce((a, b) => (b.calls > a.calls ? b : a), all[0]);

    const MIN_CALLS_WINRATE = 5;
    const winEligible = all.filter((r) => r.calls >= MIN_CALLS_WINRATE);
    const byWinRate =
      winEligible.length > 0
        ? winEligible.reduce((a, b) => ((b.winRate ?? 0) > (a.winRate ?? 0) ? b : a), winEligible[0])
        : { ...empty, winRate: undefined };

    return {
      highestMultiplierUser: byBestX,
      bestAverageUser: byAvgX,
      mostCalls: byCalls,
      bestWinRateUser: byWinRate,
    };
  }, [usersBoards]);

  useEffect(() => {
    let cancelled = false;
    setSpotlightLoading(true);
    void (async () => {
      try {
        const [dailyRes, weeklyRes, monthlyRes] = await Promise.all([
          fetch(`/api/leaderboard?type=user&period=today`, { credentials: "same-origin" }),
          fetch(`/api/leaderboard/weekly-leader?type=user`, { credentials: "same-origin" }),
          fetch(`/api/leaderboard/monthly-leader?type=user`, { credentials: "same-origin" }),
        ]);
        const dailyJson = (await dailyRes.json().catch(() => null)) as unknown;
        const weeklyJson = (await weeklyRes.json().catch(() => null)) as { leader?: unknown } | null;
        const monthlyJson = (await monthlyRes.json().catch(() => null)) as { leader?: unknown } | null;

        if (cancelled) return;
        const dailyTop = normalizeBoardRows(dailyRes.ok ? dailyJson : [])[0] ?? null;
        const weeklyTop = normalizeBoardRows(
          weeklyRes.ok && weeklyJson && typeof weeklyJson === "object"
            ? [
                {
                  rank: 1,
                  username: (weeklyJson as any).leader?.username,
                  discordId: (weeklyJson as any).leader?.discordId,
                  avatarUrl: (weeklyJson as any).leader?.avatarUrl,
                  avgX: (weeklyJson as any).leader?.avgX,
                  bestMultiple: (weeklyJson as any).leader?.bestMultiple,
                  totalCalls: (weeklyJson as any).leader?.totalCalls,
                  wins: (weeklyJson as any).leader?.wins,
                },
              ]
            : []
        )[0] ?? null;
        const monthlyTop = normalizeBoardRows(
          monthlyRes.ok && monthlyJson && typeof monthlyJson === "object"
            ? [
                {
                  rank: 1,
                  username: (monthlyJson as any).leader?.username,
                  discordId: (monthlyJson as any).leader?.discordId,
                  avatarUrl: (monthlyJson as any).leader?.avatarUrl,
                  avgX: (monthlyJson as any).leader?.avgX,
                  bestMultiple: (monthlyJson as any).leader?.bestMultiple,
                  totalCalls: (monthlyJson as any).leader?.totalCalls,
                  wins: (monthlyJson as any).leader?.wins,
                },
              ]
            : []
        )[0] ?? null;

        setSpotlight({ daily: dailyTop, weekly: weeklyTop, monthly: monthlyTop });
      } catch {
        if (!cancelled) setSpotlight({ daily: null, weekly: null, monthly: null });
      } finally {
        if (!cancelled) setSpotlightLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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

  const Table = ({
    rows,
    loading,
    highlightDiscordId,
  }: {
    rows: LeaderRow[];
    loading: boolean;
    highlightDiscordId?: string | null;
  }) => {
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
              {loading ? (
                <div className="flex items-center justify-center px-3 py-10">
                  <p className="text-sm text-zinc-500">Loading…</p>
                </div>
              ) : rows.length === 0 ? (
                <div className="flex items-center justify-center px-3 py-10">
                  <div className="text-center">
                    <p className="text-sm font-semibold text-zinc-200">No calls yet</p>
                    <p className="mt-1 text-xs text-zinc-500">
                      Leaderboards will populate once calls start coming in.
                    </p>
                  </div>
                </div>
              ) : (
                rows.map((r) => {
                const isYou =
                  Boolean(highlightDiscordId) &&
                  Boolean(r.discordId) &&
                  r.discordId === highlightDiscordId;
                return (
                  <div
                    key={`${r.rank}-${r.username}`}
                    className={[
                      "group/row flex items-center justify-between gap-3 rounded-xl border px-2.5 py-2 transition-all duration-200 sm:px-3",
                      "hover:bg-emerald-950/30 hover:shadow-[0_0_18px_-6px_rgba(16,185,129,0.12)]",
                      podiumRowClass(r.rank),
                      isYou
                        ? "ring-1 ring-emerald-400/35 ring-offset-2 ring-offset-[color:var(--mcg-page)]"
                        : "",
                    ].join(" ")}
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-2.5 pr-1 sm:gap-3">
                      <div className="w-7 shrink-0 text-right text-[11px] font-semibold tabular-nums text-zinc-500 sm:w-8">
                        #{r.rank}
                      </div>
                      <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-full ring-1 ring-zinc-600/45 transition group-hover/row:ring-emerald-500/25">
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
              })
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const sectionTitle = "text-base font-semibold tracking-tight text-zinc-100";

  return (
    <div className="text-zinc-100">
      <div className="mx-auto w-full max-w-[1100px] space-y-6 px-4 py-6 sm:px-6 sm:py-8 lg:py-9">
        <header
          className="relative overflow-hidden rounded-2xl border border-zinc-800/90 bg-gradient-to-br from-zinc-900/90 via-zinc-950 to-[color:var(--mcg-stage)] p-5 shadow-[0_24px_60px_-40px_rgba(0,0,0,0.88)] ring-1 ring-zinc-700/15 sm:p-7"
          data-tutorial="leaderboard.header"
        >
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
              The public scoreboard for callers and automation. Your own charts and row-by-row history
              live on <Link href="/performance" className="text-cyan-200/90 underline-offset-2 hover:underline">Performance</Link>{" "}
              and <Link href="/calls" className="text-cyan-200/90 underline-offset-2 hover:underline">Call log</Link> — this
              route is only the arena everyone shares.
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
          </div>
        </header>

      <section
        id="your-terminal"
        className="scroll-mt-24 rounded-lg border border-zinc-800/75 bg-zinc-950/40 px-3 py-2 ring-1 ring-white/[0.02] sm:px-4"
        aria-label="Links to your private call pages"
      >
        <p className="text-[11px] leading-snug text-zinc-500">
          Private row history and charts (not leaderboards):{" "}
          <Link href="/calls" className="font-semibold text-cyan-300/95 underline-offset-2 hover:text-cyan-200 hover:underline">
            Call log
          </Link>
          <span className="text-zinc-600"> · </span>
          <Link
            href="/performance"
            className="font-semibold text-emerald-300/95 underline-offset-2 hover:text-emerald-200 hover:underline"
          >
            Performance
          </Link>
        </p>
      </section>

      {/* 1) Leaders */}
      <section id="leaders" className="scroll-mt-28 space-y-4" data-tutorial="leaderboard.spotlight">
        <div>
          <h2 className={sectionTitle}>Leaders</h2>
          <p className="mt-1 text-xs leading-relaxed text-zinc-500">
            Faces on the board rotate with performance — the strip is reserved for people who ship
            signals others actually follow.
          </p>
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          {(
            [
              { label: "Daily Leader", row: spotlight.daily },
              { label: "Weekly Leader", row: spotlight.weekly },
              { label: "Monthly Leader", row: spotlight.monthly },
            ] as const
          ).map((slot, idx) => {
            const w = slot.row;
            const profileSeg =
              w?.discordId && looksLikeDiscordSnowflake(w.discordId)
                ? w.discordId.trim()
                : w?.username && w.username !== "—"
                  ? w.username.trim()
                  : w?.discordId?.trim() || "";
            const clickable = Boolean(profileSeg);
            return (
              <div
                key={slot.label}
                className={`group relative transition-all ${clickable ? "cursor-pointer" : "cursor-default"}`}
                onClick={() => {
                  if (clickable)
                    router.push(`/user/${encodeURIComponent(profileSeg)}`);
                }}
              >
                <div className="relative rounded-xl border border-[#2a2415] bg-gradient-to-br from-[#161308] via-[#0c0c0c] to-zinc-950 p-6 shadow-[0_0_28px_rgba(255,215,0,0.12)] transition-all hover:bg-zinc-900/60 hover:shadow-[0_0_36px_rgba(255,215,0,0.18)]">
                  <div className="absolute left-4 top-4 flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-800/70 bg-black/50 text-xs font-black tabular-nums text-zinc-200 shadow-inner backdrop-blur-sm">
                    {idx + 1}
                  </div>
                  <div className="pr-36 pl-12">
                    <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-yellow-500/80">
                      {slot.label}
                    </p>
                    <p className="text-base font-medium text-zinc-100">
                      {spotlightLoading ? "Loading…" : w?.username ?? "—"}
                    </p>
                    <p className="mt-3 text-xs text-zinc-600">Best multiple</p>
                    <div className="mt-1">
                      <span className="text-sm font-medium text-zinc-200">
                        {spotlightLoading ? "—" : fmtX(w?.bestX ?? 0)}
                      </span>
                    </div>
                    <p className="mt-3 text-xs text-zinc-600">Avg</p>
                    <div className="mt-1 text-sm font-medium text-zinc-200">
                      {spotlightLoading ? "—" : fmtX(w?.avgX ?? 0)}
                    </div>
                  </div>

                  <div className="absolute right-4 top-7 h-16 w-16 overflow-hidden rounded-full opacity-90 transition-opacity hover:opacity-100 sm:h-20 sm:w-20">
                    <Avatar src={w?.avatarSrc} name={w?.username ?? "—"} size="lg" />
                  </div>

                  <div className="absolute bottom-5 right-6">
                    <span className="text-lg font-semibold tabular-nums text-emerald-400">
                      {spotlightLoading ? "—" : fmtX(w?.avgX ?? 0)}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
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
        <div className="rounded-xl border border-zinc-900 bg-zinc-950/40 p-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <div className="relative rounded-xl border border-zinc-800/90 bg-zinc-900/40 p-3">
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

                <div className="absolute right-6 top-5 h-9 w-9 overflow-hidden rounded-full opacity-90 transition-opacity hover:opacity-100">
                  <Avatar
                    src={allTimeRecords.highestMultiplierUser?.avatarSrc}
                    name={allTimeRecords.highestMultiplierUser?.username ?? "—"}
                    size="md"
                  />
                </div>
              </div>
              <div className="relative rounded-xl border border-zinc-800/90 bg-zinc-900/40 p-3">
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

                <div className="absolute right-6 top-5 h-9 w-9 overflow-hidden rounded-full opacity-90 transition-opacity hover:opacity-100">
                  <Avatar
                    src={allTimeRecords.bestAverageUser?.avatarSrc}
                    name={allTimeRecords.bestAverageUser?.username ?? "—"}
                    size="md"
                  />
                </div>
              </div>
              <div className="relative rounded-xl border border-zinc-800/90 bg-zinc-900/40 p-3">
                <div className="pr-16">
                  <div className="flex items-start justify-between gap-2">
                    <p className="mb-1 text-xs font-semibold tracking-wide text-zinc-300">
                      MOST CALLS
                    </p>
                    <span className="text-base" aria-hidden />
                  </div>
                  <p className="mt-2.5 text-2xl font-bold tabular-nums tracking-tight text-zinc-100">
                    {allTimeRecords.mostCalls?.username &&
                    allTimeRecords.mostCalls.username !== "—"
                      ? (allTimeRecords.mostCalls.calls ?? 0).toLocaleString()
                      : "—"}
                  </p>
                  <p className="mt-1.5 text-xs text-zinc-500">
                    {allTimeRecords.mostCalls?.username ?? "—"}
                  </p>
                </div>

                <div className="absolute right-6 top-5 h-9 w-9 overflow-hidden rounded-full opacity-90 transition-opacity hover:opacity-100">
                  <Avatar
                    src={allTimeRecords.mostCalls?.avatarSrc}
                    name={allTimeRecords.mostCalls?.username ?? "—"}
                    size="md"
                  />
                </div>
              </div>
              <div className="relative rounded-xl border border-zinc-800/90 bg-zinc-900/40 p-3">
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

                <div className="absolute right-6 top-5 h-9 w-9 overflow-hidden rounded-full opacity-90 transition-opacity hover:opacity-100">
                  <Avatar
                    src={allTimeRecords.bestWinRateUser?.avatarSrc}
                    name={allTimeRecords.bestWinRateUser?.username ?? "—"}
                    size="md"
                  />
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
        <div className="relative overflow-hidden rounded-2xl border border-emerald-500/25 bg-gradient-to-br from-emerald-950/25 via-zinc-950 to-zinc-950 shadow-[0_0_0_1px_rgba(16,185,129,0.12),0_28px_70px_-42px_rgba(0,0,0,0.92)] ring-1 ring-emerald-400/15">
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

            <div
              id="user-boards"
              className="scroll-mt-28 space-y-8 border-t border-emerald-500/10 pt-8"
            >
        {/* User Leaderboard — tour anchor matches bot header strip (`leaderboard.botSection`): compact row only */}
        <section className="space-y-4">
          <div
            className="relative border-b border-emerald-500/15 bg-emerald-950/20 px-4 py-4 sm:px-5 sm:py-5"
            data-tutorial="leaderboard.userBoard"
          >
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
          </div>
          <Table
            rows={userRows}
            loading={usersLoading}
            highlightDiscordId={viewerDiscordId || null}
          />
          <div className="mt-4 flex flex-wrap items-center justify-center gap-1.5">
            {Array.from({ length: userPageCount }, (_, i) => i + 1).map((p) => {
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
          <section className="space-y-4" data-tutorial="leaderboard.topCalls">
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
            {indivLoading ? (
              <div className="flex items-center justify-center rounded-xl border border-emerald-500/20 bg-emerald-950/10 px-3 py-12 ring-1 ring-emerald-500/10">
                <p className="text-sm text-zinc-500">Loading…</p>
              </div>
            ) : indivRows.length === 0 ? (
              <div className="flex items-center justify-center rounded-xl border border-emerald-500/20 bg-emerald-950/10 px-3 py-12 ring-1 ring-emerald-500/10">
                <div className="text-center">
                  <p className="text-sm font-semibold text-zinc-200">No qualifying calls in this window</p>
                  <p className="mt-1 text-xs text-zinc-500">
                    Try another timeframe or check back after new calls land.
                  </p>
                </div>
              </div>
            ) : (
              <TopCallsList rows={indivRows} tone="default" onOpenChart={openIndivChart} />
            )}
            <div className="mt-4 flex flex-wrap items-center justify-center gap-1.5">
              {Array.from({ length: indivPageCount }, (_, i) => i + 1).map((p) => {
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
        <div className="relative overflow-hidden rounded-2xl border border-sky-500/25 bg-gradient-to-br from-sky-950/35 via-zinc-950 to-zinc-950 shadow-[0_0_0_1px_rgba(56,189,248,0.12),0_28px_70px_-42px_rgba(0,0,0,0.92)] ring-1 ring-sky-400/15">
          <div
            className="pointer-events-none absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-sky-400/90 via-sky-500/60 to-cyan-600/50"
            aria-hidden
          />
          <div
            className="relative border-b border-sky-500/15 bg-sky-950/20 px-5 py-5 sm:px-6"
            data-tutorial="leaderboard.botSection"
          >
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
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3" data-tutorial="leaderboard.botStats">
          <div
            className={`rounded-xl border border-sky-500/15 bg-sky-950/20 p-4 ${terminalSurface.botKpiInset}`}
          >
            <div className="flex items-start justify-between gap-2">
              <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-zinc-400">
                Best Bot Call (All-Time)
              </p>
              <span className="text-base" aria-hidden />
            </div>
            <p className="mt-2.5 text-2xl font-bold tabular-nums tracking-tight text-sky-300">
              {fmtX(bestBotCallKpiDisplay.mult)}
            </p>
            <p
              className={`mt-1.5 text-xs ${bestBotCallKpiDisplay.labelMuted ? "text-zinc-600" : "text-zinc-500"}`}
            >
              {bestBotCallKpiDisplay.label}
            </p>
          </div>

          <div
            className={`rounded-xl border border-sky-500/15 bg-sky-950/20 p-4 ${terminalSurface.botKpiInset}`}
          >
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

          <div
            className={`rounded-xl border border-sky-500/15 bg-sky-950/20 p-4 ${terminalSurface.botKpiInset}`}
          >
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

          <div
            className={`rounded-xl border border-sky-500/15 bg-sky-950/20 p-4 ${terminalSurface.botKpiInset}`}
          >
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

          <div
            className={`rounded-xl border border-sky-500/15 bg-sky-950/20 p-4 ${terminalSurface.botKpiInset}`}
          >
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

          <div
            className={`rounded-xl border border-sky-500/15 bg-sky-950/20 p-4 ${terminalSurface.botKpiInset}`}
          >
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
          <div
            className="flex h-full max-h-[340px] flex-col rounded-xl border border-sky-500/15 bg-sky-950/15 p-4 ring-1 ring-sky-500/10"
            data-tutorial="leaderboard.botMilestones"
          >
            <div className="mb-2 flex items-start justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold text-zinc-100">Recent Milestone Hits</h3>
                <p className="mt-0.5 text-xs text-sky-100/40">
                  {botFeedLoading
                    ? "Loading recent bot calls…"
                    : botMilestones.length > 0
                      ? "Last 90 days — calls that reached at least 2× peak (Supabase snapshot)."
                      : "No qualifying bot calls in the last 90 days, or upgrade to Pro/Elite to view bot stats here."}
                </p>
              </div>
              <span className="shrink-0 rounded bg-sky-500/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-sky-200/90">
                Bot
              </span>
            </div>
            <div className={`${terminalChrome.scrollYHidden} flex-1 rounded-xl border border-sky-500/10 bg-black/30 p-3`}>
              <ul className="space-y-0.5">
                {!botFeedLoading && botMilestones.length === 0 ? (
                  <li className="flex items-center justify-center px-3 py-10 text-sm text-zinc-500">
                    No entries yet
                  </li>
                ) : null}
                {botFeedLoading ? (
                  <li className="flex items-center justify-center px-3 py-10 text-sm text-zinc-500">
                    Loading…
                  </li>
                ) : null}
                {botMilestones.map((row, idx) => (
                  <li
                    key={`${row.callCa || row.token}-${row.milestone}-${idx}`}
                    className="flex items-center justify-between gap-3 rounded-lg border border-sky-500/10 bg-sky-950/10 px-3 py-1.5 transition-all duration-150 hover:bg-sky-950/35"
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-2">
                      <button
                        type="button"
                        title="Copy contract address"
                        onClick={() => void copyMintToClipboard(row.callCa)}
                        className="shrink-0 rounded-lg border border-transparent p-0 transition hover:border-sky-500/25 hover:bg-sky-950/45 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/40"
                      >
                        <TokenCallThumb
                          symbol={row.token}
                          tokenImageUrl={row.tokenImageUrl ?? null}
                          mint={row.callCa}
                          tone="bot"
                        />
                      </button>
                      <div className="min-w-0 flex-1 text-[11px] leading-snug text-zinc-200">
                        <button
                          type="button"
                          title="Copy contract address"
                          onClick={() => void copyMintToClipboard(row.callCa)}
                          className="font-semibold text-zinc-100 hover:text-white hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/40"
                        >
                          {row.token}
                        </button>{" "}
                        <button
                          type="button"
                          title="Copy contract address"
                          onClick={() => void copyMintToClipboard(row.callCa)}
                          className="inline text-zinc-600 hover:text-zinc-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/40"
                        >
                          <span className="text-zinc-600">≥</span>{" "}
                          <span
                            className={[
                              "font-semibold tabular-nums",
                              row.milestone === "10x" ? "text-amber-300" : "text-sky-300",
                            ].join(" ")}
                          >
                            {row.milestone.replace("x", "×")}
                          </span>{" "}
                          <span className="text-zinc-600">peak</span>{" "}
                        </button>
                        <button
                          type="button"
                          title="Copy contract address"
                          onClick={() => void copyMintToClipboard(row.callCa)}
                          className="inline font-semibold tabular-nums text-sky-200/90 hover:text-sky-100 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/40"
                        >
                          {fmtX(row.peakMultiple)}
                        </button>
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

          {/* Live Bot Activity */}
          <div
            className="flex h-full max-h-[340px] flex-col rounded-xl border border-sky-500/15 bg-sky-950/15 p-4 ring-1 ring-sky-500/10"
            data-tutorial="leaderboard.botLiveActivity"
          >
            <div className="mb-2 flex items-start justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold text-zinc-100">Live Bot Activity</h3>
                <p className="mt-0.5 text-xs text-sky-100/40">
                  {botFeedLoading
                    ? "Loading…"
                    : botLiveActivity.length > 0
                      ? "Last 90 days — most recent McGBot calls (MC at alert)."
                      : "No recent bot calls in the last 90 days, or upgrade to Pro/Elite to view bot stats here."}
                </p>
              </div>
              <span className="shrink-0 rounded bg-sky-500/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-sky-200/90">
                Bot
              </span>
            </div>
            <div className={`${terminalChrome.scrollYHidden} flex-1 rounded-xl border border-sky-500/10 bg-black/30 p-3`}>
              <ul className="space-y-0.5">
                {!botFeedLoading && botLiveActivity.length === 0 ? (
                  <li className="flex items-center justify-center px-3 py-10 text-sm text-zinc-500">
                    No entries yet
                  </li>
                ) : null}
                {botFeedLoading ? (
                  <li className="flex items-center justify-center px-3 py-10 text-sm text-zinc-500">
                    Loading…
                  </li>
                ) : null}
                {botLiveActivity.map((row, idx) => (
                  <li
                    key={`${row.callCa || row.token}-${row.ago}-${idx}`}
                    className="flex items-center justify-between gap-3 rounded-lg border border-sky-500/10 bg-sky-950/10 px-3 py-1.5 transition-all duration-150 hover:bg-sky-950/35"
                  >
                    <div className="flex min-w-0 flex-1 items-start gap-2">
                      <button
                        type="button"
                        title="Copy contract address"
                        onClick={() => void copyMintToClipboard(row.callCa)}
                        className="mt-0.5 shrink-0 rounded-lg border border-transparent p-0 transition hover:border-sky-500/25 hover:bg-sky-950/45 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/40"
                      >
                        <TokenCallThumb
                          symbol={row.token}
                          tokenImageUrl={row.tokenImageUrl ?? null}
                          mint={row.callCa}
                          tone="bot"
                        />
                      </button>
                      <div className="min-w-0 flex-1">
                        <button
                          type="button"
                          title="Copy contract address"
                          onClick={() => void copyMintToClipboard(row.callCa)}
                          className="block max-w-full truncate text-left text-[11px] font-semibold text-zinc-100 hover:text-white hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/40"
                        >
                          {row.token}
                        </button>
                        <div className="max-w-full truncate text-[10px] text-zinc-500">
                          <button
                            type="button"
                            title="Copy contract address"
                            onClick={() => void copyMintToClipboard(row.callCa)}
                            className="hover:text-zinc-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/40"
                          >
                            McGBot called {row.token} @
                          </button>{" "}
                          <button
                            type="button"
                            title="Copy contract address"
                            onClick={() => void copyMintToClipboard(row.callCa)}
                            className="font-semibold tabular-nums text-sky-300 hover:text-sky-200 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/40"
                          >
                            {fmtMC(row.mc)} MC
                          </button>
                        </div>
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

        {/* Top bot calls (ranked by ATH multiple in window) */}
        <div
          className="mt-2 rounded-xl border border-sky-500/20 bg-sky-950/10 p-4 ring-1 ring-sky-500/10"
          data-tutorial="leaderboard.botMcgbotBoard"
        >
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className={sectionTitle}>Top bot calls</h2>
              <span className="rounded-md border border-sky-400/35 bg-sky-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-sky-100">
                McGBot
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
            Highest ATH multiples from McGBot calls in the selected period (same ranking as the individual call
            leaderboard, bot source only).
          </p>
          <div className="mt-6">
            {!viewerDiscordId ? (
              <div className="flex items-center justify-center rounded-xl border border-sky-500/20 bg-sky-950/10 px-3 py-12 ring-1 ring-sky-500/10">
                <p className="text-sm text-zinc-500">Sign in to view bot call rankings.</p>
              </div>
            ) : mcgbotTopLoading ? (
              <div className="flex items-center justify-center rounded-xl border border-sky-500/20 bg-sky-950/10 px-3 py-12 ring-1 ring-sky-500/10">
                <p className="text-sm text-zinc-500">Loading…</p>
              </div>
            ) : mcgbotTopRows.length === 0 ? (
              <div className="flex items-center justify-center rounded-xl border border-sky-500/20 bg-sky-950/10 px-3 py-12 ring-1 ring-sky-500/10">
                <div className="text-center">
                  <p className="text-sm font-semibold text-zinc-200">No qualifying bot calls in this window</p>
                  <p className="mt-1 text-xs text-zinc-500">
                    Try another timeframe, or upgrade if bot stats are restricted for your account.
                  </p>
                </div>
              </div>
            ) : (
              <TopCallsList rows={mcgbotTopRows} tone="bot" onOpenChart={openIndivChart} />
            )}
          </div>
          {viewerDiscordId && mcgbotTopRows.length > 0 ? (
            <div className="mt-4 flex flex-wrap items-center justify-center gap-1.5">
              {Array.from({ length: mcgbotPageCount }, (_, i) => i + 1).map((p) => {
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
          ) : null}
        </div>
          </div>
        </div>
      </section>
      </div>
    </div>
  );
}
