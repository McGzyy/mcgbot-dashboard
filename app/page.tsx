"use client";

import type { WidgetsEnabled } from "@/app/api/dashboard-settings/route";
import {
  useNotifications,
  type NotificationPriority,
} from "@/app/contexts/NotificationsContext";
import { useTokenChartModal } from "@/app/contexts/TokenChartModalContext";
import { ActivityPopup } from "./components/ActivityPopup";
import { AddToWatchlistModal } from "./components/AddToWatchlistModal";
import { ModQueueHomePanel } from "./components/ModQueueHomePanel";
import { VoiceLobbiesShell } from "./components/voice/VoiceLobbiesShell";
import { FollowButton } from "./components/FollowButton";
import { UserBadgeIcons } from "./components/UserBadgeIcons";
import DailyLeaderboardPanel from "@/components/DailyLeaderboardPanel";
import PerformanceChart from "@/components/dashboard/PerformanceChart";
import { useFollowingIds } from "./hooks/useFollowingIds";
import Link from "next/link";
import { signIn, useSession } from "next-auth/react";
import {
  abbreviateCa,
  callTimeMs,
  formatCalledSnapshotLine,
  formatJoinedAt,
  formatNameAndTickerLine,
  multipleClass,
} from "@/lib/callDisplayFormat";
import type { HelpTier } from "@/lib/helpRole";
import {
  DASHBOARD_CHAT_AUTHOR_COLOR,
  type ChatMessagePayload,
} from "@/lib/discordChatMessageSerialize";
import { userProfileHref } from "@/lib/userProfileHref";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

const REF_BASE = "https://mcgbot.xyz/ref";

function discordSignInSafe() {
  // Never pass `window.location.href` as callbackUrl if the current URL already contains
  // NextAuth's `callbackUrl` query param — it recursively nests and can break OAuth.
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  url.searchParams.delete("callbackUrl");
  window.history.replaceState({}, "", url.toString());

  void signIn("discord", { callbackUrl: "/" });
}

