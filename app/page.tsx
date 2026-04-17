"use client";

import type { WidgetsEnabled } from "@/app/api/dashboard-settings/route";
import {
  useNotifications,
  type NotificationPriority,
} from "@/app/contexts/NotificationsContext";
import { ActivityPopup } from "./components/ActivityPopup";
import { FollowButton } from "./components/FollowButton";
import { UserBadgeIcons } from "./components/UserBadgeIcons";
import LiveTrackedCallsPanel from "@/components/LiveTrackedCallsPanel";
import PerformanceChart from "@/components/dashboard/PerformanceChart";
import { useFollowingIds } from "./hooks/useFollowingIds";
import Link from "next/link";
import { signIn, useSession } from "next-auth/react";
import { callTimeMs, formatJoinedAt, multipleClass } from "@/lib/callDisplayFormat";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
  type ReactNode,
} from "react";

const REF_BASE = "https://mcgbot.xyz/ref";

const STREAK_COUNT = 2;

/** Mock trending rows; `mint` is a placeholder Solana mint for Dexscreener charts. */
const TRENDING_TOKENS_MOCK = [
  { symbol: "SOLXYZ", stat: 2.4, mint: "So11111111111111111111111111111111111111112" },
  { symbol: "ABC", stat: 1.8, mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v" },
  { symbol: "DEV123", stat: 3.1, mint: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263" },
] as const;

const CARD_HOVER =
  "transition-[box-shadow,border-color,ring-color] duration-200 ease-out hover:border-[#2a2a2a] hover:shadow-lg hover:shadow-black/35 hover:ring-1 hover:ring-[#2a2a2a]/30";

/** Row hover for Top Performers — border + shadow only (no scale / translate). */
const TOP_PERFORMER_ROW_INTERACTIVE =
  "cursor-pointer transition-[border-color,box-shadow] duration-150 hover:border-zinc-500/40 hover:shadow-md hover:shadow-black/25";

const PROFILE_LINK_CLASS =
  "text-[#39FF14] hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[#39FF14]/30";

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

type ReferralRow = { userId: string; joinedAt: number };

type MeStats = {
  avgX: number;
  winRate: number;
  callsToday: number;
  totalCalls: number;
};

type RecentCallRow = {
  token: string;
  multiple: number;
  time: unknown;
};

type TopPerformerTodayRow = {
  rank: number;
  discordId: string;
  username: string;
  avgX: number;
  bestMultiple: number;
};

type ActivityItem = {
  type: "win" | "call";
  text: string;
  username: string;
  time: unknown;
  link_chart: string | null;
  link_post: string | null;
  multiple: number;
  discordId: string;
};

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
  const apiName = item.username.trim();
  const name = viewerDisplayName(
    item.discordId,
    item.username,
    viewerId,
    viewerName
  );
  const id = item.discordId.trim();

  if (name && id && item.type === "call") {
    const prefix = "New call by ";
    if (item.text.startsWith(prefix)) {
      return (
        <>
          {prefix}
          <Link
            href={`/user/${encodeURIComponent(id)}`}
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

  if (apiName && id && item.type === "win" && item.text.startsWith(apiName)) {
    const afterName = item.text.slice(apiName.length);
    return (
      <>
        <Link
          href={`/user/${encodeURIComponent(id)}`}
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
  return `${callTimeMs(item.time)}::${item.text}`;
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

function parseReferrals(raw: unknown): ReferralRow[] {
  if (!Array.isArray(raw)) return [];
  const out: ReferralRow[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    const userId = String(r.userId ?? r.referred_user_id ?? "").trim();
    const rawJoined = r.joinedAt ?? r.joined_at;
    let joinedAt = typeof rawJoined === "number" ? rawJoined : Number(rawJoined);
    if (!Number.isFinite(joinedAt) && typeof rawJoined === "string") {
      const p = Date.parse(rawJoined);
      if (Number.isFinite(p)) joinedAt = p;
    }
    if (!userId || !Number.isFinite(joinedAt)) continue;
    out.push({ userId, joinedAt });
  }
  return out;
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
}: {
  title: string;
  children: ReactNode;
  className?: string;
  elevated?: boolean;
  titleClassName?: string;
  /** e.g. `px-5 py-3` for tighter vertical rhythm */
  paddingClassName?: string;
}) {
  const surface = elevated
    ? "border-[#1a1a1a] bg-[#0a0a0a] shadow-md shadow-black/25"
    : "border-[#1a1a1a] bg-[#0a0a0a] shadow-sm shadow-black/20";

  return (
    <div
      className={`rounded-xl border ${paddingClassName} backdrop-blur-sm ${surface} ${CARD_HOVER} ${className}`}
    >
      <h2
        className={`text-sm font-semibold tracking-wide text-zinc-400 ${titleClassName ?? "uppercase"}`}
      >
        {title}
      </h2>
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
  return (
    <PanelCard title="📈 Trending" titleClassName="normal-case">
      <ul className="mt-2 divide-y divide-zinc-800/80 text-[13px] leading-snug">
        {TRENDING_TOKENS_MOCK.map((row) => (
          <li key={row.symbol}>
            <button
              type="button"
              onClick={() =>
                window.open(
                  `https://dexscreener.com/solana/${encodeURIComponent(row.mint)}`,
                  "_blank",
                  "noopener,noreferrer"
                )
              }
              className="flex w-full items-center justify-between gap-3 py-2 text-left transition-colors hover:bg-zinc-800/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/40"
            >
              <span className="min-w-0 truncate font-medium text-zinc-100">
                {row.symbol}
              </span>
              <span className="shrink-0 tabular-nums text-xs font-semibold text-[#39FF14]/90">
                {row.stat.toFixed(1)}x
              </span>
            </button>
          </li>
        ))}
      </ul>
    </PanelCard>
  );
}

function RankPanel({
  yourRankLoading,
  yourWeekRank,
}: {
  yourRankLoading: boolean;
  yourWeekRank: number | null;
}) {
  const [timeframe, setTimeframe] = useState("1D");

  const rankPeriodLabel =
    timeframe === "1D"
      ? "today"
      : timeframe === "1W"
        ? "this week"
        : "this month";

  const comparisonText =
    timeframe === "1D"
      ? "+2 from yesterday"
      : timeframe === "1W"
        ? "+5 from last week"
        : "+12 from last month";

  const emptyRankHint =
    timeframe === "1D"
      ? "No rank today yet — keep calling to climb the daily board."
      : timeframe === "1W"
        ? "No rank this week yet — user calls in the last 7 days earn a spot on the leaderboard."
        : "No rank this month yet — sustained activity over the month counts toward placement.";

  return (
    <PanelCard
      title="Your Rank"
      titleClassName="normal-case"
      className="flex h-full max-w-sm flex-col"
    >
      {/* TODO: connect timeframe to real backend stats */}
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setTimeframe("1D")}
          className={`rounded-lg px-3 py-1.5 text-xs font-semibold tabular-nums transition-colors ${
            timeframe === "1D"
              ? "bg-zinc-700 text-zinc-50 shadow-sm shadow-black/20"
              : "bg-zinc-800/90 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
          }`}
        >
          1D
        </button>
        <button
          type="button"
          onClick={() => setTimeframe("1W")}
          className={`rounded-lg px-3 py-1.5 text-xs font-semibold tabular-nums transition-colors ${
            timeframe === "1W"
              ? "bg-zinc-700 text-zinc-50 shadow-sm shadow-black/20"
              : "bg-zinc-800/90 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
          }`}
        >
          1W
        </button>
        <button
          type="button"
          onClick={() => setTimeframe("1M")}
          className={`rounded-lg px-3 py-1.5 text-xs font-semibold tabular-nums transition-colors ${
            timeframe === "1M"
              ? "bg-zinc-700 text-zinc-50 shadow-sm shadow-black/20"
              : "bg-zinc-800/90 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
          }`}
        >
          1M
        </button>
      </div>
      {yourRankLoading ? (
        <div className="mt-3 flex min-h-[52px] items-center">
          <p className="text-sm text-zinc-500">Loading rank…</p>
        </div>
      ) : yourWeekRank === null ? (
        <p className="mt-3 text-sm leading-relaxed text-zinc-400">{emptyRankHint}</p>
      ) : (
        <div className="mt-3">
          <p className="flex flex-wrap items-baseline gap-x-1.5 gap-y-1 text-sm text-zinc-300">
            <span>You are</span>
            <span className="font-bold tabular-nums text-zinc-50">
              #{yourWeekRank}
            </span>
            <span>{rankPeriodLabel}</span>
            <span
              className="text-base font-light leading-none text-[#39FF14]/70"
              title="Rank change (placeholder)"
              aria-hidden
            >
              ↑
            </span>
          </p>
          <p className="mt-1.5 text-xs text-[#39FF14]/60">{comparisonText}</p>
        </div>
      )}
    </PanelCard>
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
  return (
    <section className="mb-8">
      <PanelCard title="🔥 Top Performers Today" titleClassName="normal-case">
        {topPerformersLoading ? (
          <div className="mt-3 flex min-h-[64px] items-center justify-center">
            <p className="text-sm text-zinc-500">Loading…</p>
          </div>
        ) : topPerformersToday.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-500">
            No calls in the last 24 hours yet.
          </p>
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
                        href={`/user/${encodeURIComponent(row.discordId)}`}
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
  feedMode: "all" | "following";
  setFeedMode: (m: "all" | "following") => void;
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
  return (
    <PanelCard title="Live Activity">
      <div className="mt-2 flex flex-wrap gap-2">
        {(
          [
            { id: "all" as const, label: "All" },
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
      </div>
      {loadingActivity ? (
        <div className="flex min-h-[88px] items-center justify-center py-6">
          <p className="text-sm text-zinc-500">Loading activity...</p>
        </div>
      ) : activity.length === 0 ? (
        <div className="flex min-h-[88px] items-center justify-center py-6">
          <p className="text-sm text-zinc-500">
            {feedMode === "following"
              ? "No activity from people you follow"
              : "No activity yet"}
          </p>
        </div>
      ) : (
        <ul className="mt-2 max-h-[300px] overflow-y-auto pr-1 text-sm">
          {activity.map((item, i) => (
            <li
              key={`${String(item.time)}-${i}-${item.text.slice(0, 24)}`}
              className="dashboard-feed-item border-b border-[#1a1a1a] last:border-b-0"
              style={{ animationDelay: `${i * 70}ms` }}
            >
              <div className="relative">
                <div className="absolute bottom-1 left-0 top-1 w-[2px] rounded-full bg-cyan-400/40" />
                <div className="pl-3">
                  <div className="flex items-start gap-2 rounded-lg px-3 py-2 transition-all duration-150 hover:bg-zinc-800/40">
                    <FollowButton
                      targetDiscordId={item.discordId}
                      following={followingIds.has(item.discordId)}
                      onFollowingChange={(next) => setFollowing(item.discordId, next)}
                      className="mt-0.5"
                    />
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
                            <span className="font-semibold tabular-nums text-[#39FF14]">
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

async function submitCall(ca: string) {
  const res = await fetch("/api/call", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ ca }),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || "Failed to submit call");
  }

  return data;
}

export default function Home() {
  const { data: session, status } = useSession();
  const { addNotification } = useNotifications();
  const lastSeenActivityKeysRef = useRef(new Set<string>());
  const activitySourceModeRef = useRef<"all" | "following" | null>(null);
  const [copied, setCopied] = useState(false);
  const [referrals, setReferrals] = useState<ReferralRow[]>([]);
  const [statsLoading, setStatsLoading] = useState(true);
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
  const [feedMode, setFeedMode] = useState<"all" | "following">("all");
  const [topPerformersToday, setTopPerformersToday] = useState<
    TopPerformerTodayRow[]
  >([]);
  const [topPerformersLoading, setTopPerformersLoading] = useState(true);
  const [yourWeekRank, setYourWeekRank] = useState<number | null>(null);
  const [yourRankLoading, setYourRankLoading] = useState(true);

  const [widgets, setWidgets] = useState<WidgetsEnabled | null>(null);
  const [submitCallOpen, setSubmitCallOpen] = useState(false);
  const [submitCallValue, setSubmitCallValue] = useState("");
  const [submitCallSubmitting, setSubmitCallSubmitting] = useState(false);
  const [submitCallFeedback, setSubmitCallFeedback] = useState<
    "success" | "already_exists" | null
  >(null);

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
        const res = await fetch(
          `/api/activity?mode=${encodeURIComponent(feedMode)}`
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
          parsed.push({
            type: o.type,
            text,
            username,
            time: o.time,
            link_chart,
            link_post,
            multiple,
            discordId,
          });
        }

        const uid = session?.user?.id?.trim() ?? "";
        const notificationFilter =
          uid && feedMode === "all"
            ? await fetchNotificationFilter(uid)
            : null;

        setActivity((prev) => {
          if (feedMode === "all") {
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
  }, [addNotification, feedMode, session?.user?.id]);

  const nowMs = Date.now();
  const displayedReferrals = useMemo(
    () =>
      [...referrals]
        .sort((a, b) => b.joinedAt - a.joinedAt)
        .slice(0, 20),
    [referrals]
  );

  useEffect(() => {
    if (!session) return;
    const userId = session.user?.id?.trim();
    if (!userId) {
      setStatsLoading(false);
      setReferrals([]);
      return;
    }

    let cancelled = false;
    setStatsLoading(true);

    (async () => {
      try {
        const res = await fetch("/api/referrals");
        if (!res.ok) {
          if (!cancelled) {
            setReferrals([]);
          }
          return;
        }
        const data: unknown = await res.json();
        if (cancelled || !data || typeof data !== "object") return;
        const o = data as Record<string, unknown>;
        if (!cancelled) {
          setReferrals(parseReferrals(o.referrals));
        }
      } catch {
        if (!cancelled) {
          setReferrals([]);
        }
      } finally {
        if (!cancelled) setStatsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [session, session?.user?.id]);

  useEffect(() => {
    if (!session?.user?.id?.trim()) return;

    let cancelled = false;
    setStats(null);

    fetch("/api/me/stats")
      .then((res) => res.json())
      .then((json: unknown) => {
        if (cancelled) return;
        if (
          json &&
          typeof json === "object" &&
          !("error" in json) &&
          typeof (json as MeStats).avgX === "number" &&
          typeof (json as MeStats).winRate === "number" &&
          typeof (json as MeStats).callsToday === "number" &&
          typeof (json as MeStats).totalCalls === "number"
        ) {
          setStats(json as MeStats);
        } else {
          setStats({
            avgX: 0,
            winRate: 0,
            callsToday: 0,
            totalCalls: 0,
          });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setStats({
            avgX: 0,
            winRate: 0,
            callsToday: 0,
            totalCalls: 0,
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [session?.user?.id]);

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
            parsed.push({ token: token || "Unknown", multiple, time: o.time });
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
  }, [session?.user?.id]);

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
  }, [session?.user?.id]);

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
  }, [session?.user?.id]);

  useEffect(() => {
    loadActivity();
    const interval = setInterval(loadActivity, 8000);
    return () => clearInterval(interval);
  }, [loadActivity]);

  const referralUrl =
    session?.user?.id != null && session.user.id !== ""
      ? `${REF_BASE}/${session.user.id}`
      : "";

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
      await submitCall(ca);
      alert("Call submitted");
      setSubmitCallOpen(false);
      setSubmitCallValue("");
    } catch (err) {
      const msg =
        err && typeof err === "object" && "message" in err
          ? String((err as any).message)
          : "Failed";
      alert(msg || "Failed");
    } finally {
      setSubmitCallSubmitting(false);
    }
  }, [submitCallSubmitting, submitCallValue]);

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
      <div className="flex min-h-[calc(100vh-3rem)] flex-col items-center justify-center px-4">
        <div className="w-full max-w-md rounded-2xl border border-[#1a1a1a] bg-[#0a0a0a] p-10 text-center shadow-xl shadow-black/40 backdrop-blur-sm">
          <h1 className="text-xl font-semibold text-zinc-100">McGBot Dashboard</h1>
          <p className="mt-3 text-sm leading-relaxed text-zinc-400">
            Sign in with Discord to view your referral stats and link.
          </p>
          <button
            type="button"
            onClick={() => signIn("discord")}
            className="mt-8 w-full rounded-lg bg-[#5865F2] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#4752c4] focus:outline-none focus:ring-2 focus:ring-sky-500/50"
          >
            Login with Discord
          </button>
        </div>
      </div>
    );
  }

  const streakValue =
    STREAK_COUNT > 0 ? (
      <div>
        <div className="inline-flex items-baseline gap-2">
          <span className="dashboard-fire-emoji" aria-hidden>
            🔥
          </span>
          <span>{STREAK_COUNT} day streak</span>
        </div>
        <div className="mt-1 text-xs text-green-400">+1 from yesterday</div>
      </div>
    ) : (
      "0"
    );

  // TODO: add badges next to usernames
  // TODO: allow widget resizing / layout control
  // TODO: move referral link under banner

  const showRankWidget = widgetEnabled(widgets, "rank");

  return (
    <div className="mx-auto max-w-[1200px] px-1 sm:px-0">
      <div className="mb-8">
        <PerformanceChart />
      </div>

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500">
          Personal Stats
        </h2>
        <div className="grid grid-cols-3 gap-4">
          <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
            <div className="text-xs text-zinc-400">AVG X</div>
            <div className="mt-1 text-2xl font-bold text-green-400">
              {stats === null ? "—" : `${stats.avgX.toFixed(1)}x`}
            </div>
            <div className="mt-1 text-xs text-green-400">+0.6x today ↑</div>
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
            <div className="text-xs text-zinc-400">WIN RATE</div>
            <div className="text-xl font-semibold text-green-400">
              {stats === null ? "—" : `${stats.winRate.toFixed(0)}%`}
            </div>
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
            <div className="text-xs text-zinc-400">STREAK</div>
            <div className="mt-1 text-white font-medium">{streakValue}</div>
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
            <div className="text-xs text-zinc-400">BEST CALL (24H)</div>
            <div className="text-white font-medium">SOLX</div>
            <div className="text-green-400 text-xl font-bold">8.2x</div>
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
            <div className="text-xs text-zinc-400">CONSISTENCY</div>
            <div className="text-green-400 text-xl font-bold">82%</div>
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
            <div className="text-xs text-zinc-400">LAST CALL</div>
            <div className="mt-1 text-white font-medium">SOLX</div>
            <div className="text-green-400 text-xl font-bold">4.2x</div>
            <div className="mt-1 text-xs text-zinc-500">+12m</div>
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
            <div className="text-xs text-zinc-400">CALLS TODAY</div>
            <div className="text-xl font-semibold text-white">
              {stats === null ? "—" : stats.callsToday}
            </div>
          </div>
        </div>
      </section>

      <div className="mb-6 grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 flex flex-col gap-3">
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

          {widgetEnabled(widgets, "top_performers") && (
            <TopPerformersPanel
              topPerformersLoading={topPerformersLoading}
              topPerformersToday={topPerformersToday}
              viewerId={session.user.id}
              viewerName={session.user.name}
              badgesByUser={badgesByUser}
            />
          )}

          {widgetEnabled(widgets, "trending") && <TrendingPanel />}
        </div>

        <div className="flex flex-col gap-4">
          {showRankWidget ? (
            <div className="w-full max-w-sm justify-self-start lg:max-w-none">
              <RankPanel
                yourRankLoading={yourRankLoading}
                yourWeekRank={yourWeekRank}
              />
            </div>
          ) : null}

          {widgetEnabled(widgets, "quick_actions") && (
            <PanelCard title="Quick Actions">
              <div className="mt-2 flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setSubmitCallFeedback(null);
                    setSubmitCallOpen(true);
                  }}
                  className="w-full rounded-xl bg-[#39FF14] px-4 py-3 text-base font-medium text-black shadow-lg shadow-black/40 transition hover:bg-[#2ee012] focus:outline-none focus:ring-2 focus:ring-[#39FF14]/30"
                >
                  Submit Call
                </button>
                <button
                  type="button"
                  className="w-full rounded-lg border border-[#1a1a1a] bg-[#0a0a0a] px-4 py-3 text-sm font-semibold text-zinc-100 transition hover:border-[#2a2a2a] hover:bg-[#0a0a0a] focus:outline-none focus:ring-2 focus:ring-[#39FF14]/20"
                >
                  Copy CA
                </button>
                <button
                  type="button"
                  className="w-full rounded-lg border border-[#1a1a1a] bg-[#0a0a0a] px-4 py-3 text-sm font-semibold text-zinc-100 transition hover:border-[#2a2a2a] hover:bg-[#0a0a0a] focus:outline-none focus:ring-2 focus:ring-[#39FF14]/20"
                >
                  Open Chart
                </button>
              </div>
            </PanelCard>
          )}

          {widgetEnabled(widgets, "live_tracked_calls") && <LiveTrackedCallsPanel />}

          {widgetEnabled(widgets, "hot_now") && (
            <PanelCard
              title="📈 Trending Tokens"
              titleClassName="normal-case"
            >
              <ul className="mt-2 space-y-2">
                {TRENDING_TOKENS_MOCK.map((row) => (
                  <li
                    key={row.symbol}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#1a1a1a] bg-transparent px-3 py-2"
                  >
                    <span className="font-medium text-zinc-100">{row.symbol}</span>
                    <span className="rounded-full border border-amber-500/35 bg-amber-500/5 px-2.5 py-0.5 text-[11px] font-medium leading-tight text-amber-200/95">
                      {Number.isFinite(row.stat) ? `${row.stat}x` : "—"}
                    </span>
                  </li>
                ))}
              </ul>
            </PanelCard>
          )}
        </div>
      </div>

      {(widgetEnabled(widgets, "recent_calls") ||
        widgetEnabled(widgets, "referral_link") ||
        widgetEnabled(widgets, "referrals")) && (
        <div className="mb-10 grid gap-3 lg:grid-cols-2">
          <div>
            {widgetEnabled(widgets, "recent_calls") && (
              <PanelCard title="Your Recent Calls">
                  <p className="mt-2 text-sm text-zinc-500">
                    <Link
                      href={`/user/${encodeURIComponent(session.user.id)}`}
                      className={PROFILE_LINK_CLASS}
                    >
                      {session.user.name ?? "Your profile"}
                    </Link>
                    <UserBadgeIcons
                      badges={badgesByUser[session.user.id.trim()] ?? []}
                      className="ml-1"
                    />
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
                      {recentCalls.map((call, i) => (
                        <li
                          key={`${call.token}-${String(call.time)}-${i}`}
                          className="flex flex-wrap items-center justify-between gap-2 py-2.5 first:pt-1.5 text-zinc-300"
                        >
                          <span className="min-w-0 font-medium text-zinc-100">
                            {call.token}
                            <span className="text-zinc-400"> → </span>
                            <span
                              className={`font-semibold tabular-nums ${multipleClass(
                                call.multiple
                              )}`}
                            >
                              {call.multiple.toFixed(1)}x
                            </span>
                          </span>
                          <span className="ml-auto shrink-0 text-zinc-500">
                            {formatJoinedAt(callTimeMs(call.time), nowMs)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
              </PanelCard>
            )}
          </div>

          <div>
            {(widgetEnabled(widgets, "referral_link") ||
              widgetEnabled(widgets, "referrals")) && (
              <PanelCard title="Referrals">
                {widgetEnabled(widgets, "referral_link") && (
                  <div
                    className={`flex flex-col gap-2 rounded-xl border border-[#1a1a1a] bg-[#0a0a0a] px-4 py-3 shadow-sm shadow-black/20 sm:flex-row sm:items-stretch sm:gap-3 ${CARD_HOVER}`}
                  >
                    <input
                      type="text"
                      readOnly
                      value={
                        referralUrl ||
                        "Unavailable — sign in again if this stays empty"
                      }
                      className="min-h-11 w-full flex-1 rounded-lg border border-[#1a1a1a] bg-[#050505] px-3 py-2 font-mono text-sm text-zinc-300 outline-none ring-[#39FF14]/20 focus:ring-2"
                    />
                    <button
                      type="button"
                      onClick={handleCopy}
                      disabled={!referralUrl}
                      className="shrink-0 rounded-lg bg-[#39FF14] px-5 py-2 text-sm font-medium text-black transition hover:bg-[#2ee012] disabled:cursor-not-allowed disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-[#39FF14]/30"
                    >
                      {copied ? "Copied!" : "Copy"}
                    </button>
                  </div>
                )}

                {widgetEnabled(widgets, "referrals") && (
                  <div
                    className={
                      widgetEnabled(widgets, "referral_link") ? "mt-4" : ""
                    }
                  >
                    <div className="w-full overflow-hidden">
                      {statsLoading ? (
                        <div className="flex min-h-[100px] items-center justify-center py-6">
                          <div className="flex flex-col items-center gap-2">
                            <div
                              className="h-8 w-48 animate-pulse rounded-md bg-zinc-800/90"
                              aria-hidden
                            />
                            <p className="text-sm text-zinc-500">
                              Loading referrals…
                            </p>
                          </div>
                        </div>
                      ) : displayedReferrals.length === 0 ? (
                        <div className="flex min-h-[100px] items-center justify-center py-6">
                          <p className="text-sm text-zinc-500">No referrals yet</p>
                        </div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full min-w-[280px] border-separate border-spacing-0 text-left text-sm">
                            <thead>
                              <tr className="border-b border-[#1a1a1a]">
                                <th
                                  scope="col"
                                  className="pb-2 pr-4 text-[10px] font-medium uppercase tracking-widest text-zinc-600 sm:text-[11px]"
                                >
                                  User
                                </th>
                                <th
                                  scope="col"
                                  className="pb-2 text-[10px] font-medium uppercase tracking-widest text-zinc-600 sm:text-[11px]"
                                >
                                  Joined
                                </th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-800/40 text-zinc-300">
                              {displayedReferrals.map((row) => (
                                <tr
                                  key={`${row.userId}-${row.joinedAt}`}
                                  className="transition-colors duration-150 hover:bg-zinc-800/45"
                                >
                                  <td className="py-2 pr-4 font-mono text-xs sm:text-sm">
                                    <Link
                                      href={`/user/${encodeURIComponent(row.userId)}`}
                                      className={PROFILE_LINK_CLASS}
                                    >
                                      {row.userId}
                                    </Link>
                                  </td>
                                  <td className="py-2 text-zinc-400">
                                    {formatJoinedAt(row.joinedAt, nowMs)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </PanelCard>
            )}
          </div>
        </div>
      )}

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
              <input
                type="text"
                value={submitCallValue}
                onChange={(e) => setSubmitCallValue(e.target.value)}
                placeholder="Enter contract address"
                disabled={submitCallSubmitting}
                className="w-full rounded-lg border border-[#1a1a1a] bg-[#050505] px-3 py-2 text-sm text-zinc-200 outline-none ring-[#39FF14]/20 focus:ring-2 disabled:opacity-60"
              />

              {submitCallFeedback ? (
                <p className="text-sm">
                  {submitCallFeedback === "success" ? (
                    <span className="text-[#39FF14]">Call submitted</span>
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
                  className="rounded-md bg-[#39FF14] px-3 py-1.5 text-xs font-medium text-black shadow-lg shadow-black/40 transition hover:bg-[#2ee012] disabled:opacity-60"
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
