"use client";

import type { WidgetsEnabled } from "@/app/api/dashboard-settings/route";
import {
  useNotifications,
  type NotificationPriority,
} from "@/app/contexts/NotificationsContext";
import { useTokenChartModal } from "@/app/contexts/TokenChartModalContext";
import { ActivityPopup, type ActivityPopupItem } from "./components/ActivityPopup";
import { AddToWatchlistModal } from "./components/AddToWatchlistModal";
import { DashboardAlertsModal } from "./components/DashboardAlertsModal";
import { ModQueueHomePanel } from "./components/ModQueueHomePanel";
import { DashboardChatPanel } from "./components/DashboardChatPanel";
import { HodlDashboardDock } from "./components/HodlDashboardDock";
import { PanelCard, CARD_HOVER } from "./components/PanelCard";
import { TokenCallThumb } from "@/components/TokenCallThumb";
import { FollowButton } from "./components/FollowButton";
import { UserBadgeIcons } from "./components/UserBadgeIcons";
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
import { parseOutsideActivityLineText } from "@/lib/outsideActivityFeedFormat";
import { useDashboardHelpRole } from "./hooks/useDashboardHelpRole";
import { userProfileHref } from "@/lib/userProfileHref";
import { resolveTokenAvatarUrl } from "@/lib/resolveTokenAvatarUrl";
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
import { terminalChrome, terminalPage, terminalSurface, terminalUi } from "@/lib/terminalDesignTokens";
import {
  SOCIAL_FEED_CATEGORY_OPTIONS,
  formatSocialFeedCategoryLabel,
  normalizeCategoryOther,
  parseSocialFeedCategorySlug,
  type SocialFeedCategorySlug,
} from "@/lib/socialFeedCategories";
import {
  normalizeSocialSourceHandleInput,
  socialSourceHandleHasName,
} from "@/lib/socialSourceHandleInput";

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
  /** Ticker / short symbol (e.g. from pair base token). */
  symbol: string;
  /** Full token name when the API provides it (Dexscreener-style `baseToken.name`). */
  name?: string | null;
  mint: string;
  imageUrl?: string | null;
  priceUsd: number;
  marketCapUsd: number;
  changePct: number;
  liquidityUsd: number;
  volumeUsd: number;
  holders: number;
  source: "Dexscreener" | "Axiom" | "Gecko" | "GMGN";
  timeframe: "5m" | "1h" | "24h";
};

const TRENDING_TOKENS_ELITE_MOCK: TrendingTokenRow[] = [
  {
    symbol: "WIF",
    mint: "EKpQGSJtjMFqKZ9q8i7vNQkWQwGJcD3u3wqBzQk9sYtX",
    priceUsd: 2.41,
    marketCapUsd: 890_000_000,
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
    marketCapUsd: 1_400_000_000,
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
    marketCapUsd: 980_000_000,
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
    marketCapUsd: 520_000_000,
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
    marketCapUsd: 410_000_000,
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
    marketCapUsd: 420_000_000,
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
    marketCapUsd: 870_000_000,
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
    marketCapUsd: 490_000_000,
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
    marketCapUsd: 760_000_000,
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
    marketCapUsd: 310_000_000,
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
    marketCapUsd: 380_000_000,
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
    marketCapUsd: 250_000_000,
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

/** Row hover for Top Performers — border + shadow only (no scale / translate). */
const TOP_PERFORMER_ROW_INTERACTIVE =
  "cursor-pointer transition-[border-color,box-shadow] duration-150 hover:border-zinc-500/40 hover:shadow-md hover:shadow-black/25";

const PROFILE_LINK_CLASS =
  "text-[color:var(--accent)] hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]/30";

/** Matches `formatWinActivityLine` output so we can link the caller handle. */
const MILESTONE_ACTIVITY_LINE_RE =
  /^\$(\S+)\s+hit\s+([\d.]+)x\s+\(([^)]*)\)\s+-\s+Called by @(.+?)\s+at\s+(.+)$/i;

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
    row: "rounded-xl border border-zinc-800/90 bg-zinc-950 px-4 py-3",
    badge: "bg-zinc-950 text-zinc-500",
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
    ? "transition-opacity duration-300 ease-out opacity-85"
    : "transition-opacity duration-300 ease-out opacity-100";
}

function sameMeStats(a: MeStats | null, b: MeStats | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return (
    a.avgX === b.avgX &&
    a.medianX === b.medianX &&
    a.winRate === b.winRate &&
    a.callsToday === b.callsToday &&
    (a.callsPriorRollingDay ?? 0) === (b.callsPriorRollingDay ?? 0) &&
    (a.activeDaysStreak ?? 0) === (b.activeDaysStreak ?? 0) &&
    a.bestX30d === b.bestX30d &&
    a.hitRate2x30d === b.hitRate2x30d &&
    a.totalCalls === b.totalCalls
  );
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
  tokenImageUrl?: string | null;
  multiple: number;
  username: string;
  source: string;
  time: unknown;
};

type PublicTeasers = {
  week: {
    calls: number;
    avgX: number;
    /** Mean ATH× for `source === "bot"` in the same 7d window (null if none). */
    avgXBot?: number | null;
    /** Mean ATH× for non-bot calls (user / trusted_pro / etc.) in the same 7d window. */
    avgXUser?: number | null;
    topCalls: PublicTeaserCall[];
  };
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
  const weekAvgXBot = teasers?.week.avgXBot ?? null;
  const weekAvgXUser = teasers?.week.avgXUser ?? null;
  const topCalls = teasers?.week.topCalls ?? [];

  const formatTeaserAvgX = (v: number | null | undefined) => {
    if (v == null || !Number.isFinite(Number(v)) || Number(v) <= 0) return "—";
    return `${Number(v).toFixed(2)}×`;
  };

  return (
    <div className="relative min-h-[calc(100vh-3rem)] px-0 py-10">
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
              Log in with Discord to unlock My Call Log, Performance Lab, Watchlist, and pro-grade leaderboards.
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
                href="/membership"
                className="inline-flex items-center justify-center rounded-lg border border-zinc-800 bg-zinc-950/40 px-5 py-3 text-sm font-semibold text-zinc-200 transition hover:border-zinc-700 hover:bg-zinc-950/60"
              >
                Membership →
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
                {loading ? (
                  <p className="mt-2 text-lg font-bold tabular-nums text-zinc-500">—</p>
                ) : (
                  <div className="mt-2 space-y-2">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-wide text-violet-300/90">
                        Bot
                      </span>
                      <span className="text-lg font-bold tabular-nums text-violet-200">
                        {formatTeaserAvgX(weekAvgXBot)}
                      </span>
                    </div>
                    <div className="flex items-baseline justify-between gap-2 border-t border-zinc-800/50 pt-2">
                      <span className="text-[10px] font-bold uppercase tracking-wide text-emerald-300/90">
                        User
                      </span>
                      <span className="text-lg font-bold tabular-nums text-emerald-200">
                        {formatTeaserAvgX(weekAvgXUser)}
                      </span>
                    </div>
                  </div>
                )}
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
                  {topCalls.map((c, i) => {
                    const thumbSym =
                      c.tokenTicker?.trim().toUpperCase().slice(0, 14) ||
                      c.tokenName?.trim().slice(0, 14) ||
                      abbreviateCa(c.token, 4, 4);
                    return (
                      <li
                        key={`${c.token}-${String(c.time)}-${i}`}
                        className="flex items-center justify-between gap-3 py-2.5 first:pt-2 text-zinc-300"
                      >
                        <div className="flex min-w-0 flex-1 items-center gap-2.5">
                          <div className="shrink-0 scale-[0.85]">
                            <TokenCallThumb
                              symbol={thumbSym}
                              tokenImageUrl={c.tokenImageUrl ?? null}
                              mint={c.token}
                              tone="muted"
                            />
                          </div>
                          <span className="min-w-0 truncate text-[13px] font-semibold text-zinc-100">
                            {formatNameAndTickerLine({
                              tokenName: c.tokenName,
                              tokenTicker: c.tokenTicker,
                              callMarketCapUsd: null,
                              callCa: c.token,
                            })}
                          </span>
                        </div>
                        <span className="shrink-0 font-semibold tabular-nums text-emerald-300">
                          {c.multiple.toFixed(1)}×
                        </span>
                      </li>
                    );
                  })}
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
  categorySlug: SocialFeedCategorySlug;
  categoryOther?: string | null;
  authorName: string;
  authorHandle: string;
  authorAvatarUrl?: string | null;
  authorVerified?: boolean;
  postedAtLabel: string;
  text: string;
  /** Legacy single chip (mocks / old API). */
  metricLabel?: string;
  likeCount?: number | null;
  replyCount?: number | null;
  retweetCount?: number | null;
  quoteCount?: number | null;
  impressionCount?: number | null;
  tweetUrl?: string | null;
};

function socialPlatformPillClasses(p: SocialPlatform): string {
  return p === "x"
    ? "border-zinc-700/60 bg-zinc-900/40 text-zinc-200"
    : "border-fuchsia-500/25 bg-fuchsia-500/10 text-fuchsia-200";
}

function formatSocialEngagement(n: number | null | undefined): string | null {
  if (n == null || !Number.isFinite(n) || n < 0) return null;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`;
  if (n >= 10_000) return `${Math.round(n / 1000)}K`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`.replace(/\.0K$/, "K");
  return String(Math.round(n));
}

/** Split post body into text + https URL segments (trailing punctuation trimmed from URLs). */
function splitTextWithUrls(text: string): Array<{ type: "text" | "url"; value: string }> {
  const re = /(https?:\/\/[^\s]+)/gi;
  const parts: Array<{ type: "text" | "url"; value: string }> = [];
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) {
      parts.push({ type: "text", value: text.slice(last, m.index) });
    }
    let href = (m[1] ?? m[0]).replace(/[),.;:!?]+$/g, "");
    parts.push({ type: "url", value: href });
    last = m.index + m[0].length;
  }
  if (last < text.length) {
    parts.push({ type: "text", value: text.slice(last) });
  }
  if (parts.length === 0) {
    parts.push({ type: "text", value: text });
  }
  return parts;
}

function firstHttpsUrl(text: string): string | null {
  const m = text.match(/(https?:\/\/[^\s]+)/i);
  if (!m?.[0]) return null;
  return m[0].replace(/[),.;:!?]+$/g, "");
}

function SocialFeedTweetText({
  text,
  className,
}: {
  text: string;
  className: string;
}) {
  const segments = useMemo(() => splitTextWithUrls(text), [text]);
  return (
    <p className={className}>
      {segments.map((seg, i) =>
        seg.type === "url" ? (
          <a
            key={`u-${i}-${seg.value.slice(0, 24)}`}
            href={seg.value}
            target="_blank"
            rel="noopener noreferrer"
            className="break-all text-sky-400/95 underline decoration-sky-500/35 underline-offset-2 transition hover:text-sky-300 hover:decoration-sky-400/60"
          >
            {seg.value}
          </a>
        ) : (
          <span key={`t-${i}`}>{seg.value}</span>
        )
      )}
    </p>
  );
}