/** Mock trending rows; `mint` is a placeholder Solana mint for Dexscreener charts. */
const TRENDING_TOKENS_MOCK = [
  { symbol: "SOLXYZ", stat: 2.4, mint: "So11111111111111111111111111111111111111112" },
  { symbol: "ABC", stat: 1.8, mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v" },
  { symbol: "DEV123", stat: 3.1, mint: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263" },
] as const;

type TrendingTokenRow = {
  symbol: string;
  mint: string;
  priceUsd: number;
  changePct: number;
  liquidityUsd: number;
  volumeUsd: number;
  holders: number;
  source: "Dexscreener" | "Axiom" | "Gecko";
  timeframe: "5m" | "1h" | "24h";
};

const TRENDING_TOKENS_ELITE_MOCK: TrendingTokenRow[] = [
  {
    symbol: "WIF",
    mint: "EKpQGSJtjMFqKZ9q8i7vNQkWQwGJcD3u3wqBzQk9sYtX",
    priceUsd: 2.41,
    changePct: 8.2,
    liquidityUsd: 12_400_000,
    volumeUsd: 18_900_000,
    holders: 184_230,
    source: "Dexscreener",
    timeframe: "1h",
  },
  {
    symbol: "JUP",
    mint: "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN",
    priceUsd: 1.13,
    changePct: -1.4,
    liquidityUsd: 31_800_000,
    volumeUsd: 9_400_000,
    holders: 612_990,
    source: "Dexscreener",
    timeframe: "24h",
  },
  {
    symbol: "BONK",
    mint: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263",
    priceUsd: 0.000028,
    changePct: 3.0,
    liquidityUsd: 9_200_000,
    volumeUsd: 7_600_000,
    holders: 742_100,
    source: "Gecko",
    timeframe: "24h",
  },
  {
    symbol: "PYTH",
    mint: "HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3",
    priceUsd: 0.49,
    changePct: 0.9,
    liquidityUsd: 6_700_000,
    volumeUsd: 3_200_000,
    holders: 221_540,
    source: "Axiom",
    timeframe: "1h",
  },
  {
    symbol: "BOME",
    mint: "ukHH6c7mMyiWCf1b9pnWe25TSpkDDt3H5pQZgZ74J82",
    priceUsd: 0.0142,
    changePct: 5.6,
    liquidityUsd: 4_900_000,
    volumeUsd: 8_100_000,
    holders: 129_870,
    source: "Dexscreener",
    timeframe: "1h",
  },
  {
    symbol: "MEW",
    mint: "MEW1gQWJ3nEXg2qZrJ2Jc8Gd8oZ2e2u9X1pQGqVJ9uQ",
    priceUsd: 0.0068,
    changePct: 12.4,
    liquidityUsd: 2_700_000,
    volumeUsd: 5_900_000,
    holders: 74_220,
    source: "Axiom",
    timeframe: "5m",
  },
  {
    symbol: "POPCAT",
    mint: "7GCihgDB8Y1sZp8V7H9rYw1d3oY5eHc8GQyYqZQKQp5",
    priceUsd: 0.86,
    changePct: -3.8,
    liquidityUsd: 3_300_000,
    volumeUsd: 2_500_000,
    holders: 43_110,
    source: "Gecko",
    timeframe: "1h",
  },
  {
    symbol: "JTO",
    mint: "J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6YVqT7b",
    priceUsd: 2.94,
    changePct: 2.1,
    liquidityUsd: 11_100_000,
    volumeUsd: 4_400_000,
    holders: 98_420,
    source: "Dexscreener",
    timeframe: "24h",
  },
  {
    symbol: "RAY",
    mint: "4k3Dyjzvzp8eMZWK5oAi6n3yJqfY1c7VQ9TzJpJpW6t",
    priceUsd: 1.92,
    changePct: 4.7,
    liquidityUsd: 14_600_000,
    volumeUsd: 6_200_000,
    holders: 201_330,
    source: "Axiom",
    timeframe: "24h",
  },
  {
    symbol: "ORCA",
    mint: "orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE",
    priceUsd: 3.19,
    changePct: -0.6,
    liquidityUsd: 8_900_000,
    volumeUsd: 1_900_000,
    holders: 164_250,
    source: "Gecko",
    timeframe: "24h",
  },
  {
    symbol: "DRIFT",
    mint: "DRiFt11111111111111111111111111111111111111",
    priceUsd: 1.07,
    changePct: 6.9,
    liquidityUsd: 5_800_000,
    volumeUsd: 3_600_000,
    holders: 56_880,
    source: "Dexscreener",
    timeframe: "1h",
  },
  {
    symbol: "KMNO",
    mint: "KMNo111111111111111111111111111111111111111",
    priceUsd: 0.092,
    changePct: 9.8,
    liquidityUsd: 1_600_000,
    volumeUsd: 2_200_000,
    holders: 18_430,
    source: "Axiom",
    timeframe: "5m",
  },
];

function formatCompactUsd(n: number): string {
  const abs = Math.abs(n);
  if (!Number.isFinite(abs)) return "—";
  if (abs >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`;
  if (abs >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

function formatPriceUsd(n: number): string {
  if (!Number.isFinite(n)) return "—";
  if (n >= 1) return `$${n.toFixed(2)}`;
  if (n >= 0.01) return `$${n.toFixed(4)}`;
  return `$${n.toFixed(6)}`;
}

const CARD_HOVER =
  "transition-[box-shadow,border-color,ring-color] duration-200 ease-out hover:border-[#2a2a2a] hover:shadow-lg hover:shadow-black/35 hover:ring-1 hover:ring-[#2a2a2a]/30";

/** Row hover for Top Performers — border + shadow only (no scale / translate). */
const TOP_PERFORMER_ROW_INTERACTIVE =
  "cursor-pointer transition-[border-color,box-shadow] duration-150 hover:border-zinc-500/40 hover:shadow-md hover:shadow-black/25";

const PROFILE_LINK_CLASS =
  "text-[color:var(--accent)] hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]/30";

function viewerDisplayName(
  discordId: string,
  apiUsername: string,
  viewerId: string | undefined,
  viewerName: string | null | undefined
): string {
  const d = discordId.trim();
  const v = viewerId?.trim() ?? "";
  if (v && d === v && viewerName) return viewerName;
  return apiUsername.trim();
}

/**
 * Top Performers row styles: strict render **index** in API order (slice top 3).
 * Index 0 = #1 gold, 1 = silver, 2 = bronze. Current user always emerald first.
 * Do not pass a re-sorted index or rank from the API — only `.map((_, index))`.
 */
function topPerformerVisuals(
  index: number,
  isCurrentUser: boolean
): {
  row: string;
  badge: string;
  nameLink: string;
  avgStrong: string;
} {
  if (isCurrentUser) {
    return {
      row: "rounded-xl border border-[#39FF14]/35 bg-[#39FF14]/10 px-4 py-3",
      badge: "bg-[#39FF14]/15 text-[#39FF14]",
      nameLink:
        "min-w-0 truncate font-medium text-[#39FF14] transition-colors hover:text-[#39FF14] hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[#39FF14]/35",
      avgStrong: "font-semibold text-[#39FF14]",
    };
  } else if (index === 0) {
    return {
      row: "rounded-xl border border-yellow-500/40 bg-yellow-500/10 px-4 py-3",
      badge: "bg-yellow-500/15 text-yellow-400",
      nameLink:
        "min-w-0 truncate font-medium text-yellow-400 transition-colors hover:text-yellow-300 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow-500/40",
      avgStrong: "font-semibold text-yellow-400",
    };
  } else if (index === 1) {
    return {
      row: "rounded-xl border border-zinc-400/30 bg-zinc-500/10 px-4 py-3",
      badge: "bg-zinc-500/15 text-zinc-300",
      nameLink:
        "min-w-0 truncate font-medium text-zinc-300 transition-colors hover:text-zinc-200 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500/40",
      avgStrong: "font-semibold text-zinc-300",
    };
  } else if (index === 2) {
    return {
      row: "rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3",
      badge: "bg-amber-500/15 text-amber-600",
      nameLink:
        "min-w-0 truncate font-medium text-amber-600 transition-colors hover:text-amber-500 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/40",
      avgStrong: "font-semibold text-amber-600",
    };
  }
  return {
    row: "rounded-xl border border-[#1a1a1a] bg-[#0a0a0a] px-4 py-3",
    badge: "bg-[#0a0a0a] text-zinc-500",
    nameLink: `${PROFILE_LINK_CLASS} min-w-0 truncate font-medium`,
    avgStrong: "font-semibold text-[#39FF14]/95",
  };
}

type MeStats = {
  avgX: number;
  medianX?: number;
  winRate: number;
  callsToday: number;
  /** Rolling window immediately before `callsToday` (same length), for day-over-day style deltas. */
  callsPriorRollingDay?: number;
  /** Consecutive active UTC days with ≥1 call (ending today if active today, else yesterday). */
  activeDaysStreak?: number;
  bestX30d?: number;
  hitRate2x30d?: number;
  totalCalls: number;
};

function callsTodayDeltaLabel(stats: MeStats | null): ReactNode {
  if (stats === null) {
    return <span className="text-zinc-500">—</span>;
  }
  const prior = Number.isFinite(stats.callsPriorRollingDay)
    ? Number(stats.callsPriorRollingDay)
    : 0;
  const d = stats.callsToday - prior;
  if (d > 0) {
    return (
      <span className="text-green-400">
        ↑ +{d} from yesterday
      </span>
    );
  }
  if (d < 0) {
    return (
      <span className="text-red-400">
        ↓ {Math.abs(d)} from yesterday
      </span>
    );
  }
  return <span className="text-zinc-500">Flat from yesterday</span>;
}

function smoothClass(refreshing: boolean): string {
  return refreshing
    ? "transition-opacity duration-300 ease-out opacity-70"
    : "transition-opacity duration-300 ease-out opacity-100";
}

type RecentCallRow = {
  token: string;
  multiple: number;
  time: unknown;
  excludedFromStats?: boolean;
  tokenName?: string | null;
  tokenTicker?: string | null;
  callMarketCapUsd?: number | null;
  tokenImageUrl?: string | null;
};

function homeRecentCallSummary(call: RecentCallRow): string {
  return formatCalledSnapshotLine({
    tokenName: call.tokenName,
    tokenTicker: call.tokenTicker,
    callMarketCapUsd: call.callMarketCapUsd ?? null,
    callCa: call.token,
  });
}

function homeLastCallHeadline(call: RecentCallRow): string {
  return formatNameAndTickerLine({
    tokenName: call.tokenName,
    tokenTicker: call.tokenTicker,
    callMarketCapUsd: call.callMarketCapUsd ?? null,
    callCa: call.token,
  });
}

type PublicTeaserCall = {
  token: string;
  tokenName?: string | null;
  tokenTicker?: string | null;
  multiple: number;
  username: string;
  source: string;
  time: unknown;
};

type PublicTeasers = {
  week: { calls: number; avgX: number; topCalls: PublicTeaserCall[] };
};

function UnauthedLanding({ onLogin }: { onLogin: () => void }) {
  const [loading, setLoading] = useState(true);
  const [teasers, setTeasers] = useState<PublicTeasers | null>(null);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    setLoading(true);
    void (async () => {
      try {
        const res = await fetch("/api/public/terminal-teasers", { signal: controller.signal });
        const json = (await res.json().catch(() => ({}))) as {
          success?: boolean;
          week?: PublicTeasers["week"];
        };
        if (cancelled) return;
        if (!res.ok || json.success !== true || !json.week) {
          setTeasers(null);
          return;
        }
        setTeasers({ week: json.week });
      } catch {
        if (!cancelled) setTeasers(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, []);

  const weekCalls = teasers?.week.calls ?? 0;
  const weekAvgX = teasers?.week.avgX ?? 0;
  const topCalls = teasers?.week.topCalls ?? [];

  return (
    <div className="relative min-h-[calc(100vh-3rem)] px-4 py-10 sm:px-6">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(34,197,94,0.12),transparent_55%),radial-gradient(circle_at_bottom,rgba(56,189,248,0.10),transparent_50%)]"
        aria-hidden
      />
      <div className="relative mx-auto max-w-5xl">
        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
          <section className="rounded-2xl border border-zinc-800/60 bg-zinc-950/50 p-6 shadow-2xl shadow-black/40 backdrop-blur sm:p-8">
            <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-zinc-500">
              McGBot Terminal
            </p>
            <h1 className="mt-3 text-3xl font-black tracking-tight text-zinc-100 sm:text-4xl">
              Elite call tracking, performance, and community boards.
            </h1>
            <p className="mt-4 text-sm leading-relaxed text-zinc-400">
              Log in with Discord to unlock your Call log, Performance lab, Watchlist, and pro-grade leaderboards.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={onLogin}
                className="inline-flex items-center justify-center rounded-lg bg-[#5865F2] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#4752c4] focus:outline-none focus:ring-2 focus:ring-sky-500/50"
              >
                Login with Discord
              </button>
              <Link
                href="/subscribe"
                className="inline-flex items-center justify-center rounded-lg border border-zinc-800 bg-zinc-950/40 px-5 py-3 text-sm font-semibold text-zinc-200 transition hover:border-zinc-700 hover:bg-zinc-950/60"
              >
                View plans →
              </Link>
            </div>

            <div className="mt-7 grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-zinc-800/60 bg-black/30 px-4 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
                  7d calls tracked
                </p>
                <p className="mt-1 text-2xl font-bold tabular-nums text-zinc-100">
                  {loading ? "—" : weekCalls.toLocaleString("en-US")}
                </p>
              </div>
              <div className="rounded-xl border border-zinc-800/60 bg-black/30 px-4 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
                  7d avg multiple
                </p>
                <p className="mt-1 text-2xl font-bold tabular-nums text-emerald-200">
                  {loading ? "—" : `${weekAvgX.toFixed(2)}×`}
                </p>
              </div>
              <div className="rounded-xl border border-zinc-800/60 bg-black/30 px-4 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
                  Access
                </p>
                <p className="mt-1 text-sm font-semibold text-zinc-200">
                  Premium dashboard
                </p>
                <p className="mt-1 text-xs text-zinc-500">Discord + subscription</p>
              </div>
            </div>
          </section>

          <aside className="rounded-2xl border border-zinc-800/60 bg-zinc-950/35 p-6 shadow-xl shadow-black/30 backdrop-blur">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-zinc-100">Top calls (7d)</h2>
              <span className="text-[11px] text-zinc-500">Teaser</span>
            </div>
            <div className="mt-3 rounded-xl border border-zinc-900 bg-black/30 p-2">
              {loading ? (
                <div className="space-y-2 p-1" aria-busy>
                  <div className="h-10 animate-pulse rounded-lg bg-zinc-900/35" />
                  <div className="h-10 animate-pulse rounded-lg bg-zinc-900/25" />
                  <div className="h-10 animate-pulse rounded-lg bg-zinc-900/20" />
                </div>
              ) : topCalls.length === 0 ? (
                <div className="flex min-h-[120px] items-center justify-center px-3 py-10 text-center">
                  <p className="text-sm text-zinc-500">No calls yet.</p>
                </div>
              ) : (
                <ul className="divide-y divide-zinc-800/40 text-sm">
                  {topCalls.map((c, i) => (
                    <li
                      key={`${c.token}-${String(c.time)}-${i}`}
                      className="flex items-center justify-between gap-3 py-2.5 first:pt-2 text-zinc-300"
                    >
                      <span className="min-w-0 truncate text-[13px] font-semibold text-zinc-100">
                        {formatNameAndTickerLine({
                          tokenName: c.tokenName,
                          tokenTicker: c.tokenTicker,
                          callMarketCapUsd: null,
                          callCa: c.token,
                        })}
                      </span>
                      <span className="shrink-0 font-semibold tabular-nums text-emerald-300">
                        {c.multiple.toFixed(1)}×
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <p className="mt-4 text-xs leading-relaxed text-zinc-500">
              Unlock full history, filtering, performance breakdowns, and leaderboards by logging in and subscribing.
            </p>
          </aside>
        </div>
      </div>
    </div>
  );
}

type TopPerformerTodayRow = {
  rank: number;
  discordId: string;
  username: string;
  avgX: number;
  bestMultiple: number;
};

type SocialPlatform = "x" | "instagram";
type SocialFeedItem = {
  id: string;
  platform: SocialPlatform;
  authorName: string;
  authorHandle: string;
  postedAtLabel: string;
  text: string;
  metricLabel?: string;
};

const SOCIAL_FEED_MOCK: SocialFeedItem[] = [
  {
    id: "x-1",
    platform: "x",
    authorName: "Onchain Radar",
    authorHandle: "@onchainradar",
    postedAtLabel: "12m",
    text: "SOL memecoin rotation picking up again. Watch for liquidity returning to midcaps — narratives are shifting fast.",
    metricLabel: "4.2K",
  },
  {
    id: "ig-1",
    platform: "instagram",
    authorName: "Market Narratives",
    authorHandle: "@marketnarratives",
    postedAtLabel: "38m",
    text: "Viral clip: “Why narratives win cycles.” Quick breakdown of how attention flows across Telegram → X → charts.",
    metricLabel: "18.9K",
  },
  {
    id: "x-2",
    platform: "x",
    authorName: "Dex Pulse",
    authorHandle: "@dexpulse",
    postedAtLabel: "1h",
    text: "Trending pairs: volume spikes on SOL with improving depth. If you’re scanning, focus on liquidity + holder distribution.",
    metricLabel: "2.1K",
  },
  {
    id: "x-3",
    platform: "x",
    authorName: "Flow Watch",
    authorHandle: "@flowwatch",
    postedAtLabel: "2h",
    text: "Heatmap check: buy pressure building on SOL perps. If this holds, expect meme beta to follow.",
    metricLabel: "6.8K",
  },
  {
    id: "ig-2",
    platform: "instagram",
    authorName: "Chart Room",
    authorHandle: "@chartroom",
    postedAtLabel: "2h",
    text: "3-step checklist before entering: trend → volume → invalidation. Keep it simple, keep it repeatable.",
    metricLabel: "9.4K",
  },
  {
    id: "x-4",
    platform: "x",
    authorName: "Liquidity Lens",
    authorHandle: "@liq_lens",
    postedAtLabel: "3h",
    text: "Midcaps waking up: watch pools with steady adds (not single-sided). That’s the tell before breakout.",
    metricLabel: "3.7K",
  },
  {
    id: "ig-3",
    platform: "instagram",
    authorName: "Signal Digest",
    authorHandle: "@signaldigest",
    postedAtLabel: "3h",
    text: "Attention rotates in waves. Track mentions + chart reactions, not just raw likes.",
    metricLabel: "14.1K",
  },
  {
    id: "x-5",
    platform: "x",
    authorName: "Narrative Desk",
    authorHandle: "@narrativedesk",
    postedAtLabel: "4h",
    text: "What’s trending isn’t always what’s tradable. Focus on liquidity depth + clean distribution.",
    metricLabel: "1.9K",
  },
  {
    id: "x-6",
    platform: "x",
    authorName: "Dex Wire",
    authorHandle: "@dexwire",
    postedAtLabel: "5h",
    text: "New pairs: watch the first 10 minutes — spread + depth tells you everything.",
    metricLabel: "5.3K",
  },
  {
    id: "ig-4",
    platform: "instagram",
    authorName: "Alpha Board",
    authorHandle: "@alphaboard",
    postedAtLabel: "6h",
    text: "When the chart is noisy: zoom out, define the range, trade the edges.",
    metricLabel: "21.3K",
  },
  {
    id: "x-7",
    platform: "x",
    authorName: "Orderflow Notes",
    authorHandle: "@of_notes",
    postedAtLabel: "7h",
    text: "If you can’t name the invalidation level, you don’t have a trade — you have a hope.",
    metricLabel: "7.1K",
  },
  {
    id: "ig-5",
    platform: "instagram",
    authorName: "Volume Lab",
    authorHandle: "@volumelab",
    postedAtLabel: "8h",
    text: "Low float + rising volume can be explosive. Confirm depth before sizing up.",
    metricLabel: "11.8K",
  },
  {
    id: "x-8",
    platform: "x",
    authorName: "Whale Watch",
    authorHandle: "@whalewatch",
    postedAtLabel: "9h",
    text: "Wallet clustering looks clean. If liquidity keeps increasing, that’s your green light.",
    metricLabel: "12.6K",
  },
  {
    id: "ig-6",
    platform: "instagram",
    authorName: "Cycle Theory",
    authorHandle: "@cycletheory",
    postedAtLabel: "10h",
    text: "Narratives don’t move the chart alone — the chart moves narratives. Track both.",
    metricLabel: "16.0K",
  },
  {
    id: "x-9",
    platform: "x",
    authorName: "SOL Metrics",
    authorHandle: "@solmetrics",
    postedAtLabel: "12h",
    text: "SOL dominance creeping up. Meme baskets usually respond with a lag — watch the leaders first.",
    metricLabel: "8.9K",
  },
  {
    id: "ig-7",
    platform: "instagram",
    authorName: "Community Pulse",
    authorHandle: "@communitypulse",
    postedAtLabel: "14h",
    text: "Best traders I know: fewer positions, clearer thesis, faster exits.",
    metricLabel: "19.6K",
  },
  {
    id: "x-10",
    platform: "x",
    authorName: "Tape Reader",
    authorHandle: "@tapereader",
    postedAtLabel: "18h",
    text: "When you see the bids stepping up consistently, that’s your cue. Don’t chase tops, wait for structure.",
    metricLabel: "2.7K",
  },
  {
    id: "ig-8",
    platform: "instagram",
    authorName: "Risk First",
    authorHandle: "@riskfirst",
    postedAtLabel: "22h",
    text: "Your edge is risk management. The rest is just entries.",
    metricLabel: "25.2K",
  },
];

const SOCIAL_AUTHOR_POOL: Array<{
  platform: SocialPlatform;
  authorName: string;
  authorHandle: string;
}> = [
  { platform: "x", authorName: "Onchain Radar", authorHandle: "@onchainradar" },
  { platform: "x", authorName: "Dex Pulse", authorHandle: "@dexpulse" },
  { platform: "x", authorName: "Liquidity Lens", authorHandle: "@liq_lens" },
  { platform: "x", authorName: "Tape Reader", authorHandle: "@tapereader" },
  { platform: "x", authorName: "Whale Watch", authorHandle: "@whalewatch" },
  { platform: "instagram", authorName: "Market Narratives", authorHandle: "@marketnarratives" },
  { platform: "instagram", authorName: "Chart Room", authorHandle: "@chartroom" },
  { platform: "instagram", authorName: "Volume Lab", authorHandle: "@volumelab" },
  { platform: "instagram", authorName: "Risk First", authorHandle: "@riskfirst" },
  { platform: "instagram", authorName: "Alpha Board", authorHandle: "@alphaboard" },
];

const SOCIAL_TEXT_POOL: string[] = [
  "New listings popping up — check depth before you size.",
  "Quick reminder: liquidity > followers. Always.",
  "If the bid ladder keeps stepping up, don’t fade it.",
  "Rotation watch: leaders move first, runners follow.",
  "Spread tight + depth rising is the cleanest setup.",
  "Conviction is fine. Invalidation is mandatory.",
  "Watch for distribution: steady adds beat single spikes.",
  "When attention shifts, charts usually front-run the narrative.",
];

function socialMetricLabel(): string {
  const v = 500 + Math.floor(Math.random() * 25000);
  if (v >= 1000) return `${(v / 1000).toFixed(v >= 10000 ? 1 : 2)}K`.replace(/\.0K$/, "K");
  return String(v);
}

function makeNewSocialPost(forcePlatform?: SocialPlatform): SocialFeedItem {
  const pool = forcePlatform
    ? SOCIAL_AUTHOR_POOL.filter((a) => a.platform === forcePlatform)
    : SOCIAL_AUTHOR_POOL;
  const author = pool[Math.floor(Math.random() * pool.length)] ?? SOCIAL_AUTHOR_POOL[0]!;
  const text = SOCIAL_TEXT_POOL[Math.floor(Math.random() * SOCIAL_TEXT_POOL.length)] ?? SOCIAL_TEXT_POOL[0]!;
  return {
    id: `mock-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    platform: author.platform,
    authorName: author.authorName,
    authorHandle: author.authorHandle,
    postedAtLabel: "now",
    text,
    metricLabel: socialMetricLabel(),
  };
}

type ActivityItem = {
  type: "win" | "call";
  text: string;
  /** Call-log handle (may differ from Discord display name). */
  username: string;
  /** Label used in `text` and profile links (from `users` when available). */
  displayName: string;
  /** Caller avatar from `users.discord_avatar_url` when set. */
  userAvatarUrl: string | null;
  time: unknown;
  link_chart: string | null;
  link_post: string | null;
  multiple: number;
  discordId: string;
  tokenImageUrl?: string | null;
};

function activityLineLabel(item: ActivityItem): string {
  const d = item.displayName.trim();
  if (d) return d;
  return item.username.trim();
}

type NotificationPrefs = {
  own_calls: boolean;
  include_following: boolean;
  include_global: boolean;
  min_multiple: number;
};

type NotificationFilter = {
  userId: string;
  prefs: NotificationPrefs;
  followedIds: Set<string>;
};

const NOTIFICATION_PREFS_DEFAULT: NotificationPrefs = {
  own_calls: true,
  include_following: true,
  include_global: false,
  min_multiple: 2,
};

function passesPreferenceFilter(
  item: ActivityItem,
  filter: NotificationFilter
): boolean {
  const { prefs, followedIds, userId } = filter;
  if (prefs.include_global) return true;
  const actor = item.discordId.trim();
  if (!actor) return false;
  if (prefs.own_calls && actor === userId) return true;
  if (prefs.include_following && followedIds.has(actor)) return true;
  return false;
}

async function fetchNotificationFilter(
  userId: string
): Promise<NotificationFilter> {
  const prefs: NotificationPrefs = { ...NOTIFICATION_PREFS_DEFAULT };

  try {
    const [prefsRes, followRes] = await Promise.all([
      fetch("/api/preferences"),
      fetch("/api/follow"),
    ]);

    if (prefsRes.ok) {
      const j: unknown = await prefsRes.json();
      if (j && typeof j === "object" && !("error" in j)) {
        const o = j as Record<string, unknown>;
        if (typeof o.own_calls === "boolean") prefs.own_calls = o.own_calls;
        if (typeof o.include_following === "boolean") {
          prefs.include_following = o.include_following;
        }
        if (typeof o.include_global === "boolean") {
          prefs.include_global = o.include_global;
        }
        const mm = Number(o.min_multiple);
        if (Number.isFinite(mm)) prefs.min_multiple = mm;
      }
    }

    const followedIds = new Set<string>();
    if (followRes.ok) {
      const j: unknown = await followRes.json();
      if (j && typeof j === "object") {
        const list = (j as Record<string, unknown>).following;
        if (Array.isArray(list)) {
          for (const entry of list) {
            if (!entry || typeof entry !== "object") continue;
            const o = entry as Record<string, unknown>;
            const id =
              typeof o.targetUserId === "string"
                ? o.targetUserId
                : typeof o.targetId === "string"
                  ? o.targetId
                  : "";
            if (id.trim() !== "") {
              followedIds.add(id.trim());
            }
          }
        }
      }
    }

    return { userId, prefs, followedIds };
  } catch {
    return {
      userId,
      prefs: { ...NOTIFICATION_PREFS_DEFAULT },
      followedIds: new Set<string>(),
    };
  }
}

/** Solana-style base58 public key length (typical mint/address in UI text). */
const CA_IN_TEXT_RE = /[1-9A-HJ-NP-Za-km-z]{32,44}/;

function extractCaFromDexLink(link: string): string | null {
  const m = link.trim().match(/dexscreener\.com\/solana\/([^/?#]+)/i);
  if (!m) return null;
  try {
    return decodeURIComponent(m[1]);
  } catch {
    return m[1];
  }
}

function shortenCa(ca: string): string {
  if (ca.length <= 12) return ca;
  return `${ca.slice(0, 4)}…${ca.slice(-4)}`;
}

function resolveCaInActivityText(
  text: string,
  dexLink: string
): { ca: string; chartLink: string } | null {
  const caFromLink = dexLink ? extractCaFromDexLink(dexLink) : null;
  if (caFromLink && text.includes(caFromLink)) {
    return { ca: caFromLink, chartLink: dexLink };
  }

  const m = text.match(CA_IN_TEXT_RE);
  if (!m) return null;

  const ca = m[0];
  const chartLink =
    dexLink && extractCaFromDexLink(dexLink) === ca
      ? dexLink
      : `https://dexscreener.com/solana/${encodeURIComponent(ca)}`;

  return { ca, chartLink };
}

function renderTextSegmentWithCa(text: string, dexLink: string): ReactNode {
  const target = resolveCaInActivityText(text, dexLink);
  if (!target) return text;

  const { ca, chartLink } = target;
  const idx = text.indexOf(ca);
  if (idx === -1) return text;

  return (
    <>
      {text.slice(0, idx)}
      <span
        role="link"
        tabIndex={0}
        onClick={(e) => {
          e.stopPropagation();
          window.open(chartLink, "_blank", "noopener,noreferrer");
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            e.stopPropagation();
            window.open(chartLink, "_blank", "noopener,noreferrer");
          }
        }}
        className="text-cyan-400 hover:underline cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/50"
      >
        {shortenCa(ca)}
      </span>
      {text.slice(idx + ca.length)}
    </>
  );
}

function renderActivityFeedLine(
  item: ActivityItem,
  viewerId?: string,
  viewerName?: string | null,
  badges: string[] = []
): ReactNode {
  const dex = item.link_chart ?? "";
  const lineLabel = activityLineLabel(item);
  const apiName = item.username.trim();
  const name = viewerDisplayName(
    item.discordId,
    lineLabel,
    viewerId,
    viewerName
  );
  const id = item.discordId.trim();

  if (name && id && item.type === "call") {
    const newCall = item.text.match(/^New Call - (.+?) called (.+)$/i);
    if (newCall) {
      const tail = newCall[2] ?? "";
      return (
        <>
          New Call -{" "}
          <Link
            href={userProfileHref({
              discordId: id,
              displayName: name || lineLabel || apiName,
            })}
            className={PROFILE_LINK_CLASS}
            onClick={(e) => e.stopPropagation()}
          >
            {name}
          </Link>
          <UserBadgeIcons badges={badges} className="ml-1" />
          {" "}called {tail}
        </>
      );
    }
    const legacyPrefix = "New call by ";
    if (item.text.startsWith(legacyPrefix)) {
      return (
        <>
          {legacyPrefix}
          <Link
            href={userProfileHref({
              discordId: id,
              displayName: name || lineLabel || apiName,
            })}
            className={PROFILE_LINK_CLASS}
            onClick={(e) => e.stopPropagation()}
          >
            {name}
          </Link>
          <UserBadgeIcons badges={badges} className="ml-1" />
        </>
      );
    }
  }

  if (
    lineLabel &&
    id &&
    item.type === "win" &&
    item.text.startsWith(lineLabel)
  ) {
    const afterName = item.text.slice(lineLabel.length);
    return (
      <>
        <Link
          href={userProfileHref({
            discordId: id,
            displayName: name || lineLabel || apiName,
          })}
          className={PROFILE_LINK_CLASS}
          onClick={(e) => e.stopPropagation()}
        >
          {name}
        </Link>
        <UserBadgeIcons badges={badges} className="ml-1" />
        {renderTextSegmentWithCa(afterName, dex)}
      </>
    );
  }

  const target = resolveCaInActivityText(item.text, dex);
  if (!target) {
    return <>{item.text}</>;
  }

  const { ca, chartLink } = target;
  const idx = item.text.indexOf(ca);
  if (idx === -1) {
    return <>{item.text}</>;
  }

  return (
    <>
      {item.text.slice(0, idx)}
      <span
        role="link"
        tabIndex={0}
        onClick={(e) => {
          e.stopPropagation();
          window.open(chartLink, "_blank", "noopener,noreferrer");
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            e.stopPropagation();
            window.open(chartLink, "_blank", "noopener,noreferrer");
          }
        }}
        className="text-cyan-400 hover:underline cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/50"
      >
        {shortenCa(ca)}
      </span>
      {item.text.slice(idx + ca.length)}
    </>
  );
}

/** Non-win calls at or above this multiple can notify (tune later). */
const ACTIVITY_BIG_CALL_NOTIFY_MIN = 3;

function activityItemDedupeKey(item: ActivityItem): string {
  const chart = (item.link_chart ?? "").trim();
  return `${callTimeMs(item.time)}::${item.discordId.trim()}::${item.type}::${chart}`;
}

function activityItemNotifiable(item: ActivityItem): boolean {
  if (item.type === "win") return true;
  return (
    item.type === "call" &&
    Number.isFinite(item.multiple) &&
    item.multiple >= ACTIVITY_BIG_CALL_NOTIFY_MIN
  );
}

function notificationPriorityFromMultiple(
  multiple: number
): NotificationPriority {
  if (multiple >= 5) return "high";
  if (multiple >= 3) return "medium";
  return "low";
}

function processActivityNotifications(
  prev: ActivityItem[],
  next: ActivityItem[],
  addNotification: (n: {
    id: string;
    text: string;
    type: "win" | "call";
    createdAt: number;
    priority: NotificationPriority;
  }) => void,
  lastSeenKeys: MutableRefObject<Set<string>>,
  filter: NotificationFilter | null
): void {
  const keyOf = activityItemDedupeKey;

  if (prev.length === 0 && next.length > 0) {
    for (const item of next) {
      lastSeenKeys.current.add(keyOf(item));
    }
    return;
  }

  const prevKeys = new Set(prev.map(keyOf));
  for (const item of next) {
    const k = keyOf(item);
    if (prevKeys.has(k)) continue;
    if (lastSeenKeys.current.has(k)) continue;
    if (!activityItemNotifiable(item)) continue;

    if (!filter) {
      lastSeenKeys.current.add(k);
      continue;
    }

    const minM = Number(filter.prefs.min_multiple);
    const minMultiple = Number.isFinite(minM) ? minM : NOTIFICATION_PREFS_DEFAULT.min_multiple;
    if (item.multiple < minMultiple) {
      lastSeenKeys.current.add(k);
      continue;
    }

    if (!passesPreferenceFilter(item, filter)) {
      lastSeenKeys.current.add(k);
      continue;
    }

    lastSeenKeys.current.add(k);
    addNotification({
      id: crypto.randomUUID(),
      text: item.text,
      type: item.type,
      createdAt: Date.now(),
      priority: notificationPriorityFromMultiple(item.multiple),
    });
  }
}

function StatCard({
  title,
  value,
  loading,
  positiveHint,
}: {
  title: string;
  value: ReactNode;
  loading?: boolean;
  positiveHint?: string;
}) {
  const valueText =
    typeof value === "string" || typeof value === "number" ? String(value) : "";

  let valueClassName = "text-zinc-50";
  if (valueText.includes("x")) {
    const n = Number(valueText.replace(/[^0-9.]+/g, ""));
    if (Number.isFinite(n)) {
      if (n > 3) valueClassName = "text-[#39FF14]";
      else if (n >= 1) valueClassName = "text-sky-400";
      else valueClassName = "text-zinc-500";
    }
  } else if (valueText.includes("%")) {
    const n = Number(valueText.replace(/[^0-9.]+/g, ""));
    if (Number.isFinite(n)) {
      if (n > 60) valueClassName = "text-[#39FF14]";
      else if (n >= 40) valueClassName = "text-yellow-400";
      else valueClassName = "text-red-400";
    }
  }

  return (
    <div
      className={`relative rounded-xl border border-[#1a1a1a] bg-[#0a0a0a] px-4 py-3 shadow-sm shadow-black/20 backdrop-blur-sm ${CARD_HOVER}`}
    >
      <div className="absolute left-0 right-0 top-0 h-[2px] rounded-t-xl bg-gradient-to-r from-[#39FF14]/40 to-transparent" />
      <p className="text-xs uppercase tracking-wide text-zinc-600">
        {title}
      </p>
      {loading ? (
        <div
          className="mt-1.5 h-9 w-20 max-w-full animate-pulse rounded-md bg-zinc-800/90"
          aria-busy
          aria-label="Loading"
        />
      ) : (
        <>
          <div
            className={`mt-1.5 text-xl font-semibold tabular-nums tracking-tight ${valueClassName}`}
          >
            {value}
          </div>
          {positiveHint ? (
            <p className="mt-1.5 text-xs font-medium text-[#39FF14]/95">
              {positiveHint}
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}

function PanelCard({
  title,
  children,
  className = "",
  elevated = false,
  titleClassName,
  paddingClassName = "px-4 py-3",
  titleRight,
  "data-tutorial": dataTutorial,
}: {
  title: string;
  children: ReactNode;
  className?: string;
  elevated?: boolean;
  titleClassName?: string;
  /** e.g. `px-5 py-3` for tighter vertical rhythm */
  paddingClassName?: string;
  titleRight?: ReactNode;
  "data-tutorial"?: string;
}) {
  const surface = elevated
    ? "border-[#1a1a1a] bg-[#0a0a0a] shadow-md shadow-black/25"
    : "border-[#1a1a1a] bg-[#0a0a0a] shadow-sm shadow-black/20";

  return (
    <div
      data-tutorial={dataTutorial}
      className={`rounded-xl border ${paddingClassName} backdrop-blur-sm ${surface} ${CARD_HOVER} ${className}`}
    >
      <div className="flex items-start justify-between gap-3">
        <h2
          className={`min-w-0 flex-1 text-sm font-semibold tracking-wide text-zinc-400 ${titleClassName ?? "uppercase"}`}
        >
          {title}
        </h2>
        {titleRight ? (
          <div className="flex shrink-0 items-center gap-1 pt-0.5">{titleRight}</div>
        ) : null}
      </div>
      {children}
    </div>
  );
}

function widgetEnabled(
  widgets: WidgetsEnabled | null,
  key: keyof WidgetsEnabled
): boolean {
  if (widgets === null) return true;
  return Boolean(widgets[key]);
}

function NotesPanel() {
  return (
    <section className="mb-8">
      <PanelCard title="Notes" titleClassName="normal-case">
        <p className="mt-2 text-sm text-zinc-500">No notes yet.</p>
      </PanelCard>
    </section>
  );
}

function TrendingPanel() {
  const [timeframe, setTimeframe] = useState<"5m" | "1h" | "24h">("1h");
  const [source, setSource] = useState<"All" | TrendingTokenRow["source"]>("All");
  const [apiRows, setApiRows] = useState<TrendingTokenRow[]>([]);
  const [apiLoading, setApiLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setApiLoading(true);
    const src = source === "All" ? "All" : source;
    fetch(
      `/api/trending?timeframe=${encodeURIComponent(timeframe)}&source=${encodeURIComponent(src)}`,
      { credentials: "same-origin" }
    )
      .then((res) => res.json().then((json) => ({ ok: res.ok, json })))
      .then(({ ok, json }) => {
        if (cancelled) return;
        const rowsRaw =
          ok && json && typeof json === "object" && Array.isArray((json as any).rows)
            ? ((json as any).rows as unknown[])
            : [];
        const parsed: TrendingTokenRow[] = [];
        for (const r of rowsRaw) {
          if (!r || typeof r !== "object") continue;
          const o = r as Record<string, unknown>;
          const symbol = typeof o.symbol === "string" ? o.symbol.trim() : "";
          const mint = typeof o.mint === "string" ? o.mint.trim() : "";
          if (!symbol || !mint) continue;
          parsed.push({
            symbol,
            mint,
            priceUsd: Number(o.priceUsd ?? 0) || 0,
            changePct: Number(o.changePct ?? 0) || 0,
            liquidityUsd: Number(o.liquidityUsd ?? 0) || 0,
            volumeUsd: Number(o.volumeUsd ?? 0) || 0,
            holders: Math.max(0, Number(o.holders ?? 0) || 0),
            source:
              typeof o.source === "string" && o.source
                ? (o.source as TrendingTokenRow["source"])
                : "Dexscreener",
            timeframe:
              typeof o.timeframe === "string" && o.timeframe
                ? (o.timeframe as TrendingTokenRow["timeframe"])
                : timeframe,
          });
        }
        setApiRows(parsed);
      })
      .catch(() => {
        if (!cancelled) setApiRows([]);
      })
      .finally(() => {
        if (!cancelled) setApiLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [source, timeframe]);

  const rows = useMemo(() => {
    return apiRows.filter((r) => {
      if (r.timeframe !== timeframe) return false;
      if (source !== "All" && r.source !== source) return false;
      return true;
    });
  }, [apiRows, source, timeframe]);

  const chipClass = (active: boolean) =>
    `rounded-lg px-3 py-1.5 text-xs font-semibold tabular-nums transition-colors ${
      active
        ? "bg-zinc-700 text-zinc-50 shadow-sm shadow-black/20"
        : "bg-zinc-900/70 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
    }`;

  return (
    <PanelCard title="Trending Tokens" titleClassName="normal-case">
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 p-1">
            <button
              type="button"
              onClick={() => setTimeframe("5m")}
              className={chipClass(timeframe === "5m")}
            >
              5m
            </button>
            <button
              type="button"
              onClick={() => setTimeframe("1h")}
              className={chipClass(timeframe === "1h")}
            >
              1h
            </button>
            <button
              type="button"
              onClick={() => setTimeframe("24h")}
              className={chipClass(timeframe === "24h")}
            >
              24h
            </button>
          </div>

          <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 p-1">
            {(
              ["All", "Dexscreener", "Axiom", "Gecko"] as const
            ).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSource(s)}
                className={chipClass(source === s)}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <div className="text-[11px] text-zinc-500">
          {apiLoading ? "Loading…" : "Live • feed wired"}
        </div>
      </div>

      <div className="mt-3 rounded-xl border border-zinc-900 bg-zinc-950/40 p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
        <div className="px-2 pb-2 text-[11px] uppercase tracking-wider text-zinc-600">
          <div className="grid grid-cols-[minmax(0,1.2fr)_auto_auto] items-center gap-3">
            <span>Token</span>
            <span className="text-right">Price / Chg</span>
            <span className="text-right">Liq / Vol</span>
          </div>
        </div>

        <div className="h-[300px] overflow-y-auto pr-1 no-scrollbar">
          {rows.length === 0 ? (
            <div className="flex h-full items-center justify-center px-3 py-10">
              <div className="text-center">
                <p className="text-sm font-semibold text-zinc-200">
                  No matches
                </p>
                <p className="mt-1 text-xs text-zinc-500">
                  Try a different timeframe or source.
                </p>
              </div>
            </div>
          ) : (
            <ul className="space-y-1">
              {rows.map((row, i) => {
                const positive = row.changePct >= 0;
                return (
                  <li key={`${row.symbol}-${row.mint}-${i}`}>
                    <button
                      type="button"
                      onClick={() =>
                        window.open(
                          `https://dexscreener.com/solana/${encodeURIComponent(
                            row.mint
                          )}`,
                          "_blank",
                          "noopener,noreferrer"
                        )
                      }
                      className="group flex w-full items-center justify-between gap-3 rounded-lg border border-[#1a1a1a] bg-zinc-900/20 px-3 py-2 text-left transition-colors hover:bg-zinc-900/35 focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]/25"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-white/10 bg-zinc-950 text-xs font-semibold text-zinc-200">
                            #{i + 1}
                          </span>
                          <span className="min-w-0 truncate text-sm font-semibold text-zinc-100">
                            {row.symbol}
                          </span>
                          <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-semibold text-zinc-400">
                            {row.source}
                          </span>
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-zinc-500">
                          <span className="tabular-nums">
                            Holders{" "}
                            <span className="font-semibold text-zinc-300">
                              {row.holders.toLocaleString()}
                            </span>
                          </span>
                          <span className="text-zinc-700" aria-hidden>
                            •
                          </span>
                          <span className="tabular-nums">
                            CA{" "}
                            <span className="font-mono text-zinc-400">
                              {shortenCa(row.mint)}
                            </span>
                          </span>
                        </div>
                      </div>

                      <div className="shrink-0 text-right">
                        <div className="text-sm font-semibold tabular-nums text-zinc-100">
                          {formatPriceUsd(row.priceUsd)}
                        </div>
                        <div
                          className={`mt-0.5 text-xs font-semibold tabular-nums ${
                            positive ? "text-[#39FF14]/95" : "text-red-400"
                          }`}
                        >
                          {positive ? "▲" : "▼"} {Math.abs(row.changePct).toFixed(1)}%
                        </div>
                      </div>

                      <div className="shrink-0 text-right">
                        <div className="text-xs font-semibold tabular-nums text-zinc-200">
                          {formatCompactUsd(row.liquidityUsd)}
                        </div>
                        <div className="mt-0.5 text-[11px] tabular-nums text-zinc-500">
                          Vol {formatCompactUsd(row.volumeUsd)}
                        </div>
                      </div>

                      <span className="ml-1 hidden text-xs text-zinc-500 group-hover:inline">
                        ↗
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </PanelCard>
  );
}

function RankPanel({
  yourRankLoading,
  yourWeekRank,
  stats,
}: {
  yourRankLoading: boolean;
  yourWeekRank: number | null;
  stats: MeStats | null;
}) {
  /** Same D / W / M / A control as `app/leaderboard/page.tsx` "Your Rank" card. */
  const [range, setRange] = useState<"D" | "W" | "M" | "A">("D");

  const timeframeLabel =
    {
      D: "24h",
      W: "7d",
      M: "30d",
      A: "All time",
    }[range] ?? "24h";

  const emptyRankHint =
    range === "D"
      ? "No rank today yet — keep calling to climb the daily board."
      : range === "W"
        ? "No rank this week yet — user calls in the last 7 days earn a spot on the leaderboard."
        : range === "M"
          ? "No rank this month yet — sustained activity over the month counts toward placement."
          : "No all-time placement yet — long-term callers earn a permanent ladder spot.";

  /** Weekly rank from API; shown for every range until multi-period API exists. */
  const displayRank = yourWeekRank;

  const shellRing = "";

  return (
    <div
      className={[
        "group relative flex h-full w-full flex-col overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/30 p-4",
        shellRing,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="pointer-events-none absolute inset-0 bg-zinc-500/5 opacity-35 blur-2xl transition-opacity duration-300 group-hover:opacity-55" />

      <div className="relative z-10 flex min-h-0 flex-1 flex-col">
        <div className="flex items-start justify-between gap-3">
          <div className="text-sm text-zinc-400">Your Rank</div>
          <div className="flex shrink-0 gap-1" role="tablist" aria-label="Rank period">
            {(["D", "W", "M", "A"] as const).map((t) => (
              <button
                key={t}
                type="button"
                role="tab"
                aria-selected={range === t}
                onClick={() => setRange(t)}
                className={`rounded border px-2 py-0.5 text-xs transition ${
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

        {yourRankLoading ? (
          <div className="mt-2 flex flex-1 animate-pulse items-center justify-between gap-3" aria-busy="true">
            <div className="space-y-2">
              <div className="h-2 w-16 rounded bg-zinc-800" />
              <div className="h-8 w-20 rounded bg-zinc-800/90" />
              <div className="h-2 w-24 rounded bg-zinc-800/80" />
            </div>
            <div className="space-y-2 text-right">
              <div className="ml-auto h-2 w-12 rounded bg-zinc-800" />
              <div className="ml-auto h-5 w-10 rounded bg-zinc-800/90" />
            </div>
          </div>
        ) : displayRank === null ? (
          <p className="mt-2 text-sm leading-relaxed text-zinc-400">{emptyRankHint}</p>
        ) : (
          <>
            <div className="mt-2 flex items-center justify-between">
              <div>
                <div className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
                  GLOBAL RANK
                </div>
                <div className="mt-0.5 text-4xl font-bold tracking-tight text-white drop-shadow-[0_0_6px_rgba(34,197,94,0.3)]">
                  #{displayRank}
                </div>
                <div className="mt-1 text-xs text-zinc-500">
                  Rolling 7d callerboard
                </div>
              </div>

              <div className="text-right">
                <div className="text-sm text-zinc-500">Win rate</div>
                <div className="font-medium text-zinc-200">
                  {stats === null ? "—" : `${stats.winRate.toFixed(0)}%`}
                </div>
              </div>
            </div>

            <div className="mt-2 text-xs text-zinc-500">
              {stats === null
                ? "—"
                : range === "D"
                  ? `${stats.callsToday} call${stats.callsToday === 1 ? "" : "s"} today • ${timeframeLabel}`
                  : `${stats.totalCalls} verified call${stats.totalCalls === 1 ? "" : "s"} • same window as Personal Stats`}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function TopPerformersPanel({
  topPerformersLoading,
  topPerformersToday,
  viewerId,
  viewerName,
  badgesByUser,
}: {
  topPerformersLoading: boolean;
  topPerformersToday: TopPerformerTodayRow[];
  viewerId?: string;
  viewerName?: string | null;
  badgesByUser?: Record<string, string[]>;
}) {
  const emptyState = (
    <div className="mt-3 flex min-h-[240px] flex-col justify-between gap-4">
      <div className="rounded-xl border border-zinc-900 bg-zinc-950/40 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span
              className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-zinc-950 text-sm"
              aria-hidden
            >
              🏆
            </span>
            <div>
              <p className="text-sm font-semibold text-zinc-100">
                No calls in the last 24 hours yet.
              </p>
              <p className="mt-0.5 text-xs text-zinc-500">
                First solid call today will claim the #1 spot.
              </p>
            </div>
          </div>
          <span className="hidden rounded-full border border-green-400/15 bg-green-400/10 px-2.5 py-1 text-[11px] font-semibold tabular-nums text-green-300/90 sm:inline-flex">
            Rolling 24h
          </span>
        </div>
      </div>

      <ul className="space-y-2">
        {[
          { medal: "🥇", label: "#1", tint: "border-yellow-500/25 bg-yellow-500/5" },
          { medal: "🥈", label: "#2", tint: "border-zinc-400/20 bg-zinc-500/5" },
          { medal: "🥉", label: "#3", tint: "border-amber-500/25 bg-amber-500/5" },
        ].map((row) => (
          <li
            key={row.label}
            className={`rounded-xl border px-4 py-3 shadow-sm shadow-black/20 ${row.tint} border-[#1a1a1a]`}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-zinc-950/40 text-base"
                  aria-hidden
                >
                  {row.medal}
                </span>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold tabular-nums text-zinc-400">
                      {row.label}
                    </span>
                    <span className="h-1 w-1 rounded-full bg-zinc-700" aria-hidden />
                    <span className="h-3 w-28 animate-pulse rounded bg-zinc-800/80" />
                  </div>
                  <div className="mt-1 h-3 w-48 animate-pulse rounded bg-zinc-900/70" />
                </div>
              </div>
              <div className="shrink-0 text-right">
                <div className="h-4 w-14 animate-pulse rounded bg-zinc-800/80" />
                <div className="mt-1 h-3 w-16 animate-pulse rounded bg-zinc-900/70" />
              </div>
            </div>
          </li>
        ))}
      </ul>

      <div className="rounded-xl border border-zinc-900 bg-zinc-950/30 p-3">
        <p className="text-xs leading-relaxed text-zinc-500">
          Tip: leaderboard favors{" "}
          <span className="font-semibold text-zinc-300">clean entries</span>,{" "}
          <span className="font-semibold text-zinc-300">tight invalidation</span>, and{" "}
          <span className="font-semibold text-zinc-300">real liquidity</span>.
        </p>
      </div>
    </div>
  );

  return (
    <section className="mb-8">
      <PanelCard
        title="🔥 Top Performers Today"
        titleClassName="normal-case"
        className="relative overflow-hidden"
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-yellow-500/35 via-[color:var(--accent)]/35 to-transparent" />
        {topPerformersLoading ? (
          <div className="mt-3 flex min-h-[64px] items-center justify-center">
            <p className="text-sm text-zinc-500">Loading…</p>
          </div>
        ) : topPerformersToday.length === 0 ? (
          emptyState
        ) : (
          <ul className="mt-3 space-y-2">
            {topPerformersToday.map((row, index) => {
              const listPosition = index + 1;
              const isCurrentUser =
                !!viewerId && row.discordId.trim() === viewerId.trim();
              const v = topPerformerVisuals(index, isCurrentUser);
              const label = viewerDisplayName(
                row.discordId,
                row.username,
                viewerId,
                viewerName
              );
              return (
                <li
                  key={row.discordId}
                  className={`${v.row} ${TOP_PERFORMER_ROW_INTERACTIVE}`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <span
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold tabular-nums ${v.badge}`}
                      >
                        #{listPosition}
                      </span>
                      <Link
                        href={userProfileHref({
                          discordId: row.discordId,
                          displayName: label,
                        })}
                        className={v.nameLink}
                      >
                        {label}
                      </Link>
                      <UserBadgeIcons
                        badges={(badgesByUser ?? {})[row.discordId.trim()] ?? []}
                      />
                    </div>
                    <div className="shrink-0 text-right text-sm">
                      <p className="tabular-nums">
                        <span className={v.avgStrong}>
                          {row.avgX.toFixed(1)}x
                        </span>
                        <span
                          className={
                            isCurrentUser
                              ? "text-[#39FF14]/70"
                              : "text-zinc-500"
                          }
                        >
                          {" "}
                          avg
                        </span>
                      </p>
                      <p
                        className={`mt-0.5 text-xs tabular-nums ${
                          isCurrentUser
                            ? "text-[#39FF14]/60"
                            : "text-zinc-500"
                        }`}
                      >
                        Best {row.bestMultiple.toFixed(1)}x
                      </p>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </PanelCard>
    </section>
  );
}

type ActivityFeedPanelProps = {
  feedMode: "all" | "me" | "milestones" | "calls" | "following";
  setFeedMode: (m: "all" | "me" | "milestones" | "calls" | "following") => void;
  loadingActivity: boolean;
  activity: ActivityItem[];
  followingIds: Set<string>;
  setFollowing: (id: string, next: boolean) => void;
  nowMs: number;
  setSelectedActivity: (item: ActivityItem | null) => void;
  badgesByUser?: Record<string, string[]>;
  viewerId?: string;
  viewerName?: string | null;
};

function ActivityFeedPanel({
  feedMode,
  setFeedMode,
  loadingActivity,
  activity,
  followingIds,
  setFollowing,
  nowMs,
  setSelectedActivity,
  badgesByUser,
  viewerId,
  viewerName,
}: ActivityFeedPanelProps) {
  const filteredActivity = useMemo(() => {
    if (feedMode === "me") {
      const me = (viewerId ?? "").trim();
      if (!me) return [];
      return activity.filter((a) => a.discordId.trim() === me);
    }
    if (feedMode === "milestones") return activity.filter((a) => a.type === "win");
    if (feedMode === "calls") return activity.filter((a) => a.type === "call");
    return activity;
  }, [activity, feedMode, viewerId]);

  return (
    <PanelCard title="Live Activity">
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        {(
          [
            { id: "all" as const, label: "All" },
            { id: "me" as const, label: "My Activity" },
            { id: "milestones" as const, label: "Milestones" },
            { id: "calls" as const, label: "Calls" },
            { id: "following" as const, label: "Following" },
          ] as const
        ).map(({ id, label }) => {
          const active = feedMode === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setFeedMode(id)}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                active
                  ? "bg-zinc-700 text-zinc-50"
                  : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-zinc-100"
              }`}
            >
              {label}
            </button>
          );
        })}
        <div className="ml-auto hidden items-center gap-2 text-[11px] text-zinc-500 sm:flex">
          <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--accent)] opacity-80" aria-hidden />
          LIVE
        </div>
      </div>

      <div className="mt-2 h-[300px] overflow-y-auto pr-1 text-sm no-scrollbar">
        {loadingActivity ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm text-zinc-500">Loading activity...</p>
          </div>
        ) : filteredActivity.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm text-zinc-500">
              {feedMode === "me"
                ? "No activity from you yet"
                : feedMode === "following"
                ? "No activity from people you follow"
                : feedMode === "milestones"
                  ? "No milestones yet"
                  : feedMode === "calls"
                    ? "No calls yet"
                    : "No activity yet"}
            </p>
          </div>
        ) : (
          <ul className="text-sm">
            {filteredActivity.map((item, i) => (
            <li
              key={`${String(item.time)}-${i}-${item.text.slice(0, 24)}`}
              className="dashboard-feed-item border-b border-[#1a1a1a] last:border-b-0"
              style={{ animationDelay: `${i * 70}ms` }}
            >
              <div className="group relative">
                <div
                  className={`absolute bottom-1 left-0 top-1 w-[2px] rounded-full transition-opacity ${
                    item.type === "win"
                      ? "bg-[color:var(--accent)]/45 opacity-90"
                      : "bg-cyan-400/35 opacity-0 group-hover:opacity-80"
                  }`}
                />
                <div className="pl-3">
                  <div className="flex items-start gap-2 rounded-lg bg-zinc-900/40 px-3 py-2 transition-all duration-150 hover:bg-zinc-800/60">
                    <FollowButton
                      targetDiscordId={item.discordId}
                      following={followingIds.has(item.discordId)}
                      onFollowingChange={(next) => setFollowing(item.discordId, next)}
                      className="mt-0.5"
                    />
                    {item.tokenImageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.tokenImageUrl}
                        alt=""
                        className="mt-0.5 h-8 w-8 shrink-0 rounded-md border border-zinc-700/60 object-cover"
                        loading="lazy"
                        referrerPolicy="no-referrer"
                      />
                    ) : null}
                    <span
                      className="mt-0.5 flex w-8 shrink-0 justify-center text-base leading-none opacity-[0.88]"
                      aria-hidden
                    >
                      {item.type === "win" ? "🔥" : "⚡"}
                    </span>
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelectedActivity(item)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setSelectedActivity(item);
                        }
                      }}
                      className="flex min-w-0 flex-1 cursor-pointer items-start justify-between gap-3 rounded-md border-0 bg-transparent py-0 text-left text-inherit focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/40"
                    >
                      <span className="min-w-0 text-zinc-200">
                        {renderActivityFeedLine(
                          item,
                          viewerId,
                          viewerName,
                          (badgesByUser ?? {})[item.discordId.trim()] ?? []
                        )}
                      </span>
                      <span className="flex shrink-0 items-center gap-1.5">
                        {Number.isFinite(item.multiple) && item.multiple > 0 ? (
                          <span className="font-semibold tabular-nums text-[color:var(--accent)]">
                            {item.multiple.toFixed(1)}x
                          </span>
                        ) : null}
                        <span className="text-xs tabular-nums text-zinc-500">
                          {formatJoinedAt(callTimeMs(item.time), nowMs)}
                        </span>
                        <span className="text-xs text-zinc-500" aria-hidden>
                          ↗
                        </span>
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </li>
            ))}
          </ul>
        )}
      </div>
    </PanelCard>
  );
}

type FollowingFeedItem = {
  user: string;
  action: "called" | "hit 2x" | "hit 3x";
  token: string;
  multiple: number;
  time: string;
};

const FOLLOWING_FEED_MOCK: FollowingFeedItem[] = [
  { user: "McGzyy", action: "called", token: "ABC", multiple: 2.4, time: "2m ago" },
  { user: "Luna", action: "hit 2x", token: "SOLXYZ", multiple: 2.1, time: "8m ago" },
  { user: "Dex", action: "called", token: "DEV123", multiple: 1.3, time: "14m ago" },
  { user: "Nova", action: "hit 3x", token: "PEPE2", multiple: 3.2, time: "22m ago" },
  { user: "Artemis", action: "called", token: "WIF", multiple: 1.9, time: "35m ago" },
  { user: "Kairo", action: "hit 2x", token: "BOME", multiple: 2.6, time: "49m ago" },
  { user: "Vega", action: "called", token: "JUP", multiple: 1.1, time: "1h ago" },
];

function FollowingFeedPanel() {
  return (
    <PanelCard title="Following Feed">
      <ul className="mt-2 max-h-[300px] overflow-y-auto pr-1 text-sm">
        {FOLLOWING_FEED_MOCK.slice(0, 10).map((item, i) => (
          <li
            key={`${item.user}-${item.token}-${item.time}-${i}`}
            className="border-b border-[#1a1a1a] last:border-b-0"
          >
            <div className="-mx-1 flex items-start justify-between gap-3 rounded-md py-2 pl-1 pr-1 transition-colors duration-150 hover:bg-zinc-800/30 sm:pl-2 sm:pr-2">
              <div className="min-w-0">
                <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                  <span className="min-w-0 truncate font-medium text-zinc-100">
                    {item.user}
                  </span>
                  <span className="text-zinc-500">{item.action}</span>
                  <span className="font-medium text-zinc-200">{item.token}</span>
                </p>
                <p className="mt-0.5 text-xs text-zinc-500">
                  {item.time}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="font-semibold tabular-nums text-zinc-100">
                  {Number.isFinite(item.multiple) ? `${item.multiple.toFixed(1)}x` : "-"}
                </p>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </PanelCard>
  );
}

function SocialsFeedPanel() {
  const { data: session, status } = useSession();
  const [tab, setTab] = useState<"all" | SocialPlatform>("all");
  const [items, setItems] = useState<SocialFeedItem[]>([]);
  const [flashId, setFlashId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [sources, setSources] = useState<
    { id: string; platform: SocialPlatform; handle: string; displayName: string | null }[]
  >([]);
  const [sourcesLoading, setSourcesLoading] = useState(false);
  const [sourcePlatform, setSourcePlatform] = useState<SocialPlatform>("x");
  const [sourceHandle, setSourceHandle] = useState("");
  const [sourceDisplayName, setSourceDisplayName] = useState("");
  const [sourceBusy, setSourceBusy] = useState(false);
  const [sourceOk, setSourceOk] = useState<string | null>(null);
  const [sourceErr, setSourceErr] = useState<string | null>(null);

  const tier = (session?.user as any)?.helpTier as string | undefined;
  const canSubmit = status === "authenticated" && (tier === "mod" || tier === "admin");
  const isAdmin = status === "authenticated" && tier === "admin";

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/social-feed?platform=${encodeURIComponent(tab)}`, { credentials: "same-origin" })
      .then((res) => res.json().then((json) => ({ ok: res.ok, json })))
      .then(({ ok, json }) => {
        if (cancelled) return;
        const rowsRaw =
          ok && json && typeof json === "object" && Array.isArray((json as any).rows)
            ? ((json as any).rows as unknown[])
            : [];
        const parsed: SocialFeedItem[] = [];
        for (const r of rowsRaw) {
          if (!r || typeof r !== "object") continue;
          const o = r as Record<string, unknown>;
          const id = typeof o.id === "string" ? o.id.trim() : "";
          const platform = typeof o.platform === "string" ? o.platform : "";
          const authorName = typeof o.authorName === "string" ? o.authorName.trim() : "";
          const authorHandle = typeof o.authorHandle === "string" ? o.authorHandle.trim() : "";
          const postedAtLabel = typeof o.postedAtLabel === "string" ? o.postedAtLabel.trim() : "";
          const text = typeof o.text === "string" ? o.text.trim() : "";
          if (!id || !authorName || !postedAtLabel || !text) continue;
          parsed.push({
            id,
            platform: (platform as SocialFeedItem["platform"]) || "x",
            authorName,
            authorHandle,
            postedAtLabel,
            text,
            metricLabel: typeof o.metricLabel === "string" ? o.metricLabel : undefined,
          });
        }
        setItems(parsed);
        if (parsed.length > 0) {
          setFlashId(parsed[0].id);
          window.setTimeout(() => setFlashId(null), 900);
        }
      })
      .catch(() => {
        if (!cancelled) setItems([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tab]);

  const loadSources = useCallback(async () => {
    setSourcesLoading(true);
    setSourceErr(null);
    try {
      const res = await fetch("/api/social-sources", { credentials: "same-origin" });
      const json = (await res.json().catch(() => null)) as any;
      const list = json && json.success === true && Array.isArray(json.sources) ? json.sources : [];
      const parsed: typeof sources = [];
      for (const row of list) {
        if (!row || typeof row !== "object") continue;
        const o = row as Record<string, unknown>;
        const id = typeof o.id === "string" ? o.id.trim() : "";
        const platform = typeof o.platform === "string" ? o.platform : "";
        const handle = typeof o.handle === "string" ? o.handle.trim() : "";
        if (!id || !handle) continue;
        parsed.push({
          id,
          platform: platform === "instagram" ? "instagram" : "x",
          handle,
          displayName: typeof o.displayName === "string" ? o.displayName : null,
        });
      }
      setSources(parsed);
    } catch {
      setSources([]);
      setSourceErr("Failed to load sources.");
    } finally {
      setSourcesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!expanded) return;
    void loadSources();
  }, [expanded, loadSources]);

  const rows = useMemo(() => {
    if (tab === "all") return items;
    return items.filter((r) => r.platform === tab);
  }, [items, tab]);

  const platformPill = (p: SocialPlatform) =>
    p === "x"
      ? "border-zinc-700/60 bg-zinc-900/40 text-zinc-200"
      : "border-fuchsia-500/25 bg-fuchsia-500/10 text-fuchsia-200";

  const feedList = (
    <>
      {rows.length === 0 ? (
        <div className="flex h-full items-center justify-center px-3 py-10">
          <div className="text-center">
            <p className="text-sm font-semibold text-zinc-200">No posts yet</p>
            <p className="mt-1 text-xs text-zinc-500">This feed is wired — waiting on sources.</p>
          </div>
        </div>
      ) : (
        <ul className="space-y-1">
          {rows.map((item) => (
            <li
              key={item.id}
              className={`rounded-lg border border-[#1a1a1a] bg-zinc-900/20 px-3 py-2 transition-colors hover:bg-zinc-900/35 ${
                flashId === item.id ? "ring-1 ring-[color:var(--accent)]/35 bg-zinc-900/35" : ""
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span
                      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${platformPill(
                        item.platform
                      )}`}
                    >
                      {item.platform === "x" ? "X" : "IG"}
                    </span>
                    <span className="truncate text-sm font-semibold text-zinc-100">
                      {item.authorName}
                    </span>
                    <span className="text-xs text-zinc-500">{item.authorHandle}</span>
                    <span className="text-xs text-zinc-600">•</span>
                    <span className="text-xs tabular-nums text-zinc-500">{item.postedAtLabel}</span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm text-zinc-200">{item.text}</p>
                </div>

                {item.metricLabel ? (
                  <span className="shrink-0 rounded-full border border-zinc-700/60 bg-zinc-900/40 px-2.5 py-0.5 text-[11px] font-medium tabular-nums text-zinc-200">
                    {item.metricLabel}
                  </span>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );

  return (
    <>
      <PanelCard title="Social Feed" titleClassName="normal-case">
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 p-1">
          <button
            type="button"
            onClick={() => setTab("all")}
            className={`rounded-md px-2 py-1 text-xs transition-all ${
              tab === "all"
                ? "border border-zinc-500/30 bg-zinc-500/10 font-semibold text-zinc-100"
                : "text-zinc-500 hover:bg-white/5 hover:text-white"
            }`}
          >
            All
          </button>
          <button
            type="button"
            onClick={() => setTab("x")}
            className={`rounded-md px-2 py-1 text-xs transition-all ${
              tab === "x"
                ? "border border-zinc-500/30 bg-zinc-500/10 font-semibold text-zinc-100"
                : "text-zinc-500 hover:bg-white/5 hover:text-white"
            }`}
          >
            X
          </button>
          <button
            type="button"
            onClick={() => setTab("instagram")}
            className={`rounded-md px-2 py-1 text-xs transition-all ${
              tab === "instagram"
                ? "border border-zinc-500/30 bg-zinc-500/10 font-semibold text-zinc-100"
                : "text-zinc-500 hover:bg-white/5 hover:text-white"
            }`}
          >
            Instagram
          </button>
        </div>
        <div className="flex items-center gap-2">
          <div className="text-[11px] text-zinc-500">
            {loading ? "Loading…" : "Live • feed wired"}
          </div>
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="rounded-lg border border-zinc-700/70 bg-zinc-950/40 px-3 py-1.5 text-[11px] font-semibold text-zinc-200 transition hover:border-zinc-600 hover:bg-zinc-950/55"
          >
            Expand
          </button>
        </div>
      </div>

      <div className="mt-3 rounded-xl border border-zinc-900 bg-zinc-950/40 p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
        <div className="h-[300px] overflow-y-auto pr-1 no-scrollbar">{feedList}</div>
      </div>
    </PanelCard>

      {expanded
        ? createPortal(
            <div className="fixed inset-0 z-[60]">
              <div
                className="absolute inset-0 bg-black/70 backdrop-blur-sm"
                onClick={() => setExpanded(false)}
                aria-hidden
              />
              <div className="absolute inset-0 flex items-start justify-center p-4 sm:p-8">
                <div className="w-full max-w-5xl overflow-hidden rounded-2xl border border-white/10 bg-zinc-950/95 shadow-2xl">
                  <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
                    <div>
                      <p className="text-xs font-semibold text-zinc-200">Social Feed</p>
                      <p className="text-[11px] text-zinc-500">
                        {isAdmin
                          ? "Add accounts to monitor. Mods submit for approval."
                          : canSubmit
                            ? "Submit an account for approval."
                            : "Sign in as staff to submit sources."}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setExpanded(false)}
                      className="rounded-lg border border-zinc-700/70 bg-zinc-950/40 px-3 py-1.5 text-[11px] font-semibold text-zinc-200 transition hover:border-zinc-600 hover:bg-zinc-950/55"
                    >
                      Close
                    </button>
                  </div>

                  <div className="grid gap-4 p-4 md:grid-cols-[1fr,1fr]">
                    <div className="rounded-xl border border-zinc-800/60 bg-black/25 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
                          Sources
                        </p>
                        <button
                          type="button"
                          onClick={() => void loadSources()}
                          className="rounded-lg border border-zinc-700/70 bg-zinc-950/40 px-3 py-1.5 text-[11px] font-semibold text-zinc-200 transition hover:border-zinc-600 hover:bg-zinc-950/55 disabled:opacity-50"
                          disabled={sourcesLoading}
                        >
                          {sourcesLoading ? "Refreshing…" : "Refresh"}
                        </button>
                      </div>

                      {sourceErr ? <p className="mt-2 text-xs text-red-300/90">{sourceErr}</p> : null}
                      {sourceOk ? (
                        <p className="mt-2 text-xs text-emerald-300/90">{sourceOk}</p>
                      ) : null}

                      <div className="mt-3 grid gap-2 sm:grid-cols-3">
                        <label className="block text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                          Platform
                          <select
                            value={sourcePlatform}
                            onChange={(e) => setSourcePlatform(e.target.value as SocialPlatform)}
                            disabled={!canSubmit || sourceBusy}
                            className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950/70 px-2.5 py-2 text-sm text-zinc-100 outline-none focus:border-zinc-500 disabled:opacity-50"
                          >
                            <option value="x">X</option>
                            <option value="instagram">Instagram</option>
                          </select>
                        </label>
                        <label className="block text-[11px] font-semibold uppercase tracking-wide text-zinc-500 sm:col-span-2">
                          Handle
                          <input
                            value={sourceHandle}
                            onChange={(e) => setSourceHandle(e.target.value)}
                            disabled={!canSubmit || sourceBusy}
                            placeholder="@account"
                            className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950/70 px-2.5 py-2 text-sm text-zinc-100 outline-none focus:border-zinc-500 disabled:opacity-50"
                          />
                        </label>
                        <label className="block text-[11px] font-semibold uppercase tracking-wide text-zinc-500 sm:col-span-3">
                          Display name (optional)
                          <input
                            value={sourceDisplayName}
                            onChange={(e) => setSourceDisplayName(e.target.value)}
                            disabled={!canSubmit || sourceBusy}
                            placeholder="Friendly label shown in the feed"
                            className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950/70 px-2.5 py-2 text-sm text-zinc-100 outline-none focus:border-zinc-500 disabled:opacity-50"
                          />
                        </label>
                      </div>

                      <div className="mt-3 flex items-center justify-between gap-3">
                        <p className="text-xs text-zinc-500">
                          Action:{" "}
                          <span className="font-semibold text-zinc-300">
                            {isAdmin ? "Add to live feed" : "Submit for approval"}
                          </span>
                        </p>
                        <button
                          type="button"
                          disabled={!canSubmit || sourceBusy || !sourceHandle.trim()}
                          onClick={() => {
                            void (async () => {
                              if (sourceBusy) return;
                              setSourceBusy(true);
                              setSourceErr(null);
                              setSourceOk(null);
                              try {
                                const res = await fetch("/api/social-sources", {
                                  method: "POST",
                                  credentials: "same-origin",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({
                                    platform: sourcePlatform,
                                    handle: sourceHandle,
                                    displayName: sourceDisplayName,
                                  }),
                                });
                                const json = (await res.json().catch(() => null)) as any;
                                if (!res.ok || !json || json.success !== true) {
                                  setSourceErr(
                                    typeof json?.error === "string" ? json.error : "Request failed."
                                  );
                                  return;
                                }
                                setSourceHandle("");
                                setSourceDisplayName("");
                                setSourceOk(
                                  isAdmin
                                    ? "Source added."
                                    : json.alreadyPending
                                      ? "Already pending approval."
                                      : "Submitted for approval."
                                );
                                await loadSources();
                              } catch {
                                setSourceErr("Request failed.");
                              } finally {
                                setSourceBusy(false);
                              }
                            })();
                          }}
                          className="rounded-lg bg-[color:var(--accent)] px-3 py-2 text-[12px] font-semibold text-black shadow-lg shadow-black/40 transition hover:bg-green-500 disabled:opacity-50"
                        >
                          {isAdmin ? "Add" : "Submit"}
                        </button>
                      </div>

                      {!isAdmin ? (
                        <p className="mt-2 text-xs text-zinc-600">
                          Submissions show up in the Admin panel for approval before they appear in the live feed.
                        </p>
                      ) : null}

                      <div className="mt-3 border-t border-zinc-800/70 pt-3">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
                          Active sources
                        </p>
                        {sources.length === 0 ? (
                          <p className="mt-2 text-xs text-zinc-500">No sources configured yet.</p>
                        ) : (
                          <ul className="mt-2 grid gap-1 sm:grid-cols-2">
                            {sources.slice(0, 24).map((s) => (
                              <li
                                key={s.id}
                                className="flex items-center justify-between rounded-md border border-zinc-800/60 bg-zinc-950/40 px-2.5 py-2"
                              >
                                <span className="min-w-0">
                                  <span className="text-xs font-semibold text-zinc-200">
                                    {s.platform === "x" ? "X" : "IG"}
                                  </span>{" "}
                                  <span className="text-xs text-zinc-400">
                                    @{s.handle.replace(/^@/, "")}
                                  </span>
                                  {s.displayName ? (
                                    <span className="ml-2 text-xs text-zinc-500">{s.displayName}</span>
                                  ) : null}
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>

                    <div className="rounded-xl border border-zinc-900 bg-zinc-950/40 p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
                      <div className="h-[520px] overflow-y-auto pr-1 no-scrollbar">{feedList}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  );
}

type SetupTimeframe = "5m" | "1h" | "4h";
type SetupMarket = "SOL Memes" | "Majors" | "New Pairs";
type OpportunitySetup = {
  id: string;
  symbol: string;
  mint: string;
  setup: "Breakout" | "Reclaim" | "Sweep" | "VWAP Bounce" | "Rotation Leader";
  score: number; // 0-100
  timeframe: SetupTimeframe;
  market: SetupMarket;
  trigger: string;
  invalidation: string;
  liquidityUsd: number;
  volumeUsd: number;
  note: string;
};

const OPPORTUNITIES_MOCK: OpportunitySetup[] = [
  {
    id: "opp-1",
    symbol: "WIF",
    mint: "EKpQGSJtjMFqKZ9q8i7vNQkWQwGJcD3u3wqBzQk9sYtX",
    setup: "Breakout",
    score: 88,
    timeframe: "5m",
    market: "SOL Memes",
    trigger: "Break above $2.45 with volume confirmation",
    invalidation: "Lose $2.34 (range low)",
    liquidityUsd: 12_400_000,
    volumeUsd: 18_900_000,
    note: "Tight range + rising bids. Let it prove strength.",
  },
  {
    id: "opp-2",
    symbol: "JUP",
    mint: "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN",
    setup: "Reclaim",
    score: 76,
    timeframe: "1h",
    market: "Majors",
    trigger: "Reclaim $1.15 and hold above VWAP",
    invalidation: "Close below $1.09",
    liquidityUsd: 31_800_000,
    volumeUsd: 9_400_000,
    note: "Cleaner structure; patience beats chasing.",
  },
  {
    id: "opp-3",
    symbol: "BOME",
    mint: "ukHH6c7mMyiWCf1b9pnWe25TSpkDDt3H5pQZgZ74J82",
    setup: "Sweep",
    score: 81,
    timeframe: "5m",
    market: "SOL Memes",
    trigger: "Sweep lows then reclaim $0.0140",
    invalidation: "Lower low + no reclaim",
    liquidityUsd: 4_900_000,
    volumeUsd: 8_100_000,
    note: "Watch for quick reclaim; don’t marry it.",
  },
  {
    id: "opp-4",
    symbol: "PYTH",
    mint: "HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3",
    setup: "VWAP Bounce",
    score: 72,
    timeframe: "1h",
    market: "Majors",
    trigger: "Bounce VWAP with higher low",
    invalidation: "VWAP loss + weak bids",
    liquidityUsd: 6_700_000,
    volumeUsd: 3_200_000,
    note: "If it holds VWAP twice, runners usually follow.",
  },
  {
    id: "opp-5",
    symbol: "MEW",
    mint: "MEW1gQWJ3nEXg2qZrJ2Jc8Gd8oZ2e2u9X1pQGqVJ9uQ",
    setup: "Rotation Leader",
    score: 84,
    timeframe: "5m",
    market: "New Pairs",
    trigger: "Hold above launch VWAP, then push highs",
    invalidation: "Break below VWAP with heavy sells",
    liquidityUsd: 2_700_000,
    volumeUsd: 5_900_000,
    note: "Lead coin behavior. Size only after confirmation.",
  },
  {
    id: "opp-6",
    symbol: "ORCA",
    mint: "orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE",
    setup: "Reclaim",
    score: 69,
    timeframe: "4h",
    market: "Majors",
    trigger: "Reclaim $3.25 and hold on retest",
    invalidation: "Fail retest; back into range",
    liquidityUsd: 8_900_000,
    volumeUsd: 1_900_000,
    note: "Higher timeframe: wait for retest confirmation.",
  },
];

function OpportunitiesPanel() {
  const [timeframe, setTimeframe] = useState<SetupTimeframe>("5m");
  const [market, setMarket] = useState<"All" | SetupMarket>("All");
  const [apiRows, setApiRows] = useState<OpportunitySetup[]>([]);
  const [apiLoading, setApiLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setApiLoading(true);
    fetch(
      `/api/opportunities?timeframe=${encodeURIComponent(timeframe)}&market=${encodeURIComponent(market)}`,
      { credentials: "same-origin" }
    )
      .then((res) => res.json().then((json) => ({ ok: res.ok, json })))
      .then(({ ok, json }) => {
        if (cancelled) return;
        const rowsRaw =
          ok && json && typeof json === "object" && Array.isArray((json as any).rows)
            ? ((json as any).rows as unknown[])
            : [];
        const parsed: OpportunitySetup[] = [];
        for (const r of rowsRaw) {
          if (!r || typeof r !== "object") continue;
          const o = r as Record<string, unknown>;
          const id = typeof o.id === "string" ? o.id.trim() : "";
          const symbol = typeof o.symbol === "string" ? o.symbol.trim() : "";
          const mint = typeof o.mint === "string" ? o.mint.trim() : "";
          if (!id || !symbol || !mint) continue;
          parsed.push({
            id,
            symbol,
            mint,
            setup: (o.setup as any) ?? "Breakout",
            score: Number(o.score ?? 0) || 0,
            timeframe: (o.timeframe as any) ?? timeframe,
            market: (o.market as any) ?? "Majors",
            trigger: typeof o.trigger === "string" ? o.trigger : "",
            invalidation: typeof o.invalidation === "string" ? o.invalidation : "",
            liquidityUsd: Number(o.liquidityUsd ?? 0) || 0,
            volumeUsd: Number(o.volumeUsd ?? 0) || 0,
            note: typeof o.note === "string" ? o.note : "",
          });
        }
        setApiRows(parsed);
      })
      .catch(() => {
        if (!cancelled) setApiRows([]);
      })
      .finally(() => {
        if (!cancelled) setApiLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [market, timeframe]);

  const rows = useMemo(() => {
    return apiRows.filter((r) => {
      if (r.timeframe !== timeframe) return false;
      if (market !== "All" && r.market !== market) return false;
      return true;
    }).sort((a, b) => b.score - a.score);
  }, [apiRows, market, timeframe]);

  const chipClass = (active: boolean) =>
    `rounded-lg px-3 py-1.5 text-xs font-semibold tabular-nums transition-colors ${
      active
        ? "bg-zinc-700 text-zinc-50 shadow-sm shadow-black/20"
        : "bg-zinc-900/70 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
    }`;

  const scoreColor = (score: number) => {
    if (score >= 85) return "text-[#39FF14]/95";
    if (score >= 75) return "text-sky-300";
    if (score >= 65) return "text-yellow-300";
    return "text-zinc-400";
  };

  return (
    <PanelCard title="Opportunities" titleClassName="normal-case">
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 p-1">
            {(["5m", "1h", "4h"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTimeframe(t)}
                className={chipClass(timeframe === t)}
              >
                {t}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 p-1">
            {(
              ["All", "SOL Memes", "Majors", "New Pairs"] as const
            ).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMarket(m)}
                className={chipClass(market === m)}
              >
                {m}
              </button>
            ))}
          </div>
        </div>
        <div className="text-[11px] text-zinc-500">
          {apiLoading ? "Loading…" : "Live • feed wired"}
        </div>
      </div>

      <div className="mt-3 rounded-xl border border-zinc-900 bg-zinc-950/40 p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
        <div className="px-2 pb-2 text-[11px] uppercase tracking-wider text-zinc-600">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
            <span>Setup</span>
            <span className="text-right">Score</span>
          </div>
        </div>

        <div className="h-[300px] overflow-y-auto pr-1 no-scrollbar">
          {rows.length === 0 ? (
            <div className="flex h-full items-center justify-center px-3 py-10">
              <div className="text-center">
                <p className="text-sm font-semibold text-zinc-200">
                  No setups
                </p>
                <p className="mt-1 text-xs text-zinc-500">
                  Try a different timeframe or market.
                </p>
              </div>
            </div>
          ) : (
            <ul className="space-y-1">
              {rows.map((row, i) => (
                <li key={row.id}>
                  <button
                    type="button"
                    onClick={() =>
                      window.open(
                        `https://dexscreener.com/solana/${encodeURIComponent(
                          row.mint
                        )}`,
                        "_blank",
                        "noopener,noreferrer"
                      )
                    }
                    className="group w-full rounded-lg border border-[#1a1a1a] bg-zinc-900/20 px-3 py-2 text-left transition-colors hover:bg-zinc-900/35 focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]/25"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-white/10 bg-zinc-950 text-xs font-semibold text-zinc-200">
                            {i + 1}
                          </span>
                          <span className="truncate text-sm font-semibold text-zinc-100">
                            {row.symbol}
                          </span>
                          <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-semibold text-zinc-400">
                            {row.setup}
                          </span>
                          <span className="text-[11px] text-zinc-600">•</span>
                          <span className="text-[11px] font-medium text-zinc-500">
                            {row.market}
                          </span>
                        </div>

                        <div className="mt-1 grid gap-1.5 text-[11px] text-zinc-400">
                          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                            <span className="font-semibold text-zinc-300">
                              Trigger:
                            </span>
                            <span className="text-zinc-200">
                              {row.trigger}
                            </span>
                          </div>
                          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                            <span className="font-semibold text-zinc-300">
                              Invalidation:
                            </span>
                            <span className="text-zinc-200">
                              {row.invalidation}
                            </span>
                          </div>
                        </div>

                        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-zinc-500">
                          <span className="tabular-nums">
                            Liq{" "}
                            <span className="font-semibold text-zinc-300">
                              {formatCompactUsd(row.liquidityUsd)}
                            </span>
                          </span>
                          <span className="text-zinc-700" aria-hidden>
                            •
                          </span>
                          <span className="tabular-nums">
                            Vol{" "}
                            <span className="font-semibold text-zinc-300">
                              {formatCompactUsd(row.volumeUsd)}
                            </span>
                          </span>
                          <span className="text-zinc-700" aria-hidden>
                            •
                          </span>
                          <span className="font-mono text-zinc-500">
                            {shortenCa(row.mint)}
                          </span>
                        </div>

                        <p className="mt-2 line-clamp-2 text-[12px] leading-relaxed text-zinc-500">
                          {row.note}
                        </p>
                      </div>

                      <div className="shrink-0 text-right">
                        <div
                          className={`text-lg font-bold tabular-nums ${scoreColor(
                            row.score
                          )}`}
                        >
                          {row.score}
                        </div>
                        <div className="mt-1 h-1.5 w-20 overflow-hidden rounded-full bg-zinc-900">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-[color:var(--accent)]/70 to-[#39FF14]/70"
                            style={{
                              width: `${Math.max(0, Math.min(100, row.score))}%`,
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </PanelCard>
  );
}

type DashboardChatTab = "general" | "mod";

function chatAttachmentIsLikelyImage(a: {
  url: string;
  contentType?: string;
}): boolean {
  if (a.contentType?.toLowerCase().startsWith("image/")) return true;
  return /\.(png|jpe?g|gif|webp|avif)(\?|#|$)/i.test(a.url);
}

function DashboardChatPanel({
  showModTab,
  modStaffSetupHint = false,
}: {
  showModTab: boolean;
  /** Mod/admin, but `DISCORD_MOD_CHAT_CHANNEL_ID` is not set — explain in UI. */
  modStaffSetupHint?: boolean;
}) {
  const { data: session } = useSession();
  const viewerId = session?.user?.id?.trim() ?? "";
  const { addNotification } = useNotifications();
  const [tab, setTab] = useState<DashboardChatTab>("general");
  const [messages, setMessages] = useState<ChatMessagePayload[]>([]);
  const [loading, setLoading] = useState(true);
  const [chatError, setChatError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [draftByTab, setDraftByTab] = useState<{ general: string; mod: string }>({
    general: "",
    mod: "",
  });
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const stickToBottomRef = useRef(true);
  const [popoutOpen, setPopoutOpen] = useState(false);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [portalReady, setPortalReady] = useState(false);

  useEffect(() => {
    setPortalReady(true);
  }, []);

  useEffect(() => {
    if (!popoutOpen && !imagePreviewUrl) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (imagePreviewUrl) {
        e.preventDefault();
        setImagePreviewUrl(null);
        return;
      }
      if (popoutOpen) {
        e.preventDefault();
        setPopoutOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [imagePreviewUrl, popoutOpen]);

  useEffect(() => {
    if (!popoutOpen && !imagePreviewUrl) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [popoutOpen, imagePreviewUrl]);

  useEffect(() => {
    if (!popoutOpen) return;
    stickToBottomRef.current = true;
  }, [popoutOpen]);

  useEffect(() => {
    if (!showModTab && tab === "mod") setTab("general");
  }, [showModTab, tab]);

  useEffect(() => {
    stickToBottomRef.current = true;
  }, [tab]);

  const handleScrollerScroll = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const gap = el.scrollHeight - el.scrollTop - el.clientHeight;
    stickToBottomRef.current = gap < 100;
  }, []);

  const draft = draftByTab[tab];
  const setDraft = (next: string) =>
    setDraftByTab((prev) => ({ ...prev, [tab]: next }));

  const channelLabel = tab === "mod" ? "#mod-chat" : "#general-chat";

  const load = useCallback(
    (mode: "full" | "poll") => {
      void (async () => {
        if (mode === "full") setLoading(true);
        try {
          const qs = new URLSearchParams({ channel: tab });
          const res = await fetch(`/api/chat/messages?${qs.toString()}`);
          const json: any = await res.json().catch(() => ({}));
          if (!res.ok) {
            const msg =
              typeof json?.error === "string"
                ? json.error
                : `Chat request failed (${res.status}).`;
            if (mode === "full") setChatError(msg);
            return;
          }
          if (mode === "full") setChatError(null);
          const list = Array.isArray(json?.messages) ? (json.messages as any[]) : [];
          const parsed: ChatMessagePayload[] = list
            .filter((m) => m && typeof m === "object")
            .map((m) => {
              const tierRaw = m.authorTier;
              const authorTier: HelpTier =
                tierRaw === "admin" || tierRaw === "mod" || tierRaw === "user"
                  ? tierRaw
                  : "user";
              const attachments: ChatMessagePayload["attachments"] = Array.isArray(
                m.attachments
              )
                ? m.attachments
                    .filter(
                      (x: unknown) =>
                        x &&
                        typeof x === "object" &&
                        typeof (x as { url?: unknown }).url === "string"
                    )
                    .map((x: unknown) => {
                      const o = x as {
                        url: string;
                        content_type?: string;
                        filename?: string;
                      };
                      return {
                        url: String(o.url),
                        contentType:
                          typeof o.content_type === "string" ? o.content_type : undefined,
                        filename: typeof o.filename === "string" ? o.filename : undefined,
                      };
                    })
                : [];
              const embedImageUrls = Array.isArray(m.embedImageUrls)
                ? m.embedImageUrls.filter((u: unknown) => typeof u === "string")
                : [];
              const contentDisplay =
                typeof m.contentDisplay === "string"
                  ? m.contentDisplay
                  : String(m.content ?? "");
              return {
                id: String(m.id ?? crypto.randomUUID()),
                authorId: String(m.authorId ?? "").trim(),
                authorName: String(m.authorName ?? "Unknown"),
                authorHandle:
                  typeof m.authorHandle === "string" ? m.authorHandle : undefined,
                authorTier,
                content: String(m.content ?? ""),
                contentDisplay,
                createdAt: Number(m.createdAt ?? Date.now()),
                attachments,
                embedImageUrls,
              } satisfies ChatMessagePayload;
            })
            .filter((m) => {
              const text = (m.contentDisplay ?? "").trim();
              return (
                text.length > 0 ||
                m.attachments.length > 0 ||
                m.embedImageUrls.length > 0
              );
            })
            .sort((a, b) => a.createdAt - b.createdAt);
          setMessages(parsed.slice(-60));
        } catch {
          if (mode === "full") setChatError("Could not load chat.");
          // ignore; keep last good list
        } finally {
          if (mode === "full") setLoading(false);
        }
      })();
    },
    [tab]
  );

  useEffect(() => {
    load("full");
    const t = window.setInterval(() => load("poll"), 3500);
    return () => window.clearInterval(t);
  }, [load]);

  useLayoutEffect(() => {
    if (loading) return;
    const el = scrollerRef.current;
    if (!el || messages.length === 0) return;
    if (stickToBottomRef.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages, loading]);

  const send = useCallback(async () => {
    if (sending) return;
    const content = draft.trim();
    if (!content) return;
    setSending(true);
    try {
      const res = await fetch("/api/chat/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, channel: tab }),
      });
      const json: any = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(String(json?.error ?? "Failed to send message"));
      }
      setDraft("");
      stickToBottomRef.current = true;
      window.setTimeout(() => load("poll"), 400);
    } catch (err) {
      const msg =
        err && typeof err === "object" && "message" in err
          ? String((err as any).message)
          : "Failed to send message";
      addNotification({
        id: crypto.randomUUID(),
        text: msg || "Failed to send message",
        type: "call",
        createdAt: Date.now(),
        priority: "low",
      });
    } finally {
      setSending(false);
    }
  }, [addNotification, draft, load, sending, tab]);

  const chatToolbar = (
    <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      {showModTab ? (
        <div
          className="flex shrink-0 rounded-lg border border-zinc-800/80 bg-zinc-950/40 p-0.5"
          role="tablist"
          aria-label="Chat channel"
        >
          <button
            type="button"
            role="tab"
            aria-selected={tab === "general"}
            onClick={() => setTab("general")}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
              tab === "general"
                ? "bg-zinc-800 text-zinc-100 shadow-sm"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            General
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "mod"}
            onClick={() => setTab("mod")}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
              tab === "mod"
                ? "bg-sky-950/80 text-sky-100 ring-1 ring-sky-500/25"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            Mod
          </button>
        </div>
      ) : null}
      <div className="flex min-w-0 flex-1 items-center justify-between gap-2 text-[11px] text-zinc-500">
        <span className="inline-flex min-w-0 items-center gap-2 truncate">
          <span
            className={`h-1.5 w-1.5 shrink-0 rounded-full opacity-80 ${
              tab === "mod" ? "bg-sky-400" : "bg-[color:var(--accent)]"
            }`}
            aria-hidden
          />
          <span className="truncate font-medium text-zinc-400">{channelLabel}</span>
        </span>
        <span className="shrink-0">{loading ? "Connecting…" : "Live"}</span>
      </div>
    </div>
  );

  function renderFramedChat(
    scrollerClass: string,
    options?: { stretch?: boolean }
  ) {
    const stretch = options?.stretch ?? false;
    return (
      <div
        className={
          stretch
            ? "mt-2 flex min-h-0 flex-1 flex-col rounded-xl border border-zinc-800/45 bg-zinc-950/15 p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)] backdrop-blur-sm"
            : "mt-2 rounded-xl border border-zinc-800/45 bg-zinc-950/15 p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)] backdrop-blur-sm"
        }
      >
        <div
          ref={scrollerRef}
          onScroll={handleScrollerScroll}
          className={`${scrollerClass} overflow-y-auto pr-1 text-sm no-scrollbar`}
        >
          {chatError ? (
            <div className="flex h-full min-h-[200px] items-center justify-center px-4">
              <div className="max-w-md text-center">
                <p className="text-sm font-semibold text-red-200">Chat unavailable</p>
                <p className="mt-1 text-xs leading-relaxed text-red-200/80">{chatError}</p>
              </div>
            </div>
          ) : loading ? (
            <div className="flex h-full min-h-[200px] items-center justify-center">
              <p className="text-sm text-zinc-500">Loading chat…</p>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex h-full min-h-[200px] items-center justify-center px-4">
              <div className="text-center">
                <p className="text-sm font-semibold text-zinc-200">No messages</p>
                <p className="mt-1 text-xs text-zinc-500">
                  Start the conversation — keep it clean.
                </p>
              </div>
            </div>
          ) : (
            <ul className="space-y-3 px-1 py-1">
              {messages.map((m) => {
                const own = Boolean(viewerId && m.authorId === viewerId);
                const nameColor = DASHBOARD_CHAT_AUTHOR_COLOR[m.authorTier] ?? "#DBDEE1";
                const imageAttachments = m.attachments.filter((a) =>
                  chatAttachmentIsLikelyImage(a)
                );
                const fileAttachments = m.attachments.filter(
                  (a) => !chatAttachmentIsLikelyImage(a)
                );
                const inlineImageUrls = [
                  ...new Set([
                    ...imageAttachments.map((a) => a.url),
                    ...m.embedImageUrls,
                  ]),
                ];
                return (
                  <li
                    key={m.id}
                    className={`flex w-full min-w-0 ${own ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`min-w-0 max-w-[min(92%,26rem)] overflow-hidden rounded-2xl px-3 py-2.5 ${
                        own
                          ? "rounded-br-md border border-[#39FF14]/10 bg-gradient-to-b from-[#39FF14]/[0.07] via-zinc-900/20 to-zinc-950/40 shadow-[inset_0_1px_0_rgba(57,255,20,0.05)] ring-1 ring-white/[0.04]"
                          : "rounded-bl-md border border-white/[0.06] bg-zinc-900/20 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] ring-1 ring-black/25"
                      }`}
                    >
                      <div
                        className={`flex flex-wrap items-baseline gap-x-2 gap-y-0.5 ${
                          own ? "justify-end" : "justify-between"
                        }`}
                      >
                        <div className={`min-w-0 ${own ? "text-right" : ""}`}>
                          {m.authorId ? (
                            <Link
                              href={userProfileHref({
                                discordId: m.authorId,
                                displayName: m.authorName,
                              })}
                              className="truncate text-sm font-semibold underline-offset-2 hover:underline"
                              style={{ color: nameColor }}
                            >
                              {m.authorName}
                            </Link>
                          ) : (
                            <span
                              className="truncate text-sm font-semibold"
                              style={{ color: nameColor }}
                            >
                              {m.authorName}
                            </span>
                          )}
                          {m.authorHandle ? (
                            <span className="ml-2 text-xs text-zinc-500">{m.authorHandle}</span>
                          ) : null}
                        </div>
                        <span className="shrink-0 text-xs tabular-nums text-zinc-500">
                          {formatJoinedAt(m.createdAt, Date.now())}
                        </span>
                      </div>
                      {m.contentDisplay.trim() ? (
                        <p className="mt-1.5 min-w-0 max-w-full whitespace-pre-wrap break-words text-sm leading-relaxed text-zinc-200/95 [overflow-wrap:anywhere]">
                          {m.contentDisplay}
                        </p>
                      ) : null}
                      {inlineImageUrls.length > 0 ? (
                        <div
                          className={`mt-2 flex flex-col gap-2 ${
                            own ? "items-end" : "items-start"
                          }`}
                        >
                          {inlineImageUrls.map((src, imgIdx) => (
                            <button
                              key={`${m.id}-img-${imgIdx}`}
                              type="button"
                              onClick={() => setImagePreviewUrl(src)}
                              className="group block max-w-full overflow-hidden rounded-xl border border-white/[0.06] bg-black/25 text-left transition hover:border-white/12 hover:bg-black/35 focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]/35"
                            >
                              <img
                                src={src}
                                alt=""
                                className="max-h-64 w-full max-w-full cursor-zoom-in object-contain opacity-[0.97] transition group-hover:opacity-100"
                                loading="lazy"
                              />
                            </button>
                          ))}
                        </div>
                      ) : null}
                      {fileAttachments.length > 0 ? (
                        <ul className={`mt-2 space-y-1 ${own ? "text-right" : "text-left"}`}>
                          {fileAttachments.map((a) => (
                            <li key={a.url}>
                              <a
                                href={a.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="break-all text-xs font-medium text-sky-400/90 underline-offset-2 hover:text-sky-300 hover:underline"
                              >
                                {a.filename || "Attachment"}
                              </a>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="mt-2 flex shrink-0 items-center gap-2">
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void send();
              }
            }}
            placeholder={`Message ${channelLabel}`}
            disabled={sending}
            className="h-10 flex-1 rounded-lg border border-zinc-800/70 bg-[#060606] px-3 text-sm text-zinc-200 outline-none ring-[color:var(--accent)]/15 transition focus:border-zinc-700 focus:ring-2 disabled:opacity-60"
          />
          <button
            type="button"
            onClick={() => void send()}
            disabled={sending || draft.trim() === ""}
            className="h-10 rounded-lg bg-[color:var(--accent)] px-4 text-sm font-semibold text-black shadow-lg shadow-black/40 transition hover:bg-green-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {sending ? "Sending…" : "Send"}
          </button>
        </div>
      </div>
    );
  }

  const popoutToggle = (
    <button
      type="button"
      onClick={() => {
        if (popoutOpen) {
          setPopoutOpen(false);
        } else {
          stickToBottomRef.current = true;
          setPopoutOpen(true);
        }
      }}
      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-700/55 bg-zinc-900/35 text-zinc-400 transition hover:border-zinc-600 hover:bg-zinc-800/45 hover:text-zinc-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]/25"
      aria-label={popoutOpen ? "Dock chat to panel" : "Expand chat"}
      title={popoutOpen ? "Dock chat" : "Expand chat"}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className={`h-4 w-4 transition-transform ${popoutOpen ? "rotate-180" : ""}`}
        aria-hidden
      >
        <path
          d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );

  return (
    <>
      <PanelCard
        title="Discord chat"
        titleClassName="normal-case"
        titleRight={popoutToggle}
      >
        {modStaffSetupHint ? (
          <p className="mt-1 text-[11px] leading-relaxed text-amber-500/90">
            Mod tab: set{" "}
            <code className="rounded border border-amber-500/25 bg-zinc-950 px-1 py-px font-mono text-[10px] text-amber-200/90">
              DISCORD_MOD_CHAT_CHANNEL_ID
            </code>{" "}
            in the server environment (Discord channel ID for{" "}
            <span className="font-medium">#mod-chat</span>).
          </p>
        ) : null}
        {!popoutOpen ? (
          <>
            {chatToolbar}
            {renderFramedChat("h-[clamp(320px,42vh,560px)]")}
          </>
        ) : (
          <p className="mt-3 rounded-lg border border-zinc-800/60 bg-zinc-900/25 px-3 py-2.5 text-xs leading-relaxed text-zinc-500">
            Chat is open in the expanded view.{" "}
            <button
              type="button"
              className="font-semibold text-[color:var(--accent)] hover:text-green-400 hover:underline"
              onClick={() => setPopoutOpen(false)}
            >
              Dock here
            </button>
          </p>
        )}
      </PanelCard>

      {portalReady && popoutOpen
        ? createPortal(
            <div
              className="fixed inset-0 z-[55] flex items-center justify-center p-3 sm:p-6"
              role="presentation"
            >
              <button
                type="button"
                className="absolute inset-0 bg-black/75 backdrop-blur-md"
                aria-label="Close expanded chat"
                onClick={() => setPopoutOpen(false)}
              />
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="dashboard-chat-popout-title"
                className="relative flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-zinc-700/50 bg-[#070707] shadow-[0_0_0_1px_rgba(255,255,255,0.04),0_24px_80px_-20px_rgba(0,0,0,0.85)]"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex shrink-0 items-center justify-between gap-3 border-b border-zinc-800/70 px-4 py-3">
                  <h2
                    id="dashboard-chat-popout-title"
                    className="text-sm font-semibold tracking-tight text-zinc-100"
                  >
                    Discord chat
                  </h2>
                  <button
                    type="button"
                    onClick={() => setPopoutOpen(false)}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-700/60 text-zinc-400 transition hover:bg-zinc-800/60 hover:text-zinc-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]/25"
                    aria-label="Close"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      className="h-4 w-4"
                      aria-hidden
                    >
                      <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" />
                    </svg>
                  </button>
                </div>
                <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-3 pb-3 pt-1 sm:px-4 sm:pb-4">
                  {chatToolbar}
                  {renderFramedChat("min-h-0 flex-1", { stretch: true })}
                </div>
              </div>
            </div>,
            document.body
          )
        : null}

      {portalReady && imagePreviewUrl
        ? createPortal(
            <div
              className="fixed inset-0 z-[60] flex cursor-zoom-out flex-col items-center justify-center bg-black/85 p-4 backdrop-blur-md"
              role="dialog"
              aria-modal="true"
              aria-label="Image preview"
              onClick={() => setImagePreviewUrl(null)}
            >
              <div
                className="pointer-events-auto flex max-h-[min(92vh,900px)] w-full max-w-5xl cursor-default flex-col items-center gap-3"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="relative max-h-[min(85vh,820px)] w-full overflow-hidden rounded-xl border border-zinc-700/40 bg-zinc-950/50 shadow-2xl">
                  <img
                    src={imagePreviewUrl}
                    alt=""
                    className="mx-auto max-h-[min(85vh,820px)] w-auto max-w-full object-contain"
                  />
                </div>
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <a
                    href={imagePreviewUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-lg border border-zinc-700/60 bg-zinc-900/50 px-3 py-1.5 text-xs font-semibold text-zinc-300 transition hover:border-zinc-600 hover:text-white"
                    onClick={(e) => e.stopPropagation()}
                  >
                    Open original
                  </a>
                  <button
                    type="button"
                    onClick={() => setImagePreviewUrl(null)}
                    className="rounded-lg border border-zinc-700/60 bg-zinc-900/50 px-3 py-1.5 text-xs font-semibold text-zinc-300 transition hover:border-zinc-600 hover:text-white"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  );
}

async function submitCall(
  ca: string
): Promise<{ ok: boolean; status: number; data: any }> {
  const res = await fetch("/api/call", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ ca }),
  });

  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

export default function Home() {
  const { data: session, status } = useSession();
  const { addNotification } = useNotifications();
  const { openTokenChart } = useTokenChartModal();
  const oauthErrorHandledRef = useRef(false);
  const lastSeenActivityKeysRef = useRef(new Set<string>());
  const activitySourceModeRef = useRef<"all" | "following" | null>(null);
  const [copied, setCopied] = useState(false);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsRefreshing, setStatsRefreshing] = useState(false);
  const [stats, setStats] = useState<MeStats | null>(null);
  const [recentCalls, setRecentCalls] = useState<RecentCallRow[]>([]);
  const [callsLoading, setCallsLoading] = useState(true);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [loadingActivity, setLoadingActivity] = useState(true);
  const [badgesByUser, setBadgesByUser] = useState<Record<string, string[]>>(
    {}
  );
  const [selectedActivity, setSelectedActivity] = useState<ActivityItem | null>(
    null
  );
  const { followingIds, setFollowing } = useFollowingIds();
  const [feedMode, setFeedMode] = useState<
    "all" | "me" | "milestones" | "calls" | "following"
  >("all");
  const [topPerformersToday, setTopPerformersToday] = useState<
    TopPerformerTodayRow[]
  >([]);
  const [topPerformersLoading, setTopPerformersLoading] = useState(true);
  const [yourWeekRank, setYourWeekRank] = useState<number | null>(null);
  const [yourRankLoading, setYourRankLoading] = useState(true);

  const [widgets, setWidgets] = useState<WidgetsEnabled | null>(null);
  const [submitCallOpen, setSubmitCallOpen] = useState(false);
  const [addWatchlistOpen, setAddWatchlistOpen] = useState(false);
  const [watchlistPrivate, setWatchlistPrivate] = useState<string[]>([]);
  const [watchlistPublic, setWatchlistPublic] = useState<string[]>([]);
  const [watchlistLoading, setWatchlistLoading] = useState(true);
  const [watchlistUpdatedAt, setWatchlistUpdatedAt] = useState<number | null>(null);
  const [submitCallValue, setSubmitCallValue] = useState("");
  const [submitCallSubmitting, setSubmitCallSubmitting] = useState(false);
  const [submitCallFeedback, setSubmitCallFeedback] = useState<
    "success" | "already_exists" | null
  >(null);
  /** Bumps after submit-call success so stats / lists refetch without a full page reload. */
  const [homeDataRefreshNonce, setHomeDataRefreshNonce] = useState(0);
  const [helpTier, setHelpTier] = useState<HelpTier>("user");

  /** Refetch stats / charts / rank while monitoring updates Supabase in the background. */
  useEffect(() => {
    if (status !== "authenticated" || !session?.user?.id?.trim()) return;
    const id = window.setInterval(() => {
      setHomeDataRefreshNonce((n) => n + 1);
    }, 20_000);
    return () => window.clearInterval(id);
  }, [status, session?.user?.id]);
  const [modChatConfigured, setModChatConfigured] = useState(false);

  useEffect(() => {
    if (status !== "authenticated") return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/me/help-role");
        const json = (await res.json().catch(() => ({}))) as {
          role?: string;
          modChatConfigured?: boolean;
        };
        if (cancelled) return;
        const r = json.role;
        if (r === "user" || r === "mod" || r === "admin") {
          setHelpTier(r);
          if (r === "mod" || r === "admin") {
            setModChatConfigured(json.modChatConfigured === true);
          } else {
            setModChatConfigured(false);
          }
        }
      } catch {
        // keep defaults
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [status]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (status !== "unauthenticated") return;
    if (oauthErrorHandledRef.current) return;

    const sp = new URLSearchParams(window.location.search);
    const err = sp.get("error");
    if (!err) return;

    oauthErrorHandledRef.current = true;

    const descRaw = sp.get("error_description") ?? "";
    const desc = (() => {
      try {
        return decodeURIComponent(descRaw.replace(/\+/g, " "));
      } catch {
        return descRaw.replace(/\+/g, " ");
      }
    })();

    addNotification({
      id: crypto.randomUUID(),
      text: desc ? `Discord auth failed: ${desc}` : `Discord auth failed (${err})`,
      type: "call",
      createdAt: Date.now(),
      priority: "medium",
    });

    // Clean the URL so refresh doesn't keep re-triggering the toast.
    const url = new URL(window.location.href);
    url.searchParams.delete("error");
    url.searchParams.delete("error_description");
    window.history.replaceState({}, "", url.toString());
  }, [addNotification, status]);

  useEffect(() => {
    if (status !== "authenticated") return;

    let cancelled = false;

    fetch("/api/dashboard-settings")
      .then((res) => res.json())
      .then((data: unknown) => {
        if (cancelled) return;
        if (
          data &&
          typeof data === "object" &&
          "widgets_enabled" in data &&
          (data as { widgets_enabled: unknown }).widgets_enabled != null &&
          typeof (data as { widgets_enabled: unknown }).widgets_enabled ===
            "object"
        ) {
          setWidgets(
            (data as { widgets_enabled: WidgetsEnabled }).widgets_enabled
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, [status]);

  const apiActivityMode = feedMode === "following" ? "following" : "all";

  const loadActivity = useCallback(() => {
    void (async () => {
      try {
        const res = await fetch(
          `/api/activity?mode=${encodeURIComponent(apiActivityMode)}`
        );
        const data: unknown = await res.json();
        if (!Array.isArray(data)) {
          setActivity([]);
          return;
        }
        const parsed: ActivityItem[] = [];
        for (const row of data) {
          if (row == null || typeof row !== "object") continue;
          const o = row as Record<string, unknown>;
          if (o.type !== "win" && o.type !== "call") continue;
          const text = typeof o.text === "string" ? o.text.trim() : "";
          if (!text) continue;
          const link_chart =
            o.link_chart != null &&
            typeof o.link_chart === "string" &&
            o.link_chart.trim() !== ""
              ? o.link_chart.trim()
              : null;
          const link_post =
            o.link_post != null &&
            typeof o.link_post === "string" &&
            o.link_post.trim() !== ""
              ? o.link_post.trim()
              : null;
          const multRaw = Number(o.multiple);
          const multiple = Number.isFinite(multRaw) ? multRaw : 0;
          const discordRaw = o.discordId;
          const discordId =
            typeof discordRaw === "string" && discordRaw.trim() !== ""
              ? discordRaw.trim()
              : "";
          const usernameRaw = o.username;
          const username =
            typeof usernameRaw === "string" && usernameRaw.trim() !== ""
              ? usernameRaw.trim()
              : "";
          const dnRaw = o.displayName ?? o.display_name;
          const displayName =
            typeof dnRaw === "string" && dnRaw.trim() !== ""
              ? dnRaw.trim()
              : username;
          const uavRaw = o.userAvatarUrl ?? o.user_avatar_url;
          const userAvatarUrl =
            typeof uavRaw === "string" && uavRaw.trim() !== ""
              ? uavRaw.trim()
              : null;
          const imgRaw = o.tokenImageUrl ?? o.token_image_url;
          const tokenImageUrl =
            typeof imgRaw === "string" && imgRaw.trim() !== ""
              ? imgRaw.trim()
              : null;
          parsed.push({
            type: o.type,
            text,
            username,
            displayName,
            userAvatarUrl,
            time: o.time,
            link_chart,
            link_post,
            multiple,
            discordId,
            tokenImageUrl,
          });
        }

        const uid = session?.user?.id?.trim() ?? "";
        const notificationFilter =
          uid && apiActivityMode === "all"
            ? await fetchNotificationFilter(uid)
            : null;

        setActivity((prev) => {
          if (apiActivityMode === "all") {
            if (activitySourceModeRef.current === "all") {
              processActivityNotifications(
                prev,
                parsed,
                addNotification,
                lastSeenActivityKeysRef,
                notificationFilter
              );
            } else {
              for (const item of parsed) {
                lastSeenActivityKeysRef.current.add(activityItemDedupeKey(item));
              }
            }
            activitySourceModeRef.current = "all";
          } else {
            activitySourceModeRef.current = "following";
          }
          return parsed;
        });
      } catch {
        setActivity([]);
      } finally {
        setLoadingActivity(false);
      }
    })();
  }, [addNotification, apiActivityMode, session?.user?.id]);

  const nowMs = Date.now();

  useEffect(() => {
    if (!session?.user?.id?.trim()) return;

    let cancelled = false;
    if (stats === null) setStatsLoading(true);
    setStatsRefreshing(true);

    fetch("/api/me/stats")
      .then((res) => res.json())
      .then((json: unknown) => {
        if (cancelled) return;
        if (
          json &&
          typeof json === "object" &&
          !("error" in json) &&
          typeof (json as MeStats).avgX === "number" &&
          typeof (json as MeStats).medianX === "number" &&
          typeof (json as MeStats).winRate === "number" &&
          typeof (json as MeStats).callsToday === "number" &&
          typeof (json as MeStats).bestX30d === "number" &&
          typeof (json as MeStats).hitRate2x30d === "number" &&
          typeof (json as MeStats).totalCalls === "number"
        ) {
          const o = json as MeStats;
          const callsPriorRollingDay =
            typeof o.callsPriorRollingDay === "number"
              ? o.callsPriorRollingDay
              : 0;
          const activeDaysStreak =
            typeof o.activeDaysStreak === "number" ? o.activeDaysStreak : 0;
          const medianX = typeof o.medianX === "number" ? o.medianX : 0;
          const bestX30d = typeof o.bestX30d === "number" ? o.bestX30d : 0;
          const hitRate2x30d =
            typeof o.hitRate2x30d === "number" ? o.hitRate2x30d : 0;
          setStats({
            ...o,
            medianX,
            bestX30d,
            hitRate2x30d,
            callsPriorRollingDay,
            activeDaysStreak,
          });
        } else {
          setStats({
            avgX: 0,
            medianX: 0,
            winRate: 0,
            callsToday: 0,
            callsPriorRollingDay: 0,
            activeDaysStreak: 0,
            bestX30d: 0,
            hitRate2x30d: 0,
            totalCalls: 0,
          });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setStats({
            avgX: 0,
            medianX: 0,
            winRate: 0,
            callsToday: 0,
            callsPriorRollingDay: 0,
            activeDaysStreak: 0,
            bestX30d: 0,
            hitRate2x30d: 0,
            totalCalls: 0,
          });
        }
      })
      .finally(() => {
        if (!cancelled) {
          setStatsLoading(false);
          setStatsRefreshing(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [session?.user?.id, homeDataRefreshNonce, stats]);

  useEffect(() => {
    if (!session?.user?.id?.trim()) {
      setCallsLoading(false);
      setRecentCalls([]);
      return;
    }

    let cancelled = false;
    setCallsLoading(true);

    fetch("/api/me/recent-calls")
      .then((res) => res.json())
      .then((data: unknown) => {
        if (cancelled) return;
        if (Array.isArray(data)) {
          const parsed: RecentCallRow[] = [];
          for (const row of data) {
            if (row == null || typeof row !== "object") continue;
            const o = row as Record<string, unknown>;
            const token =
              typeof o.token === "string" ? o.token : String(o.token ?? "");
            const multiple = Number(o.multiple);
            if (!Number.isFinite(multiple)) continue;
            const tokenName =
              typeof o.tokenName === "string" && o.tokenName.trim()
                ? o.tokenName.trim()
                : null;
            const tokenTicker =
              typeof o.tokenTicker === "string" && o.tokenTicker.trim()
                ? o.tokenTicker.trim()
                : null;
            const mcRaw = o.callMarketCapUsd;
            const mcNum =
              typeof mcRaw === "number" ? mcRaw : Number(mcRaw ?? NaN);
            const imgRaw = o.tokenImageUrl ?? o.token_image_url;
            const tokenImageUrl =
              typeof imgRaw === "string" && imgRaw.trim()
                ? imgRaw.trim()
                : null;
            parsed.push({
              token: token || "Unknown",
              multiple,
              time: o.time,
              excludedFromStats: o.excludedFromStats === true,
              tokenName,
              tokenTicker,
              callMarketCapUsd:
                Number.isFinite(mcNum) && mcNum > 0 ? mcNum : null,
              tokenImageUrl,
            });
          }
          setRecentCalls(parsed);
        } else {
          setRecentCalls([]);
        }
      })
      .catch(() => {
        if (!cancelled) setRecentCalls([]);
      })
      .finally(() => {
        if (!cancelled) setCallsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [session?.user?.id, homeDataRefreshNonce]);

  useEffect(() => {
    if (!session?.user?.id?.trim()) {
      setWatchlistPrivate([]);
      setWatchlistPublic([]);
      setWatchlistUpdatedAt(null);
      setWatchlistLoading(false);
      return;
    }

    // refresh after closing the add-to-watchlist modal
    if (addWatchlistOpen) return;

    let cancelled = false;
    setWatchlistLoading(true);
    fetch("/api/me/watchlist", { credentials: "same-origin" })
      .then((res) => res.json().then((json) => ({ ok: res.ok, json })))
      .then(({ ok, json }) => {
        if (cancelled) return;
        if (!ok || !json || typeof json !== "object") {
          setWatchlistPrivate([]);
          setWatchlistPublic([]);
          return;
        }
        const privRaw = (json as any).private;
        const pubRaw = (json as any).public;
        setWatchlistPrivate(Array.isArray(privRaw) ? (privRaw as string[]).filter(Boolean) : []);
        setWatchlistPublic(Array.isArray(pubRaw) ? (pubRaw as string[]).filter(Boolean) : []);
        setWatchlistUpdatedAt(Date.now());
      })
      .catch(() => {
        if (!cancelled) {
          setWatchlistPrivate([]);
          setWatchlistPublic([]);
        }
      })
      .finally(() => {
        if (!cancelled) setWatchlistLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [addWatchlistOpen, session?.user?.id]);

  useEffect(() => {
    if (!session?.user?.id?.trim()) {
      setTopPerformersToday([]);
      setTopPerformersLoading(false);
      return;
    }

    let cancelled = false;
    setTopPerformersLoading(true);

    fetch("/api/leaderboard?type=user&period=today")
      .then((res) => (res.ok ? res.json() : null))
      .then((json: unknown) => {
        if (cancelled || !Array.isArray(json)) {
          if (!cancelled) setTopPerformersToday([]);
          return;
        }
        const parsed: TopPerformerTodayRow[] = [];
        for (const item of json) {
          if (!item || typeof item !== "object") continue;
          const o = item as Record<string, unknown>;
          const discordId = String(o.discordId ?? o.discord_id ?? "").trim();
          const username = String(o.username ?? "").trim();
          if (!discordId || !username) continue;
          const rank =
            typeof o.rank === "number" ? o.rank : Number(o.rank) || 0;
          const avgX =
            typeof o.avgX === "number" ? o.avgX : Number(o.avgX) || 0;
          const bestMultiple =
            typeof o.bestMultiple === "number"
              ? o.bestMultiple
              : Number(o.bestMultiple) || 0;
          if (!Number.isFinite(avgX)) continue;
          parsed.push({
            rank,
            discordId,
            username,
            avgX,
            bestMultiple: Number.isFinite(bestMultiple) ? bestMultiple : avgX,
          });
        }
        // Top 3 in API order only — no client sort; row colors use `.map` index, not `row.rank`.
        if (!cancelled) setTopPerformersToday(parsed.slice(0, 3));
      })
      .catch(() => {
        if (!cancelled) setTopPerformersToday([]);
      })
      .finally(() => {
        if (!cancelled) setTopPerformersLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [session?.user?.id, homeDataRefreshNonce]);

  useEffect(() => {
    const ids = new Set<string>();
    const selfId = session?.user?.id?.trim() ?? "";
    if (selfId) ids.add(selfId);
    for (const r of topPerformersToday) {
      const id = r.discordId?.trim();
      if (id) ids.add(id);
    }
    for (const a of activity) {
      const id = a.discordId?.trim();
      if (id) ids.add(id);
    }
    const userIds = Array.from(ids);
    if (userIds.length === 0) {
      setBadgesByUser({});
      return;
    }
    let cancelled = false;
    fetch("/api/badges", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userIds }),
    })
      .then((res) => res.json().then((json) => ({ ok: res.ok, json })))
      .then(({ ok, json }) => {
        if (cancelled || !ok || !json || typeof json !== "object") return;
        setBadgesByUser(json as Record<string, string[]>);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [session?.user?.id, topPerformersToday, activity]);

  useEffect(() => {
    if (!session?.user?.id?.trim()) {
      setYourWeekRank(null);
      setYourRankLoading(false);
      return;
    }

    let cancelled = false;
    setYourRankLoading(true);

    fetch("/api/me/leaderboard-rank")
      .then((res) => (res.ok ? res.json() : null))
      .then((json: unknown) => {
        if (cancelled || !json || typeof json !== "object") {
          if (!cancelled) setYourWeekRank(null);
          return;
        }
        const o = json as Record<string, unknown>;
        const rankRaw = o.rank;
        const rank =
          rankRaw === null || rankRaw === undefined
            ? null
            : typeof rankRaw === "number"
              ? rankRaw
              : Number(rankRaw);
        if (!cancelled) {
          setYourWeekRank(
            rank !== null && Number.isFinite(rank) && rank > 0 ? rank : null
          );
        }
      })
      .catch(() => {
        if (!cancelled) setYourWeekRank(null);
      })
      .finally(() => {
        if (!cancelled) setYourRankLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [session?.user?.id, homeDataRefreshNonce]);

  useEffect(() => {
    loadActivity();
    const interval = setInterval(loadActivity, 8000);
    return () => clearInterval(interval);
  }, [loadActivity]);

  const referralUrl =
    session?.user?.id != null && session.user.id !== ""
      ? `${REF_BASE}/${session.user.id}`
      : "";

  const notifyComingSoon = useCallback(
    (label: string) => {
      addNotification({
        id: crypto.randomUUID(),
        text: `${label} is coming soon`,
        type: "call",
        createdAt: Date.now(),
        priority: "low",
      });
    },
    [addNotification]
  );


  const handleCopy = useCallback(async () => {
    if (!referralUrl) return;
    try {
      await navigator.clipboard.writeText(referralUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }, [referralUrl]);

  const handleSubmitCall = useCallback(async () => {
    if (submitCallSubmitting) return;
    const ca = submitCallValue.trim();
    if (!ca) return;

    setSubmitCallSubmitting(true);
    setSubmitCallFeedback(null);
    try {
      const res = await submitCall(ca);
      if (res.ok) {
        const data = res.data as Record<string, unknown> | null;
        const alreadyCalled =
          !!data &&
          typeof data === "object" &&
          (data as any).alreadyCalled === true;

        if (alreadyCalled) {
          setSubmitCallFeedback("already_exists");
          addNotification({
            id: crypto.randomUUID(),
            text: "This coin has already been called.",
            type: "call",
            createdAt: Date.now(),
            priority: "low",
          });
          window.setTimeout(() => {
            setSubmitCallOpen(false);
            setSubmitCallValue("");
            setSubmitCallFeedback(null);
          }, 600);
          return;
        }

        setSubmitCallFeedback("success");
        const sm = data?.statsMirror as Record<string, unknown> | undefined;
        if (sm && sm.ok === false) {
          const reason =
            typeof sm.reason === "string" ? sm.reason : "";
          const errText =
            typeof sm.error === "string" ? sm.error : "";
          const msg =
            reason === "missing_supabase_service_role"
              ? "Call posted, but stats did not sync: set SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY on the bot VPS (same project as the dashboard)."
              : `Call posted, but stats did not sync${errText ? `: ${errText}` : reason ? ` (${reason})` : ""}.`;
          addNotification({
            id: crypto.randomUUID(),
            text: msg,
            type: "call",
            createdAt: Date.now(),
            priority: "high",
          });
        }
        setHomeDataRefreshNonce((n) => n + 1);
        loadActivity();
        window.setTimeout(() => {
          setSubmitCallOpen(false);
          setSubmitCallValue("");
          setSubmitCallFeedback(null);
        }, 900);
        return;
      }

      const msg =
        res.data && typeof res.data === "object" && "error" in res.data
          ? String((res.data as any).error)
          : "Failed to submit call";
      const normalized = msg.toLowerCase();
      if (res.status === 409 || normalized.includes("already")) {
        setSubmitCallFeedback("already_exists");
      } else {
        addNotification({
          id: crypto.randomUUID(),
          text: msg || "Failed to submit call",
          type: "call",
          createdAt: Date.now(),
          priority: "low",
        });
      }
    } catch (err) {
      const msg =
        err && typeof err === "object" && "message" in err
          ? String((err as any).message)
          : "Failed to submit call";
      addNotification({
        id: crypto.randomUUID(),
        text: msg || "Failed to submit call",
        type: "call",
        createdAt: Date.now(),
        priority: "low",
      });
    } finally {
      setSubmitCallSubmitting(false);
    }
  }, [addNotification, loadActivity, submitCallSubmitting, submitCallValue]);

  if (status === "loading") {
    return (
      <div className="flex min-h-[calc(100vh-3rem)] flex-col items-center justify-center text-zinc-400">
        <div className="flex flex-col items-center gap-4">
          <div
            className="h-9 w-9 animate-spin rounded-full border-2 border-zinc-600 border-t-sky-500"
            aria-hidden
          />
          <p className="text-sm">Loading dashboard…</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <UnauthedLanding onLogin={() => discordSignInSafe()} />
    );
  }

  function streakBadge(days: number): { emoji: string; className?: string } {
    if (days <= 0) return { emoji: "🥶" };
    if (days === 1) return { emoji: "👌" };
    if (days === 2) return { emoji: "🔥", className: "dashboard-fire-emoji" };
    if (days === 3) return { emoji: "⚡" };
    if (days >= 7 && days < 14) return { emoji: "🚀" };
    if (days >= 14 && days < 30) return { emoji: "💎" };
    if (days >= 30) return { emoji: "👑" };
    return { emoji: "🔥", className: "dashboard-fire-emoji" };
  }

  const streakDays = stats?.activeDaysStreak;
  const streakBadgeUi = streakBadge(streakDays ?? 0);
  const streakValue =
    stats === null ? (
      <div className="text-base font-semibold text-zinc-500">—</div>
    ) : (streakDays ?? 0) > 0 ? (
      <div>
        <div className="inline-flex items-center gap-2 text-base font-semibold text-zinc-100">
          <span
            className={`${streakBadgeUi.className ?? ""} text-lg leading-none`}
            aria-hidden
          >
            {streakBadgeUi.emoji}
          </span>
          <span>{streakDays} day streak</span>
        </div>
        <div className="mt-1 text-xs text-zinc-500">Active days</div>
      </div>
    ) : (
      <div>
        <div className="inline-flex items-center gap-2 text-base font-semibold text-zinc-300">
          <span
            className={`${streakBadgeUi.className ?? ""} text-lg leading-none`}
            aria-hidden
          >
            {streakBadgeUi.emoji}
          </span>
          <span>No streak yet</span>
        </div>
        <div className="mt-1 text-xs text-zinc-500">Call today to start one</div>
      </div>
    );

  // TODO: add badges next to usernames
  // TODO: allow widget resizing / layout control
  // TODO: move referral link under banner

  const showRankWidget = widgetEnabled(widgets, "rank");
  const showTrendingWidget = widgetEnabled(widgets, "trending");

  return (
    <div className="mx-auto max-w-[1200px] px-1 sm:px-0" data-tutorial="dashboard.tutorialWelcome">
      <div className="space-y-8" data-tutorial="dashboard.pageIntro">
      <div className="mb-8" data-tutorial="dashboard.performanceChart">
        <PerformanceChart refreshNonce={homeDataRefreshNonce} />
      </div>

      <section className="mb-8 space-y-4" data-tutorial="dashboard.personalStats">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-semibold tracking-tight text-zinc-100">
              Personal Stats
            </h2>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--accent)]/25 bg-[color:var(--accent)]/10 px-2 py-0.5 text-[11px] font-semibold tracking-wide text-[color:var(--accent)]">
              <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--accent)]" aria-hidden />
              LIVE
            </span>
          </div>
          <p className="mt-0.5 text-xs text-zinc-600">
            Key metrics from your recent activity.
          </p>
        </div>
        <div
          className={`rounded-xl border border-zinc-900 bg-zinc-950/40 p-4 ${smoothClass(
            statsRefreshing || statsLoading
          )}`}
        >
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,2fr)_auto_minmax(0,1fr)] lg:items-stretch">
            <div className="grid min-w-0 grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              <div className="rounded-xl border border-[#1a1a1a] bg-gradient-to-b from-zinc-900/55 to-zinc-900/25 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                <div className="text-xs font-semibold tracking-wide text-zinc-300">
                  AVG X
                </div>
                <div className="mt-2 text-2xl font-bold tabular-nums tracking-tight text-[color:var(--accent)]">
                  {stats === null ? "—" : `${stats.avgX.toFixed(1)}x`}
                </div>
                <div className="mt-1 text-xs text-zinc-500">
                  Mean ATH multiple since your calls (peak ÷ entry MC)
                </div>
              </div>

              <div className="rounded-xl border border-[#1a1a1a] bg-gradient-to-b from-zinc-900/55 to-zinc-900/25 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                <div className="text-xs font-semibold tracking-wide text-zinc-300">
                  WIN RATE
                </div>
                <div className="mt-2 text-2xl font-bold tabular-nums tracking-tight text-[color:var(--accent)]">
                  {stats === null ? "—" : `${stats.winRate.toFixed(0)}%`}
                </div>
              </div>

              <div className="rounded-xl border border-[#1a1a1a] bg-gradient-to-b from-zinc-900/55 to-zinc-900/25 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                <div className="text-xs font-semibold tracking-wide text-zinc-300">
                  STREAK
                </div>
                <div className="mt-2">
                  {streakValue}
                </div>
              </div>

              <div className="rounded-xl border border-[#1a1a1a] bg-gradient-to-b from-zinc-900/55 to-zinc-900/25 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                <div className="text-xs font-semibold tracking-wide text-zinc-300">
                  TOTAL CALLS
                </div>
                <div className="mt-2 text-2xl font-bold tabular-nums text-[color:var(--accent)]">
                  {stats === null ? "—" : stats.totalCalls.toLocaleString("en-US")}
                </div>
                <div className="mt-1 text-xs text-zinc-500">All time</div>
              </div>

              <div className="rounded-xl border border-[#1a1a1a] bg-gradient-to-b from-zinc-900/55 to-zinc-900/25 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                <div className="text-xs font-semibold tracking-wide text-zinc-300">
                  MEDIAN X
                </div>
                <div className="mt-2 text-2xl font-bold tabular-nums text-[color:var(--accent)]">
                  {stats === null || (stats.medianX ?? 0) <= 0
                    ? "—"
                    : `${(stats.medianX ?? 0).toFixed(1)}x`}
                </div>
              </div>

              <div className="rounded-xl border border-[#1a1a1a] bg-gradient-to-b from-zinc-900/55 to-zinc-900/25 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                <div className="text-xs font-semibold tracking-wide text-zinc-300">
                  2X HIT (30D)
                </div>
                <div className="mt-2 text-2xl font-bold tabular-nums text-[color:var(--accent)]">
                  {stats === null || (stats.bestX30d ?? 0) <= 0
                    ? "—"
                    : `${Math.round(stats.hitRate2x30d ?? 0)}%`}
                </div>
              </div>

              <div className="rounded-xl border border-[#1a1a1a] bg-gradient-to-b from-zinc-900/55 to-zinc-900/25 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                <div className="text-xs font-semibold tracking-wide text-zinc-300">
                  BEST X (30D)
                </div>
                <div className="mt-2 text-2xl font-bold tabular-nums text-[color:var(--accent)]">
                  {stats === null || (stats.bestX30d ?? 0) <= 0
                    ? "—"
                    : `${(stats.bestX30d ?? 0).toFixed(1)}x`}
                </div>
              </div>

              <div className="rounded-xl border border-[#1a1a1a] bg-gradient-to-b from-zinc-900/55 to-zinc-900/25 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                <div className="text-xs font-semibold tracking-wide text-zinc-300">
                  LAST CALL
                </div>
                <div
                  className="mt-2 min-w-0 truncate text-sm font-medium text-zinc-200"
                  title={
                    callsLoading || recentCalls.length === 0
                      ? undefined
                      : homeLastCallHeadline(recentCalls[0])
                  }
                >
                  {callsLoading || recentCalls.length === 0
                    ? "—"
                    : homeLastCallHeadline(recentCalls[0])}
                </div>
                <div className="mt-1 text-2xl font-bold tabular-nums text-[color:var(--accent)]">
                  {callsLoading || recentCalls.length === 0 ? "—" : `${recentCalls[0].multiple.toFixed(1)}x`}
                </div>
                <div className="mt-1 text-xs text-zinc-500">
                  {callsLoading || recentCalls.length === 0
                    ? "Waiting for your first call"
                    : formatJoinedAt(callTimeMs(recentCalls[0].time), nowMs)}
                </div>
              </div>
            </div>

            <>
              <div className="mx-2 hidden w-px shrink-0 bg-zinc-800 lg:block" aria-hidden />
              <div className="flex min-h-0 flex-col gap-4">
                {showRankWidget ? (
                  <RankPanel
                    yourRankLoading={yourRankLoading}
                    yourWeekRank={yourWeekRank}
                    stats={stats}
                  />
                ) : null}
                <PanelCard
                  title="Calls today"
                  titleClassName="normal-case"
                  className="flex w-full flex-col"
                >
                  <div className="mt-2 text-4xl font-bold tabular-nums tracking-tight text-zinc-50">
                    {stats === null ? "—" : stats.callsToday}
                  </div>
                  <p className="mt-1.5 text-xs leading-snug">
                    {callsTodayDeltaLabel(stats)}
                  </p>
                </PanelCard>
              </div>
            </>
          </div>
        </div>
      </section>

      <div className="mb-6 grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 flex flex-col gap-3">
          <div data-tutorial="dashboard.activityFeed">
          {widgetEnabled(widgets, "activity") && (
            <div className="min-h-[420px]">
              <ActivityFeedPanel
                feedMode={feedMode}
                setFeedMode={setFeedMode}
                loadingActivity={loadingActivity}
                activity={activity}
                followingIds={followingIds}
                setFollowing={setFollowing}
                nowMs={nowMs}
                setSelectedActivity={setSelectedActivity}
                badgesByUser={badgesByUser}
                viewerId={session.user.id}
                viewerName={session.user.name}
              />
            </div>
          )}
          </div>

          <div data-tutorial="dashboard.topPerformers">
          {widgetEnabled(widgets, "top_performers") && (
            <TopPerformersPanel
              topPerformersLoading={topPerformersLoading}
              topPerformersToday={topPerformersToday}
              viewerId={session.user.id}
              viewerName={session.user.name}
              badgesByUser={badgesByUser}
            />
          )}
          </div>

          <div data-tutorial="dashboard.socialFeed">
          <SocialsFeedPanel />
          </div>

          <div data-tutorial="dashboard.trending">
          {showTrendingWidget ? <TrendingPanel /> : null}
          </div>
        </div>

        <div className="flex flex-col gap-4" data-tutorial="dashboard.quickActions">
          {widgetEnabled(widgets, "quick_actions") && (
            <PanelCard title="Quick Actions">
              <div className="mt-3 space-y-3">
                <button
                  type="button"
                  onClick={() => {
                    setSubmitCallFeedback(null);
                    setSubmitCallOpen(true);
                  }}
                  data-tutorial="dashboard.quickActions.submitCall"
                  className="w-full rounded-xl bg-[color:var(--accent)] px-4 py-3 text-base font-semibold text-black shadow-lg shadow-black/40 transition hover:bg-green-500 focus:outline-none focus:ring-2 focus:ring-[color:var(--accent)]/30"
                >
                  Submit Call
                </button>

                <div className="grid grid-cols-2 gap-2">
                  <Link
                    href={userProfileHref({
                      discordId: session.user.id,
                      displayName: session.user.name,
                    })}
                    data-tutorial="dashboard.quickActions.myProfile"
                    className="flex items-center justify-center rounded-lg border border-[#1a1a1a] bg-[#0a0a0a] px-3 py-2 text-center text-sm font-semibold text-zinc-100 transition hover:border-[#2a2a2a] hover:bg-zinc-900/30 focus:outline-none focus:ring-2 focus:ring-[color:var(--accent)]/20"
                  >
                    My Profile
                  </Link>
                  <button
                    type="button"
                    onClick={() => setAddWatchlistOpen(true)}
                    data-tutorial="dashboard.quickActions.watchlist"
                    className="flex items-center justify-center rounded-lg border border-[#1a1a1a] bg-[#0a0a0a] px-3 py-2 text-center text-sm font-semibold text-zinc-100 transition hover:border-[#2a2a2a] hover:bg-zinc-900/30 focus:outline-none focus:ring-2 focus:ring-[color:var(--accent)]/20"
                  >
                    Watchlist
                  </button>
                  <button
                    type="button"
                    onClick={() => notifyComingSoon("Create Alert")}
                    className="rounded-lg border border-[#1a1a1a] bg-[#0a0a0a] px-3 py-2 text-sm font-semibold text-zinc-100 transition hover:border-[#2a2a2a] hover:bg-zinc-900/30 focus:outline-none focus:ring-2 focus:ring-[color:var(--accent)]/20"
                  >
                    Create Alert
                  </button>
                  <button
                    type="button"
                    onClick={() => notifyComingSoon("Following")}
                    className="rounded-lg border border-[#1a1a1a] bg-[#0a0a0a] px-3 py-2 text-sm font-semibold text-zinc-100 transition hover:border-[#2a2a2a] hover:bg-zinc-900/30 focus:outline-none focus:ring-2 focus:ring-[color:var(--accent)]/20"
                  >
                    Following
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleCopy}
                  disabled={!referralUrl}
                  className="w-full rounded-lg border border-[#1a1a1a] bg-[#0a0a0a] px-4 py-2.5 text-sm font-semibold text-zinc-100 transition hover:border-[#2a2a2a] hover:bg-zinc-900/30 focus:outline-none focus:ring-2 focus:ring-[color:var(--accent)]/20 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {copied ? "Referral Link Copied" : "Copy Referral Link"}
                </button>
              </div>
            </PanelCard>
          )}

          <PanelCard title="Watchlist" titleClassName="normal-case" data-tutorial="dashboard.homeWatchlist">
            <div className="mt-2 flex items-center justify-between gap-3 text-[11px] text-zinc-500">
              <span className="tabular-nums">
                Saved{" "}
                <span className="font-semibold text-zinc-300">
                  {watchlistLoading
                    ? "—"
                    : (watchlistPrivate.length + watchlistPublic.length).toLocaleString("en-US")}
                </span>
              </span>
              <span>
                Updated{" "}
                <span className="font-medium tabular-nums text-zinc-300">
                  {watchlistUpdatedAt == null ? "—" : formatJoinedAt(watchlistUpdatedAt, nowMs)}
                </span>
              </span>
            </div>
            <div className="mt-2 rounded-xl border border-zinc-900 bg-zinc-950/40 p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
              {watchlistLoading ? (
                <div className="space-y-2 p-1">
                  <div className="h-9 animate-pulse rounded-lg bg-zinc-900/35" />
                  <div className="h-9 animate-pulse rounded-lg bg-zinc-900/25" />
                  <div className="h-9 animate-pulse rounded-lg bg-zinc-900/20" />
                </div>
              ) : watchlistPrivate.length + watchlistPublic.length === 0 ? (
                <div className="flex items-center justify-center px-3 py-10">
                  <div className="text-center">
                    <p className="text-sm font-semibold text-zinc-200">No contracts yet</p>
                    <p className="mt-1 text-xs text-zinc-500">
                      Add contract addresses to build your list.
                    </p>
                  </div>
                </div>
              ) : (
                <ul className="space-y-1">
                  {[...watchlistPublic, ...watchlistPrivate].slice(0, 3).map((ca) => (
                    <li key={ca}>
                      <a
                        href={`https://dexscreener.com/solana/${encodeURIComponent(ca)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="group flex items-center justify-between gap-3 rounded-lg border border-[#1a1a1a] bg-zinc-900/20 px-3 py-2 text-left transition-colors hover:bg-zinc-900/35 focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]/25"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-zinc-100">
                              {shortenCa(ca)}
                            </span>
                            <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-semibold text-zinc-400">
                              CA
                            </span>
                          </div>
                          <div className="mt-0.5 font-mono text-[11px] text-zinc-500">
                            {ca}
                          </div>
                        </div>
                        <span className="ml-2 hidden text-xs text-zinc-500 group-hover:inline">
                          ↗
                        </span>
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="mt-3 flex items-center justify-between">
              <p className="text-xs text-zinc-500">Your saved contracts</p>
              <Link
                href="/watchlist"
                className="text-xs font-semibold text-zinc-200 hover:text-white"
              >
                Open →
              </Link>
            </div>
          </PanelCard>

          {String(process.env.NEXT_PUBLIC_VOICE_LOBBIES_ENABLED || "") === "1" ? (
            <VoiceLobbiesShell helpTier={helpTier} />
          ) : null}

          {(helpTier === "mod" || helpTier === "admin") && (
            <div data-tutorial="dashboard.modQueue">
              <ModQueueHomePanel />
            </div>
          )}

          <div data-tutorial="dashboard.discordChat">
          <DashboardChatPanel
            showModTab={
              (helpTier === "mod" || helpTier === "admin") && modChatConfigured
            }
            modStaffSetupHint={
              (helpTier === "mod" || helpTier === "admin") && !modChatConfigured
            }
          />
          </div>

          <div data-tutorial="dashboard.dailyLeaderboard">
          {widgetEnabled(widgets, "live_tracked_calls") && <DailyLeaderboardPanel />}
          </div>

          <div data-tutorial="dashboard.homeRecentCalls">
          {widgetEnabled(widgets, "recent_calls") ? (
            <PanelCard title="Recent calls" titleClassName="normal-case">
              <p className="mt-2 text-xs text-zinc-500">
                Your last few verified calls.
              </p>
              {callsLoading ? (
                <div className="flex min-h-[88px] items-center justify-center py-6">
                  <p className="text-sm text-zinc-500">Loading calls...</p>
                </div>
              ) : recentCalls.length === 0 ? (
                <div className="flex min-h-[88px] items-center justify-center py-6">
                  <p className="text-sm text-zinc-500">No calls yet</p>
                </div>
              ) : (
                <ul className="mt-3 space-y-0 divide-y divide-zinc-800/50 text-sm">
                  {recentCalls.slice(0, 6).map((call, i) => (
                    <li
                      key={`${call.token}-${String(call.time)}-${i}`}
                      className="flex flex-wrap items-center justify-between gap-2 py-2.5 first:pt-1.5 text-zinc-300"
                    >
                      <span
                        className="min-w-0 font-medium text-zinc-100"
                        title={homeRecentCallSummary(call)}
                      >
                        <span className="flex min-w-0 items-start gap-2">
                          {call.tokenImageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={call.tokenImageUrl}
                              alt=""
                              className="mt-0.5 h-7 w-7 shrink-0 rounded-md border border-zinc-700/50 object-cover"
                              loading="lazy"
                              referrerPolicy="no-referrer"
                            />
                          ) : null}
                          <span className="min-w-0 flex-1 truncate text-zinc-100">
                            {homeRecentCallSummary(call)}
                          </span>
                        </span>
                        <span className="mt-0.5 inline-flex flex-wrap items-center gap-1.5 text-xs text-zinc-500">
                          <span
                            className={`font-semibold tabular-nums ${multipleClass(
                              call.multiple
                            )}`}
                          >
                            {call.multiple.toFixed(1)}x
                          </span>
                          {call.excludedFromStats ? (
                            <span className="inline-flex items-center rounded-full border border-red-500/30 bg-red-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-200">
                              Excluded
                            </span>
                          ) : null}
                        </span>
                      </span>
                      <span className="ml-auto flex shrink-0 items-center gap-2 text-zinc-500">
                        <button
                          type="button"
                          onClick={() =>
                            openTokenChart({
                              chain: "solana",
                              contractAddress: call.token,
                              tokenTicker: call.tokenTicker,
                              tokenName: call.tokenName,
                              tokenImageUrl: call.tokenImageUrl ?? null,
                            })
                          }
                          className="rounded border border-zinc-700/80 bg-zinc-900/50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-200/90 transition hover:border-emerald-500/40 hover:bg-emerald-500/10"
                          title="Live chart (TradingView)"
                        >
                          Chart
                        </button>
                        {formatJoinedAt(callTimeMs(call.time), nowMs)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-3 flex items-center justify-between">
                <p className="text-xs text-zinc-500">See the full list</p>
                <Link
                  href="/calls"
                  className="text-xs font-semibold text-zinc-200 hover:text-white"
                >
                  Open call log →
                </Link>
              </div>
            </PanelCard>
          ) : null}
          </div>

          {widgetEnabled(widgets, "hot_now") && (
            <OpportunitiesPanel />
          )}
        </div>
      </div>
      </div>

      <ActivityPopup
        item={
          selectedActivity
            ? {
                text: selectedActivity.text,
                link_chart: selectedActivity.link_chart,
                link_post: selectedActivity.link_post,
              }
            : null
        }
        onClose={() => setSelectedActivity(null)}
      />

      <AddToWatchlistModal
        open={addWatchlistOpen}
        onClose={() => setAddWatchlistOpen(false)}
      />

      {submitCallOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-6"
          role="dialog"
          aria-modal="true"
          aria-label="Submit call"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setSubmitCallOpen(false);
          }}
        >
          <div className="w-full max-w-md rounded-xl border border-[#1a1a1a] bg-[#0a0a0a] p-4 shadow-xl shadow-black/50 backdrop-blur">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-zinc-100">
                  Submit Call
                </h3>
                <p className="mt-1 text-xs text-zinc-500">
                  Paste a contract address to submit a new call.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSubmitCallOpen(false)}
                className="rounded-md border border-[#1a1a1a] bg-[#0a0a0a] px-2 py-1 text-xs text-zinc-300 hover:bg-[#0a0a0a]"
                aria-label="Close"
                disabled={submitCallSubmitting}
              >
                Esc
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <div className="flex items-stretch gap-2">
                <input
                  type="text"
                  value={submitCallValue}
                  onChange={(e) => setSubmitCallValue(e.target.value)}
                  placeholder="Enter contract address"
                  disabled={submitCallSubmitting}
                  className="min-w-0 flex-1 rounded-lg border border-[#1a1a1a] bg-[#050505] px-3 py-2 text-sm text-zinc-200 outline-none ring-[color:var(--accent)]/20 focus:ring-2 disabled:opacity-60"
                />
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      const t = await navigator.clipboard.readText();
                      if (typeof t === "string") setSubmitCallValue(t.trim());
                    } catch {
                      addNotification({
                        id: crypto.randomUUID(),
                        text: "Clipboard blocked — use Ctrl+V instead.",
                        type: "call",
                        createdAt: Date.now(),
                        priority: "low",
                      });
                    }
                  }}
                  disabled={submitCallSubmitting}
                  className="shrink-0 rounded-lg border border-[#1a1a1a] bg-[#0a0a0a] px-3 text-xs font-semibold text-zinc-200 transition hover:border-[#2a2a2a] hover:bg-zinc-900/30 focus:outline-none focus:ring-2 focus:ring-[color:var(--accent)]/20 disabled:opacity-60"
                >
                  Paste
                </button>
              </div>

              {submitCallFeedback ? (
                <p className="text-sm">
                  {submitCallFeedback === "success" ? (
                    <span className="text-[color:var(--accent)]">Call submitted</span>
                  ) : (
                    <span className="text-zinc-400">Already called</span>
                  )}
                </p>
              ) : null}

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setSubmitCallOpen(false)}
                  disabled={submitCallSubmitting}
                  className="rounded-md border border-[#1a1a1a] bg-[#0a0a0a] px-3 py-1.5 text-xs font-medium text-zinc-300 hover:bg-[#0a0a0a] disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSubmitCall}
                  disabled={submitCallSubmitting || submitCallValue.trim() === ""}
                  className="rounded-md bg-[color:var(--accent)] px-3 py-1.5 text-xs font-medium text-black shadow-lg shadow-black/40 transition hover:bg-green-500 disabled:opacity-60"
                >
                  {submitCallSubmitting ? "Submitting…" : "Submit"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