function SocialFeedFirstLinkPreview({ url, compact }: { url: string; compact: boolean }) {
  let host = "";
  let path = "";
  try {
    const u = new URL(url);
    host = u.hostname.replace(/^www\./, "");
    path = (u.pathname + u.search).replace(/\/$/, "") || "/";
    if (path.length > 48) path = `${path.slice(0, 46)}…`;
  } catch {
    return null;
  }
  const favicon = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=64`;

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={`mt-1.5 flex w-full max-w-full items-stretch gap-2.5 overflow-hidden rounded-lg border border-zinc-800/60 bg-zinc-950/40 text-left transition hover:border-zinc-600/50 hover:bg-zinc-900/50 sm:gap-3 ${
        compact ? "py-1.5 pl-2 pr-2.5" : "py-2 pl-2.5 pr-3"
      }`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={favicon}
        alt=""
        width={32}
        height={32}
        className="mt-0.5 h-7 w-7 shrink-0 rounded-md border border-zinc-800/80 bg-zinc-950 object-contain sm:h-8 sm:w-8"
        loading="lazy"
      />
        <span className="min-w-0 flex-1">
        <span className="block truncate text-[11px] font-semibold tracking-tight text-zinc-100">{host}</span>
        <span className="mt-0.5 block truncate text-[10px] leading-snug text-zinc-500">{path}</span>
        <span className="mt-1 inline-flex items-center gap-1 text-[10px] font-medium text-sky-400/85">
          Open link
          <span aria-hidden>↗</span>
        </span>
      </span>
    </a>
  );
}

function SocialFeedSkeletonRow({ compact }: { compact: boolean }) {
  return (
    <li className="rounded-xl border border-zinc-800/60 bg-zinc-950/50 p-2.5 sm:p-3">
      <div className="flex animate-pulse gap-3">
        <div className="h-11 w-11 shrink-0 rounded-full bg-zinc-800/90 ring-2 ring-black/20" />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
              <div className="h-3.5 w-32 rounded-md bg-zinc-800/80" />
              <div className="h-3 w-14 rounded-md bg-zinc-800/50" />
            </div>
            <div className="h-4 w-[4.5rem] shrink-0 rounded-md bg-zinc-800/45" />
          </div>
          <div className="space-y-2 pt-0.5">
            <div className="h-3 w-full rounded bg-zinc-800/35" />
            <div className="h-3 w-[92%] rounded bg-zinc-800/30" />
            {!compact ? <div className="h-3 w-[70%] rounded bg-zinc-800/25" /> : null}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-zinc-800/40 pt-1.5">
            <div className="flex flex-wrap gap-3">
              <div className="h-3 w-10 rounded bg-zinc-800/40" />
              <div className="h-3 w-10 rounded bg-zinc-800/35" />
              <div className="h-3 w-10 rounded bg-zinc-800/30" />
            </div>
            <div className="h-6 w-[5.5rem] shrink-0 rounded-md bg-zinc-800/45" />
          </div>
        </div>
      </div>
    </li>
  );
}

function optSocialNumber(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim()) {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

const SOCIAL_FEED_RAW: Array<{
  id: string;
  platform: SocialPlatform;
  authorName: string;
  authorHandle: string;
  postedAtLabel: string;
  text: string;
  metricLabel?: string;
  authorAvatarUrl?: string;
  authorVerified?: boolean;
  likeCount?: number;
  replyCount?: number;
  retweetCount?: number;
  quoteCount?: number;
  impressionCount?: number | null;
}> = [
  {
    id: "x-1",
    platform: "x",
    authorName: "Onchain Radar",
    authorHandle: "@onchainradar",
    postedAtLabel: "12m",
    text: "SOL memecoin rotation picking up again. Watch for liquidity returning to midcaps — narratives are shifting fast.",
    authorAvatarUrl: "https://api.dicebear.com/9.x/notionists/png?seed=onchainradar&size=128",
    authorVerified: true,
    likeCount: 4200,
    replyCount: 118,
    retweetCount: 412,
    quoteCount: 64,
    impressionCount: 52000,
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
    text: "Trending pairs: volume spikes on SOL with improving depth. If you’re scanning, focus on liquidity + holder distribution — https://dexscreener.com/solana",
    authorAvatarUrl: "https://api.dicebear.com/9.x/notionists/png?seed=dexpulse&size=128",
    authorVerified: true,
    likeCount: 2100,
    replyCount: 44,
    retweetCount: 89,
    quoteCount: 12,
    impressionCount: 31000,
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

const SOCIAL_FEED_CATEGORY_ROTATE = SOCIAL_FEED_CATEGORY_OPTIONS.map((o) => o.id);

const SOCIAL_FEED_MOCK: SocialFeedItem[] = SOCIAL_FEED_RAW.map((row, i) => {
  const slug = SOCIAL_FEED_CATEGORY_ROTATE[i % SOCIAL_FEED_CATEGORY_ROTATE.length]!;
  return {
    ...row,
    categorySlug: slug,
    categoryOther: slug === "other" ? "Curated highlight" : null,
  };
});

const SOCIAL_AUTHOR_POOL: Array<{
  platform: SocialPlatform;
  authorName: string;
  authorHandle: string;
  categorySlug: SocialFeedCategorySlug;
}> = [
  { platform: "x", authorName: "Onchain Radar", authorHandle: "@onchainradar", categorySlug: "crypto" },
  { platform: "x", authorName: "Dex Pulse", authorHandle: "@dexpulse", categorySlug: "crypto" },
  { platform: "x", authorName: "Liquidity Lens", authorHandle: "@liq_lens", categorySlug: "crypto" },
  { platform: "x", authorName: "Tape Reader", authorHandle: "@tapereader", categorySlug: "crypto" },
  { platform: "x", authorName: "Whale Watch", authorHandle: "@whalewatch", categorySlug: "economy" },
  { platform: "instagram", authorName: "Market Narratives", authorHandle: "@marketnarratives", categorySlug: "politics" },
  { platform: "instagram", authorName: "Chart Room", authorHandle: "@chartroom", categorySlug: "economy" },
  { platform: "instagram", authorName: "Volume Lab", authorHandle: "@volumelab", categorySlug: "culture" },
  { platform: "instagram", authorName: "Risk First", authorHandle: "@riskfirst", categorySlug: "economy" },
  { platform: "instagram", authorName: "Alpha Board", authorHandle: "@alphaboard", categorySlug: "culture" },
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

function makeNewSocialPost(forcePlatform?: SocialPlatform): SocialFeedItem {
  const pool = forcePlatform
    ? SOCIAL_AUTHOR_POOL.filter((a) => a.platform === forcePlatform)
    : SOCIAL_AUTHOR_POOL;
  const author = pool[Math.floor(Math.random() * pool.length)] ?? SOCIAL_AUTHOR_POOL[0]!;
  const text = SOCIAL_TEXT_POOL[Math.floor(Math.random() * SOCIAL_TEXT_POOL.length)] ?? SOCIAL_TEXT_POOL[0]!;
  return {
    id: `mock-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    platform: author.platform,
    categorySlug: author.categorySlug,
    categoryOther: author.categorySlug === "other" ? "Live sample" : null,
    authorName: author.authorName,
    authorHandle: author.authorHandle,
    authorAvatarUrl: `https://api.dicebear.com/9.x/notionists/png?seed=${encodeURIComponent(author.authorHandle)}&size=128`,
    authorVerified: author.platform === "x" && Math.random() > 0.55,
    postedAtLabel: "now",
    text,
    likeCount: 400 + Math.floor(Math.random() * 12000),
    replyCount: Math.floor(Math.random() * 180),
    retweetCount: Math.floor(Math.random() * 90),
    quoteCount: Math.floor(Math.random() * 40),
    impressionCount: Math.random() > 0.25 ? Math.floor(Math.random() * 80000) : null,
  };
}

type ActivityItem = {
  type: "win" | "call";
  text: string;
  /** `call_performance.source` — drives row tint (bot vs user calls). */
  callSource?: string;
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
  /** Stable id for merged `outside_calls` rows (dedupe / list keys). */
  outsideCallId?: string;
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

function resolveActivityMint(item: ActivityItem): string | null {
  const dex = item.link_chart ?? "";
  const fromText = resolveCaInActivityText(item.text, dex);
  if (fromText?.ca) return fromText.ca;
  if (dex) {
    const fromDex = extractCaFromDexLink(dex);
    if (fromDex) return fromDex;
  }
  return null;
}

function parseCallTickerFromActivityText(text: string): string | null {
  const m = text.match(/\(\$([^)]+)\)/i);
  const t = m?.[1]?.trim();
  return t || null;
}

/** `Name ($TICKER)` tail on “New Call - … called …” lines — for chart title / subtitle. */
function parseCallTokenDisplayNameFromActivityText(text: string): string | null {
  const m = text.match(/^New Call - .+? called\s+(.+)$/i);
  if (!m?.[1]) return null;
  const tail = String(m[1]).trim();
  const nameM = tail.match(/^(.+?)\s*\(\$([^)]+)\)/i);
  if (!nameM?.[1]) return null;
  const name = String(nameM[1]).trim();
  return name || null;
}

/** Ticker for chart: `($TICK)` on calls, or `$TICK hit` milestone lines for wins. */
function parseActivityChartTicker(text: string, type: ActivityItem["type"]): string | null {
  const fromParens = parseCallTickerFromActivityText(text);
  if (fromParens) return fromParens.replace(/^\$/, "");
  if (type === "win") {
    const m = text.match(MILESTONE_ACTIVITY_LINE_RE);
    const tick = m?.[1]?.trim();
    if (tick) return tick.replace(/^\$/, "");
  }
  return null;
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
  const outsideParsed = parseOutsideActivityLineText(item.text);
  if (item.type === "call" && outsideParsed) {
    const { tapeLabel, xHandle, mint } = outsideParsed;
    const chartLink = dex || `https://dexscreener.com/solana/${encodeURIComponent(mint)}`;
    return (
      <>
        <span className="text-zinc-500">Outside call</span>
        {" — "}
        <span className="text-emerald-400/70">{tapeLabel}</span>
        <span className="text-zinc-500"> (@{xHandle || "unknown"})</span>
        {" · "}
        {renderTextSegmentWithCa(mint, chartLink)}
      </>
    );
  }
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

  if (id && item.type === "win") {
    const m = item.text.match(MILESTONE_ACTIVITY_LINE_RE);
    if (m) {
      const tick = m[1] ?? "";
      const multStr = m[2] ?? "";
      const hitMcLabel = m[3] ?? "";
      const callMcLabel = m[5] ?? "";
      return (
        <>
          ${tick} hit {multStr}x ({hitMcLabel}) - Called by @
          <Link
            href={userProfileHref({
              discordId: id,
              displayName: name || lineLabel || apiName,
            })}
            className={PROFILE_LINK_CLASS}
            onClick={(e) => e.stopPropagation()}
          >
            {lineLabel}
          </Link>
          <UserBadgeIcons badges={badges} className="ml-1" />
          {" "}
          at {callMcLabel}
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
  const oc = item.outsideCallId?.trim();
  if (oc) return `outside::${oc}`;
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

function filterActivityForFeed(
  items: ActivityItem[],
  feedMode: "all" | "me" | "milestones" | "calls" | "following",
  viewerId: string,
  followingIds: Set<string>
): ActivityItem[] {
  const uid = viewerId.trim();
  switch (feedMode) {
    case "all":
      return items;
    case "following":
      return items.filter((i) => followingIds.has(i.discordId.trim()));
    case "me":
      return uid ? items.filter((i) => i.discordId.trim() === uid) : [];
    case "milestones":
      return items.filter((i) => i.type === "win");
    case "calls":
      return items.filter((i) => i.type === "call");
    default:
      return items;
  }
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
      className={`relative rounded-xl border px-4 py-3 backdrop-blur-sm ${terminalSurface.panelCard} ${CARD_HOVER}`}
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

function widgetEnabled(
  widgets: WidgetsEnabled | null,
  key: keyof WidgetsEnabled
): boolean {
  if (widgets === null) return true;
  return Boolean(widgets[key]);
}

/** Indeterminate top edge for polling / refetch (`animate-mcg-refresh` in tailwind.config). */
function DashboardRefreshBar({ active }: { active: boolean }) {
  if (!active) return null;
  return (
    <div
      className="pointer-events-none absolute left-0 right-0 top-0 z-[5] h-[2px] overflow-hidden rounded-t-xl bg-zinc-800/50"
      aria-hidden
    >
      <div className="h-full w-[42%] rounded-full bg-gradient-to-r from-transparent via-sky-400/70 to-transparent motion-reduce:animate-none animate-mcg-refresh" />
    </div>
  );
}

function TrendingSkeletonRows() {
  return (
    <ul className="space-y-1" aria-busy="true" aria-label="Loading trending tokens">
      {Array.from({ length: 6 }, (_, i) => (
        <li key={`trend-sk-${i}`}>
          <div className="flex animate-pulse items-center gap-2 rounded-lg border border-zinc-800/90 bg-zinc-900/20 px-2 py-2 sm:gap-3 sm:px-3">
            <div className="h-7 w-7 shrink-0 rounded-md bg-zinc-800/60" />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="h-3.5 w-28 max-w-[60%] rounded bg-zinc-800/50" />
              <div className="h-2.5 w-40 max-w-[85%] rounded bg-zinc-800/40" />
            </div>
            <div className="hidden h-8 w-14 shrink-0 rounded bg-zinc-800/40 sm:block" />
            <div className="hidden h-8 w-14 shrink-0 rounded bg-zinc-800/35 sm:block" />
          </div>
        </li>
      ))}
    </ul>
  );
}

function HomeRecentCallsSkeleton() {
  return (
    <ul className="divide-y divide-zinc-800/45" aria-busy="true" aria-label="Loading recent calls">
      {Array.from({ length: 5 }, (_, i) => (
        <li key={`call-sk-${i}`}>
          <div className="flex animate-pulse items-center gap-2 py-2 pl-1 pr-1 sm:gap-2.5 sm:py-2 sm:pl-1.5 sm:pr-2">
            <div className="h-8 w-8 shrink-0 rounded-lg bg-zinc-800/55 ring-1 ring-black/15" />
            <div className="min-w-0 flex-1 space-y-2 pr-2">
              <div className="h-3.5 max-w-[88%] rounded bg-zinc-800/45" />
            </div>
            <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
              <div className="h-5 w-9 rounded-md bg-zinc-800/40" />
              <div className="h-6 w-11 rounded-md bg-zinc-800/40" />
              <div className="h-6 w-9 rounded bg-zinc-800/35" />
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
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
  const [apiRows, setApiRows] = useState<TrendingTokenRow[]>([]);
  const [trendingLoading, setTrendingLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const tf = timeframe;
    setTrendingLoading(true);
    fetch(`/api/trending?timeframe=${encodeURIComponent(tf)}`, { credentials: "same-origin" })
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
          const nameRaw =
            typeof o.name === "string"
              ? o.name.trim()
              : typeof o.tokenName === "string"
                ? o.tokenName.trim()
                : "";
          const name = nameRaw.length > 0 ? nameRaw : null;
          const imageUrl =
            typeof (o as { imageUrl?: unknown }).imageUrl === "string" &&
            String((o as { imageUrl?: unknown }).imageUrl).startsWith("http")
              ? String((o as { imageUrl?: unknown }).imageUrl)
              : null;
          parsed.push({
            symbol,
            name,
            mint,
            imageUrl,
            priceUsd: Number(o.priceUsd ?? 0) || 0,
            marketCapUsd: Number(o.marketCapUsd ?? 0) || 0,
            changePct: Number(o.changePct ?? 0) || 0,
            liquidityUsd: Number(o.liquidityUsd ?? 0) || 0,
            volumeUsd: Number(o.volumeUsd ?? 0) || 0,
            holders: Math.max(0, Number(o.holders ?? 0) || 0),
            source: "Dexscreener",
            timeframe: tf,
          });
        }
        setApiRows(parsed);
      })
      .catch(() => {
        if (!cancelled) {
          setApiRows([]);
        }
      })
      .finally(() => {
        if (!cancelled) setTrendingLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [timeframe]);

  const rows = apiRows;

  const chipClass = (active: boolean) =>
    `rounded-lg px-3 py-1.5 text-xs font-semibold tabular-nums transition-colors ${
      active
        ? "bg-zinc-700 text-zinc-50 shadow-sm shadow-black/20"
        : "bg-zinc-900/70 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
    }`;

  return (
    <PanelCard
      titleSlotWide
      title={
        <span className="flex min-w-0 flex-wrap items-baseline gap-x-1">
          <span className="text-zinc-100">Trending Coins</span>
          <span className="text-zinc-600" aria-hidden>
            ·
          </span>
          <span className="font-semibold tabular-nums text-sky-400/90 drop-shadow-[0_0_8px_rgba(56,189,248,0.35)]">
            SOL
          </span>
        </span>
      }
      titleClassName="normal-case"
      titleRight={
        <div className="flex shrink-0 items-center gap-1 rounded-lg border border-zinc-800/70 bg-zinc-900/35 p-1">
          <button type="button" onClick={() => setTimeframe("5m")} className={chipClass(timeframe === "5m")}>
            5m
          </button>
          <button type="button" onClick={() => setTimeframe("1h")} className={chipClass(timeframe === "1h")}>
            1h
          </button>
          <button type="button" onClick={() => setTimeframe("24h")} className={chipClass(timeframe === "24h")}>
            24h
          </button>
        </div>
      }
      data-tutorial="dashboard.trending"
      className="min-w-0 max-w-full"
    >
      <div className="mt-3 max-w-full overflow-x-auto overscroll-x-contain">
        <div className={`min-w-0 ${terminalSurface.dashboardListWell}`}>
        <DashboardRefreshBar active={trendingLoading && rows.length > 0} />
        <div className="px-2 pb-2 text-[10px] uppercase tracking-wider text-zinc-600 sm:text-[11px]">
          <div className="grid min-w-[16rem] grid-cols-[minmax(0,1fr)_minmax(0,4.25rem)_minmax(0,4.25rem)] items-center gap-1.5 sm:min-w-0 sm:grid-cols-[minmax(0,1.2fr)_auto_auto] sm:gap-3">
            <span>Token</span>
            <span className="text-right">MC / Chg</span>
            <span className="text-right">Liq / Vol</span>
          </div>
        </div>

        <div className="h-[300px] overflow-y-auto pr-1 no-scrollbar">
          {trendingLoading && rows.length === 0 ? (
            <div className="px-1 pb-1 pt-0.5">
              <TrendingSkeletonRows />
            </div>
          ) : rows.length === 0 ? (
            <div className="flex h-full items-center justify-center px-3 py-10">
              <div className="text-center">
                <p className="text-sm font-semibold text-zinc-200">
                  No matches
                </p>
                <p className="mt-1 text-xs text-zinc-500">
                  Try a different timeframe, or retry in a moment if Dexscreener is rate-limited.
                </p>
              </div>
            </div>
          ) : (
            <ul
              className={`space-y-1 transition-opacity duration-200 ${
                trendingLoading ? "opacity-[0.86]" : "opacity-100"
              }`}
            >
              {rows.map((row, i) => {
                const positive = row.changePct >= 0;
                const displayName = (row.name && row.name.trim()) || row.symbol;
                const showTickerSub =
                  row.name &&
                  row.name.trim() !== "" &&
                  row.symbol.trim() !== "" &&
                  row.name.trim().toLowerCase() !== row.symbol.trim().toLowerCase();
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
                      title={`${displayName} — open on Dexscreener`}
                      className={terminalPage.denseInsetRowButton}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          {row.imageUrl ? (
                            <span className="relative h-7 w-7 shrink-0 overflow-hidden rounded-md border border-zinc-800/70 bg-zinc-950">
                              <img
                                src={row.imageUrl}
                                alt={displayName}
                                className="h-full w-full object-cover"
                                loading="lazy"
                                referrerPolicy="no-referrer"
                              />
                            </span>
                          ) : (
                            <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-zinc-800/70 bg-zinc-950 text-xs font-semibold text-zinc-200">
                              #{i + 1}
                            </span>
                          )}
                          <span className="min-w-0 flex-1 truncate text-sm font-semibold text-zinc-100">
                            {displayName}
                          </span>
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-zinc-500">
                          {showTickerSub ? (
                            <span className="font-mono text-zinc-400">${row.symbol}</span>
                          ) : null}
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
                          {row.marketCapUsd > 0
                            ? formatCompactUsd(row.marketCapUsd)
                            : "—"}
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
  const winRateLabel =
    stats === null || (stats.totalCalls ?? 0) <= 0
      ? "—"
      : `${stats.winRate.toFixed(0)}%`;

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

        <div className="mt-2 min-h-[9rem] flex-1">
        {yourRankLoading ? (
          <div className="flex h-full min-h-[9rem] flex-1 animate-pulse items-center justify-between gap-3" aria-busy="true">
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
          <p className="text-sm leading-relaxed text-zinc-400">{emptyRankHint}</p>
        ) : (
          <>
            <div className="flex items-center justify-between">
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
                  {winRateLabel}
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
      <div
        className={`rounded-xl border border-zinc-900 bg-zinc-950/40 p-3 ${terminalSurface.insetEdgeSoft}`}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span
              className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-zinc-800/70 bg-zinc-950 text-sm"
              aria-hidden
            >
              🏆
            </span>
            <div>
              <p className="text-sm font-semibold text-zinc-100">
                No calls in the last 24 hours yet.
              </p>
              <p className="mt-0.5 text-xs text-zinc-500">
                First solid call in this window will claim the #1 spot.
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
            className={`rounded-xl border px-4 py-3 shadow-sm shadow-black/20 ${row.tint} border-zinc-800/90`}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-zinc-800/70 bg-zinc-950/40 text-base"
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
    <section className="min-w-0">
      <PanelCard
        title="🔥 Top Performers Today"
        titleClassName="normal-case"
        className="relative min-w-0 max-w-full overflow-hidden"
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-yellow-500/35 via-[color:var(--accent)]/35 to-transparent" />
        {topPerformersLoading ? (
          <div className="mt-3 flex min-h-[min(24rem,55vh)] items-center justify-center rounded-xl border border-zinc-900/80 bg-zinc-950/20">
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
                  <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
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
                        className={`min-w-0 flex-1 truncate ${v.nameLink}`}
                      >
                        {label}
                      </Link>
                      <UserBadgeIcons
                        badges={(badgesByUser ?? {})[row.discordId.trim()] ?? []}
                      />
                    </div>
                    <div className="flex shrink-0 flex-col text-right text-xs tabular-nums sm:text-sm">
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

function activityFeedRowTintClass(item: ActivityItem): string {
  if (item.type === "win") {
    return "bg-amber-400/[0.08] ring-1 ring-inset ring-amber-400/[0.12] hover:bg-amber-400/[0.11]";
  }
  if (item.type === "call") {
    const src = (item.callSource ?? "user").toLowerCase();
    if (src === "outside") {
      return "bg-emerald-500/[0.06] ring-1 ring-inset ring-emerald-500/[0.11] hover:bg-emerald-500/[0.09]";
    }
    if (src === "bot") {
      return "bg-violet-500/[0.08] ring-1 ring-inset ring-violet-500/[0.13] hover:bg-violet-500/[0.11]";
    }
    return "bg-sky-500/[0.06] ring-1 ring-inset ring-sky-500/[0.10] hover:bg-sky-500/[0.095]";
  }
  return "bg-zinc-900/35 hover:bg-zinc-800/55";
}

/** Card chrome on small screens (Top Performers–style); paired with `activityFeedRowTintClass` on `sm+`. */
function activityFeedMobileCardClass(item: ActivityItem): string {
  if (item.type === "win") {
    return "max-sm:rounded-xl max-sm:border max-sm:border-amber-500/28 max-sm:bg-amber-500/[0.07] max-sm:px-4 max-sm:py-3 max-sm:shadow-sm max-sm:shadow-black/20 max-sm:ring-0";
  }
  if (item.type === "call") {
    const src = (item.callSource ?? "user").toLowerCase();
    if (src === "outside") {
      return "max-sm:rounded-xl max-sm:border max-sm:border-emerald-500/28 max-sm:bg-emerald-500/[0.07] max-sm:px-4 max-sm:py-3 max-sm:shadow-sm max-sm:shadow-black/20 max-sm:ring-0";
    }
    if (src === "bot") {
      return "max-sm:rounded-xl max-sm:border max-sm:border-violet-500/28 max-sm:bg-violet-500/[0.08] max-sm:px-4 max-sm:py-3 max-sm:shadow-sm max-sm:shadow-black/20 max-sm:ring-0";
    }
    return "max-sm:rounded-xl max-sm:border max-sm:border-sky-500/28 max-sm:bg-sky-500/[0.07] max-sm:px-4 max-sm:py-3 max-sm:shadow-sm max-sm:shadow-black/20 max-sm:ring-0";
  }
  return "max-sm:rounded-xl max-sm:border max-sm:border-zinc-700/60 max-sm:bg-zinc-950/90 max-sm:px-4 max-sm:py-3 max-sm:shadow-sm max-sm:shadow-black/20 max-sm:ring-0";
}

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

  const { addNotification } = useNotifications();
  const [watchlistAddingMint, setWatchlistAddingMint] = useState<string | null>(null);

  const addActivityToWatchlist = useCallback(
    async (item: ActivityItem) => {
      const mint = resolveActivityMint(item);
      if (!mint) {
        addNotification({
          id: crypto.randomUUID(),
          text: "No token address on this activity line.",
          type: "call",
          createdAt: Date.now(),
          priority: "low",
        });
        return;
      }
      const ticker = parseCallTickerFromActivityText(item.text);
      const label = ticker ? `$${ticker}` : abbreviateCa(mint, 4, 4);
      if (!window.confirm(`Add ${label} to your private watchlist?`)) return;

      setWatchlistAddingMint(mint);
      try {
        const res = await fetch("/api/me/watchlist", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ action: "add", scope: "private", mint }),
        });
        const data = (await res.json().catch(() => ({}))) as { success?: boolean; error?: string };
        if (!res.ok || data.success !== true) {
          addNotification({
            id: crypto.randomUUID(),
            text:
              typeof data.error === "string" && data.error.trim()
                ? data.error
                : "Could not add to your watchlist.",
            type: "call",
            createdAt: Date.now(),
            priority: "low",
          });
          return;
        }
        addNotification({
          id: crypto.randomUUID(),
          text: `Added ${label} to your watchlist.`,
          type: "call",
          createdAt: Date.now(),
          priority: "medium",
        });
      } catch {
        addNotification({
          id: crypto.randomUUID(),
          text: "Could not add to your watchlist.",
          type: "call",
          createdAt: Date.now(),
          priority: "low",
        });
      } finally {
        setWatchlistAddingMint(null);
      }
    },
    [addNotification]
  );

  return (
      <PanelCard title="Live Activity" className="min-w-0 max-w-full">
      <div className="mt-2 flex min-w-0 flex-nowrap items-center gap-1.5 overflow-x-auto pb-0.5 no-scrollbar sm:gap-2">
        {(
          [
            { id: "all" as const, label: "All", short: "All" },
            { id: "me" as const, label: "My Activity", short: "Mine" },
            { id: "milestones" as const, label: "Milestones", short: "Wins" },
            { id: "calls" as const, label: "Calls", short: "Calls" },
            { id: "following" as const, label: "Following", short: "Follow" },
          ] as const
        ).map(({ id, label, short }) => {
          const active = feedMode === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setFeedMode(id)}
              title={label}
              className={`shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors sm:px-4 sm:py-2 sm:text-sm ${
                active
                  ? "bg-zinc-700 text-zinc-50"
                  : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-zinc-100"
              }`}
            >
              <span className="sm:hidden">{short}</span>
              <span className="hidden sm:inline">{label}</span>
            </button>
          );
        })}
        <div className="ml-auto flex shrink-0 items-center gap-2 text-[11px] text-zinc-500">
          <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--accent)] opacity-80" aria-hidden />
          <span className="hidden sm:inline">LIVE</span>
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
          <ul className="space-y-2.5 text-sm sm:space-y-0">
            {filteredActivity.map((item, i) => {
              const rowMint = (viewerId ?? "").trim() ? resolveActivityMint(item) : null;
              const rowKey = item.outsideCallId?.trim()
                ? `oc-${item.outsideCallId.trim()}`
                : `${String(item.time)}-${i}-${item.text.slice(0, 24)}`;
              return (
            <li
              key={rowKey}
              className="dashboard-feed-item max-sm:list-none sm:border-b sm:border-zinc-800/90 sm:last:border-b-0"
              style={{ animationDelay: `${i * 70}ms` }}
            >
              <div className="group relative">
                <div
                  className={`absolute bottom-1 left-0 top-1 hidden w-[2px] rounded-full transition-opacity sm:block ${
                    item.type === "win"
                      ? "bg-[color:var(--accent)]/45 opacity-90"
                      : "bg-cyan-400/35 opacity-0 group-hover:opacity-80"
                  }`}
                />
                  <div className="pl-0 sm:pl-3">
                  <div
                    className={`flex flex-col gap-2 transition-all duration-150 sm:flex-row sm:items-start sm:gap-2 sm:rounded-lg sm:px-3 sm:py-2 ${activityFeedMobileCardClass(item)} ${activityFeedRowTintClass(item)} ${TOP_PERFORMER_ROW_INTERACTIVE}`}
                  >
                    <div className="flex shrink-0 items-start gap-2">
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
                      className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center text-base leading-none opacity-[0.88]"
                      aria-hidden
                    >
                      {item.type === "win" ? "🔥" : "⚡"}
                    </span>
                    </div>
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
                      className="flex min-w-0 flex-1 cursor-pointer flex-col gap-2 rounded-md border-0 bg-transparent py-0 text-left text-inherit focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/40 sm:flex-row sm:items-start sm:justify-between sm:gap-3"
                    >
                      <span className="min-w-0 max-w-full text-zinc-200 max-sm:block max-sm:break-words max-sm:text-[13px] max-sm:leading-snug sm:text-sm">
                        {renderActivityFeedLine(
                          item,
                          viewerId,
                          viewerName,
                          (badgesByUser ?? {})[item.discordId.trim()] ?? []
                        )}
                      </span>
                      <span className="flex max-w-full shrink-0 flex-wrap items-center justify-end gap-2 max-sm:w-full max-sm:border-t max-sm:border-zinc-800/50 max-sm:pt-2 sm:justify-start">
                        {Number.isFinite(item.multiple) && item.multiple > 0 ? (
                          <span className="font-semibold tabular-nums text-[color:var(--accent)]">
                            {item.multiple.toFixed(1)}x
                          </span>
                        ) : null}
                        <span className="whitespace-nowrap text-[10px] tabular-nums text-zinc-500">
                          {formatJoinedAt(callTimeMs(item.time), nowMs, "compact")}
                        </span>
                        {rowMint ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              void addActivityToWatchlist(item);
                            }}
                            disabled={watchlistAddingMint === rowMint}
                            className="-mr-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-md text-zinc-500 transition hover:bg-zinc-800 hover:text-sky-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/40 disabled:opacity-40"
                            aria-label="Add token to watchlist"
                            title="Add to watchlist"
                          >
                            <span className="text-base font-semibold leading-none">+</span>
                          </button>
                        ) : null}
                        <span className="text-xs text-zinc-500" aria-hidden>
                          ↗
                        </span>
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </li>
            );
            })}
          </ul>
        )}
      </div>

      <div
        className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-zinc-800/60 pt-2.5 text-[10px] text-zinc-500"
        aria-label="Activity row colors"
      >
        <span className="font-semibold uppercase tracking-wide text-zinc-600">Key</span>
        <span className="flex items-center gap-1.5">
          <span
            className="h-2 w-2 shrink-0 rounded-sm bg-amber-400/55 ring-1 ring-amber-400/22"
            aria-hidden
          />
          Milestone
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 shrink-0 rounded-sm bg-sky-400/50 ring-1 ring-sky-400/20" aria-hidden />
          User call
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 shrink-0 rounded-sm bg-violet-400/50 ring-1 ring-violet-400/22" aria-hidden />
          Bot call
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 shrink-0 rounded-sm bg-emerald-400/45 ring-1 ring-emerald-400/18" aria-hidden />
          Outside call
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 shrink-0 rounded-sm bg-zinc-600/60 ring-1 ring-zinc-500/22" aria-hidden />
          Other
        </span>
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
            className="border-b border-zinc-800/90 last:border-b-0"
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

function SocialFeedMetricPill({
  label,
  icon,
  value,
}: {
  label: string;
  icon: ReactNode;
  value: string;
}) {
  return (
    <span
      className="inline-flex items-center gap-1 text-[11px] font-medium tabular-nums text-zinc-400"
      title={label}
    >
      <span className="text-zinc-600" aria-hidden>
        {icon}
      </span>
      {value}
    </span>
  );
}

function SocialFeedPostRow({
  item,
  compact,
  flash,
}: {
  item: SocialFeedItem;
  compact: boolean;
  flash: boolean;
}) {
  const [avatarFailed, setAvatarFailed] = useState(false);
  const initial = item.authorName.trim().charAt(0).toUpperCase() || "?";
  const avatarSrc =
    typeof item.authorAvatarUrl === "string" &&
    item.authorAvatarUrl.startsWith("http") &&
    !avatarFailed
      ? item.authorAvatarUrl
      : null;

  const likes = formatSocialEngagement(item.likeCount ?? null);
  const replies = formatSocialEngagement(item.replyCount ?? null);
  const retweets = formatSocialEngagement(item.retweetCount ?? null);
  const quotes = formatSocialEngagement(item.quoteCount ?? null);
  const views = formatSocialEngagement(item.impressionCount ?? null);
  const hasStructured =
    likes != null ||
    replies != null ||
    retweets != null ||
    quotes != null ||
    views != null;
  const legacyChip = !hasStructured && item.metricLabel;
  const showMetrics = hasStructured || Boolean(legacyChip);
  const showPostLink = Boolean(item.tweetUrl?.trim());
  const showFooter = showMetrics || showPostLink;

  const textCls = compact
    ? "mt-1.5 line-clamp-3 text-[13px] leading-snug text-zinc-200"
    : "mt-1.5 whitespace-pre-wrap break-words text-sm leading-relaxed text-zinc-100";

  const linkPreviewUrl = firstHttpsUrl(item.text);

  return (
    <li
      className={`rounded-xl border bg-gradient-to-b from-zinc-900/40 to-zinc-950/95 p-2.5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.03)] transition-colors sm:p-3 ${
        flash
          ? "border-[color:var(--accent)]/40 ring-1 ring-[color:var(--accent)]/25"
          : "border-zinc-800/50 hover:border-zinc-700/70 hover:from-zinc-900/55"
      }`}
    >
      <div className="flex gap-3">
        <div className="relative shrink-0">
          {avatarSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatarSrc}
              alt=""
              width={44}
              height={44}
              className="h-11 w-11 rounded-full border border-zinc-700/60 bg-zinc-900 object-cover ring-2 ring-black/30"
              loading="lazy"
              referrerPolicy="no-referrer"
              onError={() => setAvatarFailed(true)}
            />
          ) : (
            <div
              className="flex h-11 w-11 items-center justify-center rounded-full border border-zinc-700/60 bg-gradient-to-br from-zinc-700/80 to-zinc-900 text-sm font-bold text-zinc-200 ring-2 ring-black/30"
              aria-hidden
            >
              {initial}
            </div>
          )}
          <span
            className={`absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full border text-[9px] font-bold ${socialPlatformPillClasses(
              item.platform
            )}`}
            title={item.platform === "x" ? "X" : "Instagram"}
          >
            {item.platform === "x" ? (
              <span className="font-sans text-[10px] font-bold leading-none">X</span>
            ) : (
              <span className="text-[8px] font-bold leading-none">IG</span>
            )}
          </span>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <span className="truncate text-sm font-semibold text-zinc-50">{item.authorName}</span>
              {item.authorVerified && item.platform === "x" ? (
                <span className="inline-flex shrink-0 text-sky-400" title="Verified" aria-label="Verified account">
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                  </svg>
                </span>
              ) : null}
              <span className="truncate text-xs text-zinc-500">{item.authorHandle}</span>
              <span className="text-xs text-zinc-600">·</span>
              <span className="text-xs tabular-nums text-zinc-500">{item.postedAtLabel}</span>
            </div>
            <span
              className="inline-flex max-w-[min(11rem,40vw)] shrink-0 truncate rounded-md border border-zinc-600/35 bg-zinc-800/25 px-1.5 py-0.5 text-[9px] font-medium uppercase leading-tight tracking-wide text-zinc-500 sm:max-w-[13rem] sm:px-2 sm:text-[10px]"
              title={formatSocialFeedCategoryLabel(item.categorySlug, item.categoryOther)}
            >
              {formatSocialFeedCategoryLabel(item.categorySlug, item.categoryOther)}
            </span>
          </div>

          <SocialFeedTweetText text={item.text} className={textCls} />

          {linkPreviewUrl && linkPreviewUrl !== item.tweetUrl ? (
            <SocialFeedFirstLinkPreview url={linkPreviewUrl} compact={compact} />
          ) : null}

          {showFooter ? (
            <div
              className={`mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-zinc-800/50 pt-1.5 sm:gap-x-4 sm:pt-2 ${
                showMetrics && showPostLink ? "justify-between" : showPostLink ? "justify-end" : ""
              }`}
            >
              {showMetrics ? (
                <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 sm:gap-x-4">
                  {likes != null ? (
                    <SocialFeedMetricPill
                      label="Likes"
                      value={likes}
                      icon={
                        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                          <path d="M12 21s-7-4.35-10-9.5C-.5 6.5 3.5 3 7.5 3c2.35 0 4.23 1.5 4.5 3.5C12.27 4.5 14.15 3 16.5 3 20.5 3 24.5 6.5 22 11.5 19 16.65 12 21 12 21z" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      }
                    />
                  ) : null}
                  {replies != null ? (
                    <SocialFeedMetricPill
                      label="Replies"
                      value={replies}
                      icon={
                        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                          <path d="M21 15a4 4 0 0 1-4 4H8l-5 4V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      }
                    />
                  ) : null}
                  {retweets != null ? (
                    <SocialFeedMetricPill
                      label="Reposts"
                      value={retweets}
                      icon={
                        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                          <path d="M17 1l4 4-4 4M3 11V9a4 4 0 0 1 4-4h14M7 23l-4-4 4-4M21 13v2a4 4 0 0 1-4 4H3" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      }
                    />
                  ) : null}
                  {quotes != null ? (
                    <SocialFeedMetricPill
                      label="Quotes"
                      value={quotes}
                      icon={
                        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                          <path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z" strokeLinecap="round" strokeLinejoin="round" />
                          <path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1-1 1z" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      }
                    />
                  ) : null}
                  {views != null ? (
                    <SocialFeedMetricPill
                      label="Views (when exposed by X API)"
                      value={views}
                      icon={
                        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                          <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" strokeLinecap="round" strokeLinejoin="round" />
                          <circle cx="12" cy="12" r="3" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      }
                    />
                  ) : null}
                  {legacyChip ? (
                    <span className="rounded-full border border-zinc-700/50 bg-zinc-900/40 px-2 py-0.5 text-[11px] font-medium tabular-nums text-zinc-400">
                      {item.metricLabel}
                    </span>
                  ) : null}
                </div>
              ) : null}
              {showPostLink && item.tweetUrl ? (
                <a
                  href={item.tweetUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-zinc-700/40 bg-zinc-900/30 px-2 py-1 text-[11px] font-medium text-sky-400/95 transition hover:border-sky-500/30 hover:bg-sky-500/10 hover:text-sky-300"
                >
                  {item.platform === "x" ? (
                    <span
                      className="flex h-4 w-4 items-center justify-center rounded-full bg-zinc-950 font-sans text-[9px] font-bold leading-none text-zinc-100 ring-1 ring-zinc-600/60"
                      aria-hidden
                    >
                      X
                    </span>
                  ) : null}
                  <span>{item.platform === "x" ? "View on X" : "View post"}</span>
                  <span className="text-[10px] opacity-80" aria-hidden>
                    ↗
                  </span>
                </a>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </li>
  );
}

function SocialsFeedPanel() {
  const { data: session, status } = useSession();
  const [tab, setTab] = useState<"all" | SocialFeedCategorySlug>("all");
  const [items, setItems] = useState<SocialFeedItem[]>([]);
  const [flashId, setFlashId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [submitPlatform, setSubmitPlatform] = useState<SocialPlatform>("x");
  const [submitHandle, setSubmitHandle] = useState("");
  const [submitSourceName, setSubmitSourceName] = useState("");
  const [submitCategorySlug, setSubmitCategorySlug] = useState<SocialFeedCategorySlug>("crypto");
  const [submitCategoryOther, setSubmitCategoryOther] = useState("");
  const [submitRationale, setSubmitRationale] = useState("");
  const [submitBusy, setSubmitBusy] = useState(false);
  const [submitErr, setSubmitErr] = useState<string | null>(null);
  const [submitOk, setSubmitOk] = useState<string | null>(null);
  const prevFeedTopId = useRef<string | null>(null);

  const tier = (session?.user as { helpTier?: string } | undefined)?.helpTier;
  const isAdmin = status === "authenticated" && tier === "admin";
  const canRequestSource = status === "authenticated" && session?.user?.hasDashboardAccess === true;
  /** Shorter for admins (immediate add); members need enough context for triage. */
  const submitRationaleMinLen = isAdmin ? 4 : 8;

  const closeExpanded = useCallback(() => {
    setExpanded(false);
    setSubmitOpen(false);
  }, []);

  useEffect(() => {
    if (!expanded && !submitOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (submitOpen) setSubmitOpen(false);
      else closeExpanded();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [expanded, submitOpen, closeExpanded]);

  useEffect(() => {
    let cancelled = false;
    const POLL_MS = 45_000;
    prevFeedTopId.current = null;

    const load = () => {
      setLoading(true);
      fetch(`/api/social-feed?category=${encodeURIComponent(tab)}`, { credentials: "same-origin" })
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
            const categorySlug =
              parseSocialFeedCategorySlug(o.categorySlug ?? o.category_slug ?? o.category) ?? "other";
            const categoryOther = normalizeCategoryOther(o.categoryOther ?? o.category_other);
            const avatarRaw =
              (typeof o.authorAvatarUrl === "string" && o.authorAvatarUrl) ||
              (typeof o.author_avatar_url === "string" && o.author_avatar_url) ||
              "";
            const tweetUrl =
              (typeof o.tweetUrl === "string" && o.tweetUrl) ||
              (typeof o.tweet_url === "string" && o.tweet_url) ||
              null;
            parsed.push({
              id,
              platform: (platform as SocialFeedItem["platform"]) || "x",
              categorySlug,
              categoryOther,
              authorName,
              authorHandle,
              authorAvatarUrl: avatarRaw.startsWith("http") ? avatarRaw : null,
              authorVerified: Boolean(o.authorVerified ?? o.author_verified),
              postedAtLabel,
              text,
              metricLabel: typeof o.metricLabel === "string" ? o.metricLabel : undefined,
              likeCount: optSocialNumber(o.likeCount ?? o.like_count),
              replyCount: optSocialNumber(o.replyCount ?? o.reply_count),
              retweetCount: optSocialNumber(o.retweetCount ?? o.retweet_count),
              quoteCount: optSocialNumber(o.quoteCount ?? o.quote_count),
              impressionCount: optSocialNumber(o.impressionCount ?? o.impression_count),
              tweetUrl,
            });
          }
          setItems(parsed);
          const topId = parsed[0]?.id ?? null;
          if (topId && topId !== prevFeedTopId.current) {
            prevFeedTopId.current = topId;
            setFlashId(topId);
            window.setTimeout(() => setFlashId(null), 900);
          } else if (!topId) {
            prevFeedTopId.current = null;
          }
        })
        .catch(() => {
          if (!cancelled) setItems([]);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    };

    load();
    const interval = window.setInterval(() => {
      if (cancelled) return;
      if (typeof document !== "undefined" && document.hidden) return;
      load();
    }, POLL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [tab]);

  const rows = useMemo(() => {
    if (tab === "all") return items;
    return items.filter((r) => r.categorySlug === tab);
  }, [items, tab]);

  const renderFeedList = (compact: boolean) => {
    if (loading && rows.length === 0) {
      const n = compact ? 5 : 6;
      return (
        <ul className={compact ? "space-y-2.5 pr-0.5" : "space-y-3"} aria-busy="true" aria-label="Loading feed">
          {Array.from({ length: n }, (_, i) => (
            <SocialFeedSkeletonRow key={`social-sk-${i}`} compact={compact} />
          ))}
        </ul>
      );
    }

    if (rows.length === 0) {
      return (
        <div className="flex h-full min-h-[12rem] flex-col items-center justify-center px-4 py-12">
          <div className="rounded-full border border-zinc-800 bg-zinc-900/40 px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
            Feed
          </div>
          <p className="mt-4 text-sm font-semibold text-zinc-200">No posts yet</p>
          <p className="mt-1 max-w-xs text-center text-xs leading-relaxed text-zinc-500">
            When sources are connected and synced, posts appear here with avatars and engagement.
          </p>
        </div>
      );
    }

    return (
      <ul
        className={`${compact ? "space-y-2.5 pr-0.5" : "space-y-3"} transition-opacity duration-200 ${
          loading ? "opacity-[0.82]" : "opacity-100"
        }`}
      >
        {rows.map((item) => (
          <SocialFeedPostRow
            key={item.id}
            item={item}
            compact={compact}
            flash={flashId === item.id}
          />
        ))}
      </ul>
    );
  };

  return (
    <>
      <PanelCard
        titleSlotWide
        title={
          <span className="inline-flex flex-wrap items-baseline gap-x-1">
            <span className="text-zinc-100">Social Feed</span>
            <span className="text-zinc-600" aria-hidden>
              ·
            </span>
            <span className="font-semibold tabular-nums text-emerald-400/95 drop-shadow-[0_0_10px_rgba(52,211,153,0.55)]">
              Live
            </span>
          </span>
        }
        titleClassName="normal-case"
        titleRight={
          <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
            <div className="no-scrollbar flex min-w-0 max-w-[min(100%,52vw)] flex-1 justify-end overflow-x-auto sm:max-w-none">
              <div className="flex shrink-0 flex-nowrap items-center gap-1 rounded-lg border border-zinc-800/70 bg-zinc-900/35 p-1">
                <button
                  type="button"
                  onClick={() => setTab("all")}
                  className={`shrink-0 rounded-md px-2 py-1 text-xs transition-all ${
                    tab === "all"
                      ? "border border-zinc-500/30 bg-zinc-500/10 font-semibold text-zinc-100"
                      : "text-zinc-500 hover:bg-zinc-800/40 hover:text-white"
                  }`}
                >
                  All
                </button>
                {SOCIAL_FEED_CATEGORY_OPTIONS.filter((o) => o.inFeedTabs).map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setTab(opt.id)}
                    className={`max-w-[7.5rem] shrink-0 truncate rounded-md px-2 py-1 text-xs transition-all ${
                      tab === opt.id
                        ? "border border-zinc-500/30 bg-zinc-500/10 font-semibold text-zinc-100"
                        : "text-zinc-500 hover:bg-zinc-800/40 hover:text-white"
                    }`}
                    title={opt.label}
                  >
                    {opt.short}
                  </button>
                ))}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setExpanded(true)}
              className="shrink-0 rounded-lg border border-zinc-700/70 bg-zinc-950/40 px-2 py-1.5 text-[10px] font-semibold text-zinc-200 transition hover:border-zinc-600 hover:bg-zinc-950/55 sm:px-3 sm:text-[11px]"
            >
              Expand
            </button>
          </div>
        }
        className="relative min-w-0 max-w-full overflow-hidden"
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-sky-500/25 via-[color:var(--accent)]/20 to-transparent" />

        <div className={`mt-3 ${terminalSurface.dashboardListWell}`}>
          <DashboardRefreshBar active={loading && rows.length > 0} />
          <div className="min-h-[20rem] h-[min(34rem,calc(100dvh-12rem))] overflow-y-auto pr-1 no-scrollbar">
            {renderFeedList(true)}
          </div>
        </div>
      </PanelCard>

      {expanded
        ? createPortal(
            <div className="fixed inset-0 z-[60]">
              <div className={terminalUi.portalBackdropDim} aria-hidden />
              <div
                className={terminalUi.portalFrameScroll}
                onClick={(e) => {
                  if (e.target === e.currentTarget) closeExpanded();
                }}
              >
                <div
                  className={`${terminalUi.modalPanel5xl} flex max-h-[min(92dvh,900px)] flex-col`}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className={terminalUi.modalSubHeaderBar}>
                    <div className="min-w-0 flex-1">
                      <p className="inline-flex flex-wrap items-baseline gap-x-1 text-xs font-semibold">
                        <span className="text-zinc-200">Social Feed</span>
                        <span className="text-zinc-600" aria-hidden>
                          ·
                        </span>
                        <span className="tabular-nums text-emerald-400/95 drop-shadow-[0_0_10px_rgba(52,211,153,0.55)]">
                          Live
                        </span>
                      </p>
                      <p className="mt-0.5 text-[11px] text-zinc-500">
                        Curated posts{canRequestSource ? " · suggest a new source with the button" : ""}
                        {isAdmin ? (
                          <>
                            {" "}
                            ·{" "}
                            <Link
                              href="/admin/social-feed"
                              className="text-zinc-400 underline-offset-2 hover:text-zinc-200 hover:underline"
                            >
                              Manage sources (admin)
                            </Link>
                          </>
                        ) : null}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                      {canRequestSource ? (
                        <button
                          type="button"
                          onClick={() => {
                            setSubmitErr(null);
                            setSubmitOk(null);
                            setSubmitOpen(true);
                          }}
                          className="rounded-lg border border-emerald-500/35 bg-emerald-500/10 px-3 py-1.5 text-[11px] font-semibold text-emerald-100 transition hover:bg-emerald-500/20"
                        >
                          + Submit Source
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => closeExpanded()}
                        className="rounded-lg border border-zinc-700/70 bg-zinc-950/40 px-3 py-1.5 text-[11px] font-semibold text-zinc-200 transition hover:border-zinc-600 hover:bg-zinc-950/55"
                      >
                        Close
                      </button>
                    </div>
                  </div>

                  <div className="flex min-w-0 flex-nowrap items-center gap-2 overflow-x-auto border-b border-zinc-800/70 px-4 py-2.5 no-scrollbar">
                    <span className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                      Filter
                    </span>
                    <div className="flex shrink-0 flex-nowrap items-center gap-1 rounded-lg border border-zinc-800/70 bg-zinc-900/35 p-1">
                      <button
                        type="button"
                        onClick={() => setTab("all")}
                        className={`shrink-0 rounded-md px-2.5 py-1 text-xs transition-all ${
                          tab === "all"
                            ? "border border-zinc-500/30 bg-zinc-500/10 font-semibold text-zinc-100"
                            : "text-zinc-500 hover:bg-zinc-800/40 hover:text-white"
                        }`}
                      >
                        All
                      </button>
                      {SOCIAL_FEED_CATEGORY_OPTIONS.filter((o) => o.inFeedTabs).map((opt) => (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => setTab(opt.id)}
                          className={`max-w-[8rem] shrink-0 truncate rounded-md px-2.5 py-1 text-xs transition-all ${
                            tab === opt.id
                              ? "border border-zinc-500/30 bg-zinc-500/10 font-semibold text-zinc-100"
                              : "text-zinc-500 hover:bg-zinc-800/40 hover:text-white"
                          }`}
                          title={opt.label}
                        >
                          {opt.short}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div
                    className={`min-h-0 flex-1 overflow-y-auto p-3 sm:p-4 ${terminalChrome.scrollYHidden}`}
                  >
                    <div className={`${terminalSurface.dashboardListWell}`}>
                      <DashboardRefreshBar active={loading && rows.length > 0} />
                      {renderFeedList(false)}
                    </div>
                  </div>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}

      {submitOpen
        ? createPortal(
            <div
              className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 px-4 py-6"
              role="presentation"
              onMouseDown={(e) => {
                if (e.target === e.currentTarget) setSubmitOpen(false);
              }}
            >
              <div
                className={terminalUi.modalPanelLg2xl}
                onMouseDown={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-label="Submit social feed source"
              >
                <div className="flex items-start justify-between gap-3 border-b border-zinc-800/70 pb-3">
                  <div>
                    <p className="text-sm font-semibold text-zinc-100">Submit a source</p>
                    <p className="mt-0.5 text-xs text-zinc-500">
                      {isAdmin
                        ? "As an admin, submitting here adds the account to the live feed immediately."
                        : "Requests are reviewed before accounts appear in the live feed."}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSubmitOpen(false)}
                    className={terminalUi.modalCloseIconBtn}
                    aria-label="Close"
                  >
                    ×
                  </button>
                </div>

                <div className="mt-4 grid gap-3">
                  {submitErr ? <p className="text-xs text-red-300/90">{submitErr}</p> : null}
                  {submitOk ? <p className="text-xs text-emerald-300/90">{submitOk}</p> : null}

                  <label className="block text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                    Source name
                    <input
                      value={submitSourceName}
                      onChange={(e) => setSubmitSourceName(e.target.value)}
                      disabled={submitBusy}
                      placeholder="e.g. Project or person name"
                      className={`${terminalUi.formInput} mt-1`}
                    />
                  </label>

                  <label className="block text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                    Category
                    <select
                      value={submitCategorySlug}
                      onChange={(e) =>
                        setSubmitCategorySlug(e.target.value as SocialFeedCategorySlug)
                      }
                      disabled={submitBusy}
                      className={`${terminalUi.formInput} mt-1`}
                    >
                      {SOCIAL_FEED_CATEGORY_OPTIONS.map((opt) => (
                        <option key={opt.id} value={opt.id}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  {submitCategorySlug === "other" ? (
                    <label className="block text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                      Describe “other”
                      <input
                        value={submitCategoryOther}
                        onChange={(e) => setSubmitCategoryOther(e.target.value)}
                        disabled={submitBusy}
                        placeholder="e.g. Ecosystem fund, regional desk"
                        className={`${terminalUi.formInput} mt-1`}
                      />
                    </label>
                  ) : null}

                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="block text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                      Platform
                      <select
                        value={submitPlatform}
                        onChange={(e) => setSubmitPlatform(e.target.value as SocialPlatform)}
                        disabled={submitBusy}
                        className={`${terminalUi.formInput} mt-1`}
                      >
                        <option value="x">X</option>
                        <option value="instagram">Instagram</option>
                      </select>
                    </label>
                    <label className="block text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                      Handle
                      <input
                        value={submitHandle}
                        onChange={(e) =>
                          setSubmitHandle(normalizeSocialSourceHandleInput(e.target.value))
                        }
                        onFocus={() => {
                          if (!submitHandle) setSubmitHandle("@");
                        }}
                        disabled={submitBusy}
                        placeholder="username"
                        className={`${terminalUi.formInput} mt-1`}
                        autoComplete="off"
                      />
                    </label>
                  </div>

                  <label className="block text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                    Why add this to the feed?
                    <span className="ml-1 font-normal normal-case text-zinc-600">
                      (min. {submitRationaleMinLen} characters{isAdmin ? " for admin add" : ""})
                    </span>
                    <textarea
                      value={submitRationale}
                      onChange={(e) => setSubmitRationale(e.target.value)}
                      disabled={submitBusy}
                      rows={4}
                      placeholder="Short note for reviewers (signal quality, relevance, etc.)"
                      className={`${terminalUi.formInput} mt-1 min-h-[5.5rem] resize-y`}
                    />
                    <span
                      className={`mt-1 block text-[11px] tabular-nums ${
                        submitRationale.trim().length >= submitRationaleMinLen
                          ? "text-zinc-600"
                          : "text-amber-300/90"
                      }`}
                    >
                      {submitRationale.trim().length}/{submitRationaleMinLen}
                      {submitRationale.trim().length < submitRationaleMinLen
                        ? " — a bit more detail unlocks the button."
                        : " — ready to submit."}
                    </span>
                  </label>

                  <div className="flex flex-wrap items-center justify-end gap-2 border-t border-zinc-800/70 pt-3">
                    <button
                      type="button"
                      onClick={() => setSubmitOpen(false)}
                      className={terminalUi.secondaryButtonSm}
                      disabled={submitBusy}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={
                        submitBusy ||
                        !socialSourceHandleHasName(submitHandle) ||
                        !submitSourceName.trim() ||
                        (submitCategorySlug === "other" && submitCategoryOther.trim().length < 2) ||
                        submitRationale.trim().length < submitRationaleMinLen
                      }
                      onClick={() => {
                        void (async () => {
                          if (submitBusy) return;
                          setSubmitBusy(true);
                          setSubmitErr(null);
                          setSubmitOk(null);
                          try {
                            const res = await fetch("/api/social-sources", {
                              method: "POST",
                              credentials: "same-origin",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({
                                platform: submitPlatform,
                                handle: submitHandle,
                                displayName: submitSourceName,
                                categorySlug: submitCategorySlug,
                                categoryOther:
                                  submitCategorySlug === "other"
                                    ? submitCategoryOther.trim()
                                    : null,
                                rationale: submitRationale,
                              }),
                            });
                            const json = (await res.json().catch(() => null)) as {
                              success?: boolean;
                              error?: string;
                              mode?: string;
                              alreadyPending?: boolean;
                              updated?: boolean;
                            } | null;
                            if (!res.ok || !json || json.success !== true) {
                              setSubmitErr(
                                typeof json?.error === "string" ? json.error : "Request failed."
                              );
                              return;
                            }
                            if (json.mode === "added") {
                              setSubmitOk(
                                json.updated
                                  ? "Updated and live in the feed."
                                  : "Added to the live feed."
                              );
                            } else {
                              setSubmitOk(
                                json.alreadyPending
                                  ? "This handle is already pending review."
                                  : "Submitted — thanks. The team will review it."
                              );
                            }
                            setSubmitHandle("");
                            setSubmitSourceName("");
                            setSubmitCategorySlug("crypto");
                            setSubmitCategoryOther("");
                            setSubmitRationale("");
                          } catch {
                            setSubmitErr("Request failed.");
                          } finally {
                            setSubmitBusy(false);
                          }
                        })();
                      }}
                      className="rounded-lg bg-[color:var(--accent)] px-4 py-2 text-xs font-semibold text-black shadow-lg shadow-black/40 transition hover:bg-green-500 disabled:opacity-50"
                    >
                      {submitBusy ? "Sending…" : isAdmin ? "Add to live feed" : "Send request"}
                    </button>
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
          <div className="flex items-center gap-1 rounded-lg border border-zinc-800/70 bg-zinc-900/35 p-1">
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
          <div className="flex items-center gap-1 rounded-lg border border-zinc-800/70 bg-zinc-900/35 p-1">
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

      <div
        className={`mt-3 rounded-xl border border-zinc-900 bg-zinc-950/40 p-2 ${terminalSurface.insetEdgeSoft}`}
      >
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
                    className="group w-full rounded-lg border border-zinc-800/90 bg-zinc-900/20 px-3 py-2 text-left transition-colors hover:bg-zinc-900/35 focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]/25"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-zinc-800/70 bg-zinc-950 text-xs font-semibold text-zinc-200">
                            {i + 1}
                          </span>
                          <span className="truncate text-sm font-semibold text-zinc-100">
                            {row.symbol}
                          </span>
                          <span className="rounded-full border border-zinc-800/70 bg-zinc-900/30 px-2 py-0.5 text-[10px] font-semibold text-zinc-400">
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
  /** Avoid rank / calls “skeleton flash” on `homeDataRefreshNonce` background refetch. */
  const leaderboardRankBootstrapUserRef = useRef<string | null>(null);
  /** Same idea as rank: keep Top Performers layout stable on periodic refresh (don’t collapse to “Loading…”). */
  const topPerformersBootstrapUserRef = useRef<string | null>(null);
  /** Latest full `mode=all` activity — used for feed filters + notification diffing. */
  const activityAllSnapshotRef = useRef<ActivityItem[]>([]);
  const [copied, setCopied] = useState(false);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsRefreshing, setStatsRefreshing] = useState(false);
  const [stats, setStats] = useState<MeStats | null>(null);
  const [recentCalls, setRecentCalls] = useState<RecentCallRow[]>([]);
  const recentCallsRef = useRef<RecentCallRow[]>([]);
  recentCallsRef.current = recentCalls;
  const [callsLoading, setCallsLoading] = useState(true);
  const [callsRefreshing, setCallsRefreshing] = useState(false);
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
  const [alertsModalOpen, setAlertsModalOpen] = useState(false);
  const [watchlistPrivate, setWatchlistPrivate] = useState<string[]>([]);
  const [watchlistPublic, setWatchlistPublic] = useState<string[]>([]);
  const [watchlistLoading, setWatchlistLoading] = useState(true);
  const [watchlistUpdatedAt, setWatchlistUpdatedAt] = useState<number | null>(null);
  const [watchlistRefreshNonce, setWatchlistRefreshNonce] = useState(0);
  const [submitCallValue, setSubmitCallValue] = useState("");
  const [submitCallSubmitting, setSubmitCallSubmitting] = useState(false);
  const [submitCallFeedback, setSubmitCallFeedback] = useState<
    "success" | "already_exists" | null
  >(null);
  /** Bumps after submit-call success so stats / lists refetch without a full page reload. */
  const [homeDataRefreshNonce, setHomeDataRefreshNonce] = useState(0);
  const { helpTier } = useDashboardHelpRole();
  const [referralVanityForHome, setReferralVanityForHome] = useState<string | null>(null);

  useEffect(() => {
    if (status !== "authenticated" || !session?.user?.id?.trim()) {
      setReferralVanityForHome(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/me/referral-slug", { credentials: "same-origin" });
        const j = (await res.json().catch(() => ({}))) as Record<string, unknown>;
        if (cancelled || !res.ok) return;
        const s =
          typeof j.referral_slug === "string" && j.referral_slug.trim()
            ? j.referral_slug.trim().toLowerCase()
            : null;
        if (!cancelled) setReferralVanityForHome(s);
      } catch {
        if (!cancelled) setReferralVanityForHome(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [status, session?.user?.id]);

  /** Refetch stats / charts / rank while monitoring updates Supabase in the background. */
  useEffect(() => {
    if (status !== "authenticated" || !session?.user?.id?.trim()) return;
    const id = window.setInterval(() => {
      setHomeDataRefreshNonce((n) => n + 1);
    }, 20_000);
    return () => window.clearInterval(id);
  }, [status, session?.user?.id]);

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

  const loadActivity = useCallback(() => {
    void (async () => {
      try {
        const res = await fetch("/api/activity?mode=all");
        const data: unknown = await res.json();
        if (!Array.isArray(data)) {
          activityAllSnapshotRef.current = [];
          setActivity([]);
          return;
        }
        const parsedAll: ActivityItem[] = [];
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
          const csRaw = o.callSource ?? o.source;
          const callSource =
            typeof csRaw === "string" && csRaw.trim() !== ""
              ? csRaw.trim().toLowerCase()
              : undefined;
          const outsideIdRaw = o.outside_call_id ?? o.outsideCallId;
          const outsideCallId =
            typeof outsideIdRaw === "string" && outsideIdRaw.trim() !== ""
              ? outsideIdRaw.trim()
              : undefined;
          parsedAll.push({
            type: o.type,
            text,
            callSource,
            username,
            displayName,
            userAvatarUrl,
            time: o.time,
            link_chart,
            link_post,
            multiple,
            discordId,
            tokenImageUrl,
            outsideCallId,
          });
        }

        const uid = session?.user?.id?.trim() ?? "";
        const notificationFilter = uid ? await fetchNotificationFilter(uid) : null;

        const prevFull = activityAllSnapshotRef.current;
        processActivityNotifications(
          prevFull,
          parsedAll,
          addNotification,
          lastSeenActivityKeysRef,
          notificationFilter
        );
        activityAllSnapshotRef.current = parsedAll;

        const displayed = filterActivityForFeed(parsedAll, feedMode, uid, followingIds);
        setActivity(displayed);
      } catch {
        activityAllSnapshotRef.current = [];
        setActivity([]);
      } finally {
        setLoadingActivity(false);
      }
    })();
  }, [addNotification, feedMode, followingIds, session?.user?.id]);

  useEffect(() => {
    const full = activityAllSnapshotRef.current;
    if (full.length === 0) return;
    const uid = session?.user?.id?.trim() ?? "";
    setActivity(filterActivityForFeed(full, feedMode, uid, followingIds));
  }, [feedMode, followingIds, session?.user?.id]);

  const nowMs = Date.now();

  useEffect(() => {
    if (!session?.user?.id?.trim()) return;

    let cancelled = false;
    if (stats === null) setStatsLoading(true);
    // Only show a refresh “pulse” if values actually change.
    setStatsRefreshing(false);

    fetch("/api/me/stats", { credentials: "same-origin", cache: "no-store" })
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
          const nextStats: MeStats = {
            ...o,
            medianX,
            bestX30d,
            hitRate2x30d,
            callsPriorRollingDay,
            activeDaysStreak,
          };
          setStats((prev) => {
            if (sameMeStats(prev, nextStats)) return prev;
            setStatsRefreshing(prev !== null);
            return nextStats;
          });
        } else {
          // Avoid UI “blinking” to placeholder zeros during refreshes.
          // Only fall back to zeros if we have never loaded stats successfully.
          setStats((prev) =>
            prev ?? {
              avgX: 0,
              medianX: 0,
              winRate: 0,
              callsToday: 0,
              callsPriorRollingDay: 0,
              activeDaysStreak: 0,
              bestX30d: 0,
              hitRate2x30d: 0,
              totalCalls: 0,
            }
          );
        }
      })
      .catch(() => {
        if (!cancelled) {
          setStats((prev) =>
            prev ?? {
              avgX: 0,
              medianX: 0,
              winRate: 0,
              callsToday: 0,
              callsPriorRollingDay: 0,
              activeDaysStreak: 0,
              bestX30d: 0,
              hitRate2x30d: 0,
              totalCalls: 0,
            }
          );
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
  }, [session?.user?.id, homeDataRefreshNonce]);

  useEffect(() => {
    if (!session?.user?.id?.trim()) {
      setCallsLoading(false);
      setCallsRefreshing(false);
      setRecentCalls([]);
      return;
    }

    let cancelled = false;
    setCallsRefreshing(true);
    if (recentCallsRef.current.length === 0) {
      setCallsLoading(true);
    }

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
        if (!cancelled) {
          setCallsLoading(false);
          setCallsRefreshing(false);
        }
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
  }, [addWatchlistOpen, session?.user?.id, watchlistRefreshNonce]);

  useEffect(() => {
    if (!session?.user?.id?.trim()) {
      setTopPerformersToday([]);
      setTopPerformersLoading(false);
      topPerformersBootstrapUserRef.current = null;
      return;
    }

    const uid = session.user.id.trim();
    let cancelled = false;
    const firstFetchForUser = topPerformersBootstrapUserRef.current !== uid;
    if (firstFetchForUser) {
      topPerformersBootstrapUserRef.current = uid;
      setTopPerformersLoading(true);
    }

    fetch("/api/leaderboard?type=user&period=rolling24h")
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
      leaderboardRankBootstrapUserRef.current = null;
      return;
    }

    const uid = session.user.id.trim();
    let cancelled = false;
    const firstFetchForUser = leaderboardRankBootstrapUserRef.current !== uid;
    if (firstFetchForUser) {
      leaderboardRankBootstrapUserRef.current = uid;
      setYourRankLoading(true);
    }

    fetch("/api/me/leaderboard-rank", { credentials: "same-origin", cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((json: unknown) => {
        if (cancelled || !json || typeof json !== "object") {
          // Keep previous rank if refresh fails; don’t “blink” to null.
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
          const next =
            rank !== null && Number.isFinite(rank) && rank > 0 ? rank : null;
          setYourWeekRank((prev) => (prev === next ? prev : next));
        }
      })
      .catch(() => {
        // Keep previous rank if refresh fails; don’t “blink” to null.
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

  const referralIdUrl =
    session?.user?.id != null && session.user.id !== ""
      ? `${REF_BASE}/${session.user.id}`
      : "";
  const referralUrl =
    referralVanityForHome && referralVanityForHome.length > 0
      ? `${REF_BASE}/${referralVanityForHome}`
      : referralIdUrl;

  const activityPopupItem = useMemo((): ActivityPopupItem | null => {
    if (!selectedActivity) return null;
    const contractAddress = resolveActivityMint(selectedActivity);
    const tokenTicker = parseActivityChartTicker(
      selectedActivity.text,
      selectedActivity.type
    );
    const tokenName =
      selectedActivity.type === "call"
        ? parseCallTokenDisplayNameFromActivityText(selectedActivity.text)
        : null;
    return {
      text: selectedActivity.text,
      contractAddress,
      tokenImageUrl: selectedActivity.tokenImageUrl ?? null,
      tokenTicker,
      tokenName,
      xPostUrl: selectedActivity.link_post,
    };
  }, [selectedActivity]);

  const handleActivityViewChart = useCallback(
    (args: {
      contractAddress: string;
      tokenTicker?: string | null;
      tokenName?: string | null;
      tokenImageUrl?: string | null;
    }) => {
      const rawTick = String(args.tokenTicker ?? "").trim().replace(/^\$/, "");
      const name = String(args.tokenName ?? "").trim();
      const symbolLabel =
        name || (rawTick ? `$${rawTick}` : undefined);
      openTokenChart({
        chain: "solana",
        contractAddress: args.contractAddress,
        symbolLabel,
        tokenTicker: rawTick || null,
        tokenName: name || null,
        tokenImageUrl: args.tokenImageUrl ?? null,
      });
    },
    [openTokenChart]
  );

  const handleActivityAddWatchlist = useCallback(
    async (mint: string) => {
      try {
        const res = await fetch("/api/me/watchlist", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({
            action: "add",
            scope: "private",
            mint: mint.trim(),
          }),
        });
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        if (!res.ok) {
          return {
            ok: false as const,
            error: data.error || `Could not save (${res.status})`,
          };
        }
        setWatchlistRefreshNonce((n) => n + 1);
        return { ok: true as const };
      } catch {
        return { ok: false as const, error: "Network error" };
      }
    },
    []
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

  const personalStatTileClass = `${terminalPage.statTile} flex flex-col gap-1 p-2.5 sm:p-3`;

  const streakDays = stats?.activeDaysStreak;
  const streakBadgeUi = streakBadge(streakDays ?? 0);
  const streakValue =
    stats === null ? (
      <div className="text-base font-semibold text-zinc-500">—</div>
    ) : (streakDays ?? 0) > 0 ? (
      <div>
        <div className="inline-flex items-center gap-2 text-sm font-semibold text-zinc-100">
          <span
            className={`${streakBadgeUi.className ?? ""} text-base leading-none`}
            aria-hidden
          >
            {streakBadgeUi.emoji}
          </span>
          <span>{streakDays} day streak</span>
        </div>
        <div className="mt-0.5 text-[10px] text-zinc-500">Active days</div>
      </div>
    ) : (
      <div>
        <div className="inline-flex items-center gap-2 text-sm font-semibold text-zinc-300">
          <span
            className={`${streakBadgeUi.className ?? ""} text-base leading-none`}
            aria-hidden
          >
            {streakBadgeUi.emoji}
          </span>
          <span>No streak yet</span>
        </div>
        <div className="mt-0.5 text-[10px] text-zinc-500">Call today to start one</div>
      </div>
    );

  // TODO: add badges next to usernames
  // TODO: allow widget resizing / layout control
  // TODO: move referral link under banner

  const showRankWidget = widgetEnabled(widgets, "rank");
  const showTrendingWidget = widgetEnabled(widgets, "trending");

  const quickActionsBlock = widgetEnabled(widgets, "quick_actions") ? (
    <PanelCard title="Quick Actions" data-tutorial="dashboard.quickActions">
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
            className="flex items-center justify-center rounded-lg border border-zinc-800/90 bg-zinc-950 px-3 py-2 text-center text-sm font-semibold text-zinc-100 transition hover:border-zinc-700/80 hover:bg-zinc-900/30 focus:outline-none focus:ring-2 focus:ring-[color:var(--accent)]/20"
          >
            My Profile
          </Link>
          <button
            type="button"
            onClick={() => setAddWatchlistOpen(true)}
            data-tutorial="dashboard.quickActions.watchlist"
            className="flex items-center justify-center rounded-lg border border-zinc-800/90 bg-zinc-950 px-3 py-2 text-center text-sm font-semibold text-zinc-100 transition hover:border-zinc-700/80 hover:bg-zinc-900/30 focus:outline-none focus:ring-2 focus:ring-[color:var(--accent)]/20"
          >
            Watchlist
          </button>
          <button
            type="button"
            onClick={() => setAlertsModalOpen(true)}
            data-tutorial="dashboard.quickActions.createAlert"
            className="rounded-lg border border-zinc-800/90 bg-zinc-950 px-3 py-2 text-sm font-semibold text-zinc-100 transition hover:border-zinc-700/80 hover:bg-zinc-900/30 focus:outline-none focus:ring-2 focus:ring-[color:var(--accent)]/20"
          >
            Create Alert
          </button>
          <Link
            href="/referrals"
            data-tutorial="dashboard.quickActions.referrals"
            className="flex items-center justify-center rounded-lg border border-zinc-800/90 bg-zinc-950 px-3 py-2 text-center text-sm font-semibold text-zinc-100 transition hover:border-zinc-700/80 hover:bg-zinc-900/30 focus:outline-none focus:ring-2 focus:ring-[color:var(--accent)]/20"
          >
            Referrals
          </Link>
        </div>

        <button
          type="button"
          onClick={handleCopy}
          disabled={!referralUrl}
          className="w-full rounded-lg border border-zinc-800/90 bg-zinc-950 px-4 py-2.5 text-sm font-semibold text-zinc-100 transition hover:border-zinc-700/80 hover:bg-zinc-900/30 focus:outline-none focus:ring-2 focus:ring-[color:var(--accent)]/20 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {copied ? "Referral Link Copied" : "Copy Referral Link"}
        </button>
      </div>
    </PanelCard>
  ) : null;

  return (
    <div className="contents">
      <HodlDashboardDock />
      <div
        className="mx-auto w-full min-w-0 max-w-[1200px] overflow-x-hidden px-3 sm:px-4 md:px-0"
        data-tutorial="dashboard.tutorialWelcome"
      >
      <div className="space-y-8" data-tutorial="dashboard.pageIntro">
      <div className="mb-8" data-tutorial="dashboard.performanceChart">
        <PerformanceChart refreshNonce={homeDataRefreshNonce} />
      </div>

      {quickActionsBlock ? (
        <div className="mb-8 lg:hidden">{quickActionsBlock}</div>
      ) : null}

      <section className="mb-8 min-w-0 space-y-4 overflow-x-hidden" data-tutorial="dashboard.personalStats">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className={terminalPage.sectionTitle}>
              Personal Stats
            </h2>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--accent)]/25 bg-[color:var(--accent)]/10 px-2 py-0.5 text-[11px] font-semibold tracking-wide text-[color:var(--accent)]">
              <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--accent)]" aria-hidden />
              LIVE
            </span>
          </div>
          <p className={terminalPage.sectionHint}>
            Key metrics from your recent activity.
          </p>
        </div>
        <div
          className={`rounded-xl border border-zinc-900 bg-zinc-950/40 p-2.5 sm:p-3.5 ${smoothClass(
            statsRefreshing || statsLoading
          )}`}
        >
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,2fr)_auto_minmax(0,1fr)] lg:items-stretch">
            <div className="grid min-w-0 grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 md:grid-cols-4">
              <div className={personalStatTileClass}>
                <div className="text-[10px] font-semibold tracking-wide text-zinc-300">
                  AVG X
                </div>
                <div className="text-2xl font-bold tabular-nums tracking-tight text-[color:var(--accent)]">
                  {stats === null ? "—" : `${stats.avgX.toFixed(1)}x`}
                </div>
                <div className="line-clamp-2 text-[10px] leading-snug text-zinc-500">
                  Mean ATH multiple since your calls (peak ÷ entry MC)
                </div>
              </div>

              <div className={personalStatTileClass}>
                <div className="text-[10px] font-semibold tracking-wide text-zinc-300">
                  WIN RATE
                </div>
                <div className="text-2xl font-bold tabular-nums tracking-tight text-[color:var(--accent)]">
                  {stats === null || (stats.totalCalls ?? 0) <= 0 ? "—" : `${stats.winRate.toFixed(0)}%`}
                </div>
              </div>

              <div className={personalStatTileClass}>
                <div className="text-[10px] font-semibold tracking-wide text-zinc-300">
                  STREAK
                </div>
                <div>
                  {streakValue}
                </div>
              </div>

              <div className={personalStatTileClass}>
                <div className="text-[10px] font-semibold tracking-wide text-zinc-300">
                  TOTAL CALLS
                </div>
                <div className="text-2xl font-bold tabular-nums text-[color:var(--accent)]">
                  {stats === null ? "—" : stats.totalCalls.toLocaleString("en-US")}
                </div>
                <div className="text-[10px] text-zinc-500">All time</div>
              </div>

              <div className={personalStatTileClass}>
                <div className="text-[10px] font-semibold tracking-wide text-zinc-300">
                  MEDIAN X
                </div>
                <div className="text-2xl font-bold tabular-nums text-[color:var(--accent)]">
                  {stats === null || (stats.medianX ?? 0) <= 0
                    ? "—"
                    : `${(stats.medianX ?? 0).toFixed(1)}x`}
                </div>
              </div>

              <div className={personalStatTileClass}>
                <div className="text-[10px] font-semibold tracking-wide text-zinc-300">
                  2X HIT (30D)
                </div>
                <div className="text-2xl font-bold tabular-nums text-[color:var(--accent)]">
                  {stats === null || (stats.bestX30d ?? 0) <= 0
                    ? "—"
                    : `${Math.round(stats.hitRate2x30d ?? 0)}%`}
                </div>
              </div>

              <div className={personalStatTileClass}>
                <div className="text-[10px] font-semibold tracking-wide text-zinc-300">
                  BEST X (30D)
                </div>
                <div className="text-2xl font-bold tabular-nums text-[color:var(--accent)]">
                  {stats === null || (stats.bestX30d ?? 0) <= 0
                    ? "—"
                    : `${(stats.bestX30d ?? 0).toFixed(1)}x`}
                </div>
              </div>

              <div className={personalStatTileClass}>
                <div className="text-[10px] font-semibold tracking-wide text-zinc-300">
                  LAST CALL
                </div>
                <div className="flex min-w-0 items-start justify-between gap-3">
                  <div
                    className="min-w-0 flex-1 truncate text-[13px] font-medium text-zinc-200"
                    title={
                      recentCalls.length === 0
                        ? undefined
                        : homeLastCallHeadline(recentCalls[0])
                    }
                  >
                    {recentCalls.length === 0 ? "—" : homeLastCallHeadline(recentCalls[0])}
                  </div>
                  {(() => {
                    if (recentCalls.length === 0) return null;
                    const c = recentCalls[0]!;
                    const src =
                      resolveTokenAvatarUrl({ tokenImageUrl: c.tokenImageUrl, mint: c.token }) ??
                      null;
                    if (!src) return null;
                    // eslint-disable-next-line @next/next/no-img-element
                    return (
                      <img
                        src={src}
                        alt=""
                        className="h-11 w-11 shrink-0 rounded-xl border border-zinc-700/50 object-cover shadow-md shadow-black/50 ring-1 ring-white/[0.04]"
                        loading="lazy"
                        referrerPolicy="no-referrer"
                      />
                    );
                  })()}
                </div>
                <div className="text-2xl font-bold tabular-nums text-[color:var(--accent)]">
                  {recentCalls.length === 0
                    ? "—"
                    : `${recentCalls[0].multiple.toFixed(1)}x`}
                </div>
                <div className="text-[10px] text-zinc-500">
                  {recentCalls.length === 0
                    ? callsLoading
                      ? "Loading recent calls…"
                      : "Waiting for your first call"
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

      <div className="mb-6 grid min-w-0 max-w-full grid-cols-1 gap-4 overflow-x-hidden lg:grid-cols-[minmax(0,1fr)_minmax(280px,20rem)] lg:items-start">
        <div className="flex min-w-0 max-w-full flex-col gap-5 overflow-x-hidden">
          <div data-tutorial="dashboard.activityFeed">
          {widgetEnabled(widgets, "activity") && (
            <div className="min-h-[420px] min-w-0 max-w-full overflow-x-hidden">
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

          {widgets !== null && widgetEnabled(widgets, "discord_chat") && (
            <div data-tutorial="dashboard.discordChat">
              <DashboardChatPanel feed="dashboard" dashboardChannel="general" pollMs={12000} />
            </div>
          )}
        </div>

        <div
          className="flex min-w-0 max-w-full flex-col gap-4 overflow-x-hidden lg:sticky lg:top-24 lg:z-10 lg:self-start"
          data-tutorial="dashboard.sidebarColumn"
        >
          {quickActionsBlock ? <div className="hidden lg:block">{quickActionsBlock}</div> : null}

          {(helpTier === "mod" || helpTier === "admin") && (
            <ModQueueHomePanel hideWhenEmpty />
          )}

          <PanelCard
            title="Watchlist"
            titleClassName="normal-case"
            data-tutorial="dashboard.homeWatchlist"
            className="min-w-0 max-w-full overflow-hidden"
          >
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
            <div className={`mt-2 ${terminalSurface.dashboardListWell}`}>
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
                        className="group flex items-center justify-between gap-3 rounded-lg border border-zinc-800/90 bg-zinc-900/20 px-3 py-2 text-left transition-colors hover:bg-zinc-900/35 focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]/25"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-zinc-100">
                              {shortenCa(ca)}
                            </span>
                            <span className="rounded-full border border-zinc-800/70 bg-zinc-900/30 px-2 py-0.5 text-[10px] font-semibold text-zinc-400">
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

          {showTrendingWidget ? <TrendingPanel /> : null}

          <div data-tutorial="dashboard.homeRecentCalls">
          {widgetEnabled(widgets, "recent_calls") ? (
            <PanelCard
              titleSlotWide
              title={<span className="text-zinc-100">Your Recent Calls</span>}
              titleClassName="normal-case"
              titleRight={
                <Link
                  href="/calls"
                  className="shrink-0 rounded-md border border-zinc-800/80 bg-transparent px-2.5 py-1 text-[11px] font-semibold text-zinc-500 transition hover:border-zinc-600/80 hover:bg-zinc-900/25 hover:text-zinc-200"
                >
                  Full log →
                </Link>
              }
              className="min-w-0 max-w-full overflow-hidden"
            >
              {callsLoading && recentCalls.length === 0 ? (
                <div className={`mt-3 ${terminalSurface.dashboardListWell}`}>
                  <HomeRecentCallsSkeleton />
                </div>
              ) : recentCalls.length === 0 ? (
                <div className="mt-3 flex min-h-[5.5rem] flex-col items-center justify-center rounded-xl border border-dashed border-zinc-800/60 bg-zinc-950/20 px-3 py-8 text-center">
                  <p className="text-sm font-medium text-zinc-300">No calls yet</p>
                  <p className="mt-1 max-w-[14rem] text-xs leading-relaxed text-zinc-500">
                    Verified rows show here after you log calls from the terminal.
                  </p>
                </div>
              ) : (
                <div className={`mt-3 ${terminalSurface.dashboardListWell}`}>
                  <DashboardRefreshBar active={callsRefreshing && recentCalls.length > 0} />
                  <ul className="divide-y divide-zinc-800/45">
                    {recentCalls.slice(0, 6).map((call, i) => {
                      const tMs = callTimeMs(call.time);
                      const timeFull = formatJoinedAt(tMs, nowMs);
                      const timeShort = formatJoinedAt(tMs, nowMs, "compact");
                      const summary = homeRecentCallSummary(call);
                      return (
                        <li key={`${call.token}-${String(call.time)}-${i}`}>
                          <div className="flex items-center gap-2 py-2 pl-1 pr-1 sm:gap-2.5 sm:py-2 sm:pl-1.5 sm:pr-2">
                            {call.tokenImageUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={call.tokenImageUrl}
                                alt=""
                                className="h-8 w-8 shrink-0 rounded-lg border border-zinc-800/70 bg-zinc-950 object-cover ring-1 ring-black/20"
                                loading="lazy"
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              <span
                                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-zinc-800/70 bg-zinc-900/80 text-[10px] font-bold text-zinc-500"
                                aria-hidden
                              >
                                —
                              </span>
                            )}
                            <p
                              className="min-w-0 flex-1 truncate text-[13px] font-medium leading-snug text-zinc-100"
                              title={summary}
                            >
                              {summary}
                            </p>
                            <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
                              {call.excludedFromStats ? (
                                <span
                                  className="max-w-[2.75rem] truncate rounded border border-red-500/25 bg-red-500/10 px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-red-200/90"
                                  title="Excluded from stats"
                                >
                                  Excl.
                                </span>
                              ) : null}
                              <span
                                className={`rounded-md border border-zinc-800/80 bg-black/30 px-2 py-0.5 text-xs font-bold tabular-nums shadow-inner shadow-black/20 ${multipleClass(
                                  call.multiple
                                )}`}
                              >
                                {call.multiple.toFixed(1)}×
                              </span>
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
                                className="rounded-md border border-emerald-500/25 bg-emerald-500/5 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-300/95 transition hover:border-emerald-400/45 hover:bg-emerald-500/15"
                                title="Live chart (TradingView)"
                              >
                                Chart
                              </button>
                              <time
                                className="w-9 shrink-0 text-right text-[10px] font-medium tabular-nums text-zinc-500 sm:w-11 sm:text-[11px]"
                                dateTime={Number.isFinite(tMs) && tMs > 0 ? new Date(tMs).toISOString() : undefined}
                                title={timeFull}
                              >
                                {timeShort}
                              </time>
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
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
        item={activityPopupItem}
        onClose={() => setSelectedActivity(null)}
        onViewChart={handleActivityViewChart}
        onAddToPrivateWatchlist={handleActivityAddWatchlist}
      />

      <AddToWatchlistModal
        open={addWatchlistOpen}
        onClose={() => setAddWatchlistOpen(false)}
      />

      <DashboardAlertsModal
        open={alertsModalOpen}
        onClose={() => setAlertsModalOpen(false)}
        addNotification={addNotification}
      />

      {submitCallOpen ? (
        <div
          className={terminalUi.modalBackdropCenterZ50}
          role="dialog"
          aria-modal="true"
          aria-label="Submit call"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setSubmitCallOpen(false);
          }}
        >
          <div className={terminalUi.dialogPanelCompact}>
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
                className={terminalUi.modalCloseIconBtn}
                aria-label="Close"
                disabled={submitCallSubmitting}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-4 w-4"
                  aria-hidden
                >
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
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
                  className={`min-w-0 flex-1 ${terminalUi.formInput}`}
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
                  className="shrink-0 rounded-lg border border-zinc-800/90 bg-zinc-950 px-3 text-xs font-semibold text-zinc-200 transition hover:border-zinc-700/80 hover:bg-zinc-900/30 focus:outline-none focus:ring-2 focus:ring-[color:var(--accent)]/20 disabled:opacity-60"
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
                  className={terminalUi.secondaryButtonSm}
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
    </div>
  );
}
