"use client";

import type { WidgetsEnabled } from "@/app/api/dashboard-settings/route";
import {
  useNotifications,
  type NotificationPriority,
} from "@/app/contexts/NotificationsContext";
import { ActivityPopup } from "./components/ActivityPopup";
import { FollowButton } from "./components/FollowButton";
import { useFollowingIds } from "./hooks/useFollowingIds";
import Link from "next/link";
import { signIn, useSession } from "next-auth/react";
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

const HOT_RIGHT_NOW_MOCK = [
  { token: "SOLXYZ", tag: "trending" },
  { token: "DEV123", tag: "active" },
  { token: "ABC", tag: "2.8x in last hour" },
];

/** Mock trending rows; `mint` is a placeholder Solana mint for Dexscreener charts. */
const TRENDING_TOKENS_MOCK = [
  { symbol: "SOLXYZ", stat: 2.4, mint: "So11111111111111111111111111111111111111112" },
  { symbol: "ABC", stat: 1.8, mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v" },
  { symbol: "DEV123", stat: 3.1, mint: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263" },
] as const;

const CARD_HOVER =
  "transition-transform duration-200 ease-out motion-safe:hover:scale-[1.01]";

const PROFILE_LINK_CLASS =
  "text-cyan-400 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/50";

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
            const id = (entry as Record<string, unknown>).targetId;
            if (typeof id === "string" && id.trim() !== "") {
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

function renderActivityFeedLine(item: ActivityItem): ReactNode {
  const dex = item.link_chart ?? "";
  const name = item.username.trim();
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
        </>
      );
    }
  }

  if (name && id && item.type === "win" && item.text.startsWith(name)) {
    const afterName = item.text.slice(name.length);
    return (
      <>
        <Link
          href={`/user/${encodeURIComponent(id)}`}
          className={PROFILE_LINK_CLASS}
          onClick={(e) => e.stopPropagation()}
        >
          {name}
        </Link>
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

function callTimeMs(t: unknown): number {
  if (typeof t === "number" && Number.isFinite(t)) return t;
  const n = Number(t);
  if (Number.isFinite(n)) return n;
  if (typeof t === "string") {
    const p = Date.parse(t);
    if (Number.isFinite(p)) return p;
  }
  return 0;
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

function multipleClass(multiple: number): string {
  if (multiple >= 2) return "text-emerald-400";
  if (multiple < 1) return "text-red-400";
  return "text-zinc-200";
}

function formatJoinedAt(joinedAt: number, nowMs: number): string {
  if (!Number.isFinite(joinedAt) || joinedAt <= 0) return "—";
  const diff = nowMs - joinedAt;
  const sec = Math.floor(diff / 1000);
  const min = Math.floor(sec / 60);
  const hr = Math.floor(min / 60);
  if (sec < 60) return "just now";
  if (min < 60) return min === 1 ? "1 min ago" : `${min} min ago`;
  if (hr < 24) return hr === 1 ? "1 hour ago" : `${hr} hours ago`;
  const date = new Date(joinedAt);
  const nowDate = new Date(nowMs);
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  if (date.getFullYear() !== nowDate.getFullYear()) {
    opts.year = "numeric";
  }
  return date.toLocaleDateString("en-US", opts);
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
  return (
    <div
      className={`rounded-xl border border-zinc-800/80 bg-zinc-900/60 p-5 shadow-sm shadow-black/20 backdrop-blur-sm ${CARD_HOVER}`}
    >
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
        {title}
      </p>
      {loading ? (
        <div
          className="mt-2 h-9 w-20 max-w-full animate-pulse rounded-md bg-zinc-800/90"
          aria-busy
          aria-label="Loading"
        />
      ) : (
        <>
          <div className="mt-2 text-3xl font-bold tabular-nums tracking-tight text-zinc-50">
            {value}
          </div>
          {positiveHint ? (
            <p className="mt-1.5 text-xs font-medium text-emerald-400/95">
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
}: {
  title: string;
  children: ReactNode;
  className?: string;
  elevated?: boolean;
  titleClassName?: string;
}) {
  const surface = elevated
    ? "border-zinc-700/90 bg-zinc-800/55 shadow-md shadow-black/25"
    : "border-zinc-800/80 bg-zinc-900/60 shadow-sm shadow-black/20";

  return (
    <div
      className={`rounded-xl border p-5 backdrop-blur-sm ${surface} ${CARD_HOVER} ${className}`}
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

/** Market strip is rendered in `TopBar`; `widgetEnabled` for `market` is applied there. */
function MarketPanel() {
  return null;
}

function NotesPanel() {
  return (
    <section className="mb-8">
      <PanelCard title="Notes" titleClassName="normal-case">
        <p className="mt-4 text-sm text-zinc-500">No notes yet.</p>
      </PanelCard>
    </section>
  );
}

function TrendingPanel() {
  return (
    <PanelCard title="📈 Trending" titleClassName="normal-case">
      <ul className="mt-3 divide-y divide-zinc-800/80 text-[13px] leading-snug">
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
              <span className="shrink-0 tabular-nums text-xs font-semibold text-emerald-400/90">
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
  rankDeltaPlaceholder,
}: {
  yourRankLoading: boolean;
  yourWeekRank: number | null;
  rankDeltaPlaceholder: number;
}) {
  return (
    <section className="mb-8">
      <PanelCard title="Your Rank" titleClassName="normal-case">
        {yourRankLoading ? (
          <div className="mt-4 flex min-h-[56px] items-center">
            <p className="text-sm text-zinc-500">Loading rank…</p>
          </div>
        ) : yourWeekRank === null ? (
          <p className="mt-4 text-sm leading-relaxed text-zinc-400">
            No rank this week yet — user calls in the last 7 days earn a spot on
            the leaderboard.
          </p>
        ) : (
          <div className="mt-4">
            <p className="flex flex-wrap items-baseline gap-x-1.5 gap-y-1 text-sm text-zinc-300">
              <span>You are</span>
              <span className="font-bold tabular-nums text-zinc-50">
                #{yourWeekRank}
              </span>
              <span>this week</span>
              <span
                className="text-base font-light leading-none text-emerald-500/75"
                title="Rank vs prior day (placeholder)"
                aria-hidden
              >
                ↑
              </span>
            </p>
            <p className="mt-2 text-xs text-emerald-500/65">
              +{rankDeltaPlaceholder} from yesterday
            </p>
          </div>
        )}
      </PanelCard>
    </section>
  );
}

function TopPerformersPanel({
  topPerformersLoading,
  topPerformersToday,
}: {
  topPerformersLoading: boolean;
  topPerformersToday: TopPerformerTodayRow[];
}) {
  return (
    <section className="mb-8">
      <PanelCard title="🔥 Top Performers Today" titleClassName="normal-case">
        {topPerformersLoading ? (
          <div className="mt-4 flex min-h-[72px] items-center justify-center">
            <p className="text-sm text-zinc-500">Loading…</p>
          </div>
        ) : topPerformersToday.length === 0 ? (
          <p className="mt-4 text-sm text-zinc-500">
            No calls in the last 24 hours yet.
          </p>
        ) : (
          <ul className="mt-4 space-y-2">
            {topPerformersToday.map((row, i) => {
              const isFirst = i === 0;
              return (
                <li
                  key={row.discordId}
                  className={
                    isFirst
                      ? "rounded-xl border border-amber-500/45 bg-gradient-to-r from-amber-500/10 to-amber-500/[0.02] px-4 py-3 shadow-[0_0_28px_-10px_rgba(245,158,11,0.45)]"
                      : "rounded-xl border border-zinc-800/90 bg-zinc-900/40 px-4 py-3"
                  }
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <span
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold tabular-nums ${
                          isFirst
                            ? "bg-amber-500/25 text-amber-200"
                            : "bg-zinc-800 text-zinc-400"
                        }`}
                      >
                        #{i + 1}
                      </span>
                      <Link
                        href={`/user/${encodeURIComponent(row.discordId)}`}
                        className={`min-w-0 truncate font-medium transition-colors hover:text-cyan-400 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/50 ${
                          isFirst ? "text-amber-100" : "text-zinc-100"
                        }`}
                      >
                        {row.username}
                      </Link>
                    </div>
                    <div className="shrink-0 text-right text-sm">
                      <p className="tabular-nums">
                        <span
                          className={`font-semibold ${
                            isFirst ? "text-amber-100" : "text-emerald-400/95"
                          }`}
                        >
                          {row.avgX.toFixed(1)}x
                        </span>
                        <span className="text-zinc-500"> avg</span>
                      </p>
                      <p className="mt-0.5 text-xs tabular-nums text-zinc-500">
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
}: ActivityFeedPanelProps) {
  return (
    <PanelCard title="Live Activity">
      <div className="mt-4 flex flex-wrap gap-2">
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
        <div className="flex min-h-[100px] items-center justify-center py-10">
          <p className="text-sm text-zinc-500">Loading activity...</p>
        </div>
      ) : activity.length === 0 ? (
        <div className="flex min-h-[100px] items-center justify-center py-10">
          <p className="text-sm text-zinc-500">
            {feedMode === "following"
              ? "No activity from people you follow"
              : "No activity yet"}
          </p>
        </div>
      ) : (
        <ul className="mt-4 max-h-[300px] overflow-y-auto pr-1 text-sm">
          {activity.map((item, i) => (
            <li
              key={`${String(item.time)}-${i}-${item.text.slice(0, 24)}`}
              className="dashboard-feed-item border-b border-zinc-800 last:border-b-0"
              style={{ animationDelay: `${i * 70}ms` }}
            >
              <div className="-mx-1 flex items-start gap-2 rounded-md py-2.5 pl-1 pr-1 transition-colors duration-150 hover:bg-zinc-800/30 sm:pl-2 sm:pr-2">
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
                    {renderActivityFeedLine(item)}
                  </span>
                  <span className="flex shrink-0 items-center gap-1.5">
                    <span className="text-xs tabular-nums text-zinc-500">
                      {formatJoinedAt(callTimeMs(item.time), nowMs)}
                    </span>
                    <span className="text-xs text-zinc-500" aria-hidden>
                      ↗
                    </span>
                  </span>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </PanelCard>
  );
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

  /** Placeholder until day-over-day rank is stored. */
  const PLACEHOLDER_RANK_DELTA = 2;

  const [widgets, setWidgets] = useState<WidgetsEnabled | null>(null);

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
        <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900/70 p-10 text-center shadow-xl shadow-black/40 backdrop-blur-sm">
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
      <span className="inline-flex items-baseline gap-1">
        <span className="dashboard-fire-emoji" aria-hidden>
          🔥
        </span>
        <span>{STREAK_COUNT}</span>
      </span>
    ) : (
      "0"
    );

  return (
    <div className="mx-auto max-w-[1200px] px-1 sm:px-0">
      <section className="mb-8">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-zinc-500">
          Personal Stats
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Avg X"
            value={
              stats === null ? "—" : `${stats.avgX.toFixed(1)}x`
            }
          />
          <StatCard
            title="Win Rate"
            value={
              stats === null ? "—" : `${stats.winRate.toFixed(0)}%`
            }
          />
          <StatCard
            title="Calls Today"
            value={stats === null ? "—" : stats.callsToday}
          />
          <StatCard title="Streak" value={streakValue} />
        </div>
      </section>

      {widgetEnabled(widgets, "market") && <MarketPanel />}

      {widgetEnabled(widgets, "rank") && (
        <RankPanel
          yourRankLoading={yourRankLoading}
          yourWeekRank={yourWeekRank}
          rankDeltaPlaceholder={PLACEHOLDER_RANK_DELTA}
        />
      )}

      {widgetEnabled(widgets, "top_performers") && (
        <TopPerformersPanel
          topPerformersLoading={topPerformersLoading}
          topPerformersToday={topPerformersToday}
        />
      )}

      <div className="mb-8 grid gap-6 lg:grid-cols-2 lg:items-start">
        <div className="flex flex-col gap-6">
          {widgetEnabled(widgets, "activity") && (
            <ActivityFeedPanel
              feedMode={feedMode}
              setFeedMode={setFeedMode}
              loadingActivity={loadingActivity}
              activity={activity}
              followingIds={followingIds}
              setFollowing={setFollowing}
              nowMs={nowMs}
              setSelectedActivity={setSelectedActivity}
            />
          )}

          <PanelCard
            title="🔥 Hot Right Now"
            elevated
            titleClassName="normal-case"
          >
            <ul className="mt-4 space-y-2.5">
              {HOT_RIGHT_NOW_MOCK.map((row) => (
                <li
                  key={row.token}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-zinc-700/50 bg-zinc-900/40 px-3 py-2.5"
                >
                  <span className="font-medium text-zinc-100">{row.token}</span>
                  <span className="rounded-full border border-amber-500/35 bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-medium leading-tight text-amber-200/95">
                    {row.tag}
                  </span>
                </li>
              ))}
            </ul>
          </PanelCard>

          {widgetEnabled(widgets, "trending") && <TrendingPanel />}

          {widgetEnabled(widgets, "notes") && <NotesPanel />}
        </div>

        <PanelCard title="Quick Actions">
          <div className="mt-4 flex flex-col gap-2">
            <button
              type="button"
              className="w-full rounded-xl bg-gradient-to-r from-cyan-500 to-sky-500 px-4 py-4 text-base font-semibold text-white shadow-lg shadow-cyan-500/25 transition hover:from-cyan-400 hover:to-sky-400 hover:shadow-cyan-400/45 focus:outline-none focus:ring-2 focus:ring-cyan-400/60"
            >
              Submit Call
            </button>
            <button
              type="button"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800/80 px-4 py-3 text-sm font-semibold text-zinc-100 transition hover:border-zinc-600 hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-sky-500/30"
            >
              Copy CA
            </button>
            <button
              type="button"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800/80 px-4 py-3 text-sm font-semibold text-zinc-100 transition hover:border-zinc-600 hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-sky-500/30"
            >
              Open Chart
            </button>
          </div>
        </PanelCard>
      </div>

      <section className="mb-10">
        <PanelCard title="Your Recent Calls">
          {callsLoading ? (
            <div className="flex min-h-[100px] items-center justify-center py-10">
              <p className="text-sm text-zinc-500">Loading calls...</p>
            </div>
          ) : recentCalls.length === 0 ? (
            <div className="flex min-h-[100px] items-center justify-center py-10">
              <p className="text-sm text-zinc-500">No calls yet</p>
            </div>
          ) : (
            <ul className="mt-4 space-y-0 divide-y divide-zinc-800/50 text-sm">
              {recentCalls.map((call, i) => (
                <li
                  key={`${call.token}-${String(call.time)}-${i}`}
                  className="flex flex-wrap items-center justify-between gap-2 py-3 first:pt-1 text-zinc-300"
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
      </section>

      <section className="mb-10">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-zinc-500">
          Your Referral Link
        </h2>
        <div
          className={`flex flex-col gap-3 rounded-xl border border-zinc-800/80 bg-zinc-900/60 p-4 shadow-sm shadow-black/20 sm:flex-row sm:items-stretch sm:gap-3 ${CARD_HOVER}`}
        >
          <input
            type="text"
            readOnly
            value={referralUrl || "Unavailable — sign in again if this stays empty"}
            className="min-h-11 w-full flex-1 rounded-lg border border-zinc-800 bg-[#0b0d12] px-3 py-2 font-mono text-sm text-zinc-300 outline-none ring-sky-500/30 focus:ring-2"
          />
          <button
            type="button"
            onClick={handleCopy}
            disabled={!referralUrl}
            className="shrink-0 rounded-lg bg-sky-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-sky-400/50"
          >
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
      </section>

      <section className="mb-12">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-zinc-500">
          Your Referrals
        </h2>
        <div
          className={`w-full overflow-hidden rounded-xl border border-zinc-800/80 bg-zinc-900/60 p-4 shadow-sm shadow-black/20 backdrop-blur-sm sm:p-5 ${CARD_HOVER}`}
        >
          {statsLoading ? (
            <div className="flex min-h-[120px] items-center justify-center py-8">
              <div className="flex flex-col items-center gap-3">
                <div
                  className="h-8 w-48 animate-pulse rounded-md bg-zinc-800/90"
                  aria-hidden
                />
                <p className="text-sm text-zinc-500">Loading referrals…</p>
              </div>
            </div>
          ) : displayedReferrals.length === 0 ? (
            <div className="flex min-h-[120px] items-center justify-center py-10">
              <p className="text-sm text-zinc-500">No referrals yet</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[280px] border-separate border-spacing-0 text-left text-sm">
                <thead>
                  <tr className="border-b border-zinc-800/50">
                    <th
                      scope="col"
                      className="pb-2.5 pr-4 text-[10px] font-medium uppercase tracking-widest text-zinc-600 sm:text-[11px]"
                    >
                      User
                    </th>
                    <th
                      scope="col"
                      className="pb-2.5 text-[10px] font-medium uppercase tracking-widest text-zinc-600 sm:text-[11px]"
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
                      <td className="py-3 pr-4 font-mono text-xs text-zinc-200 sm:text-sm">
                        {row.userId}
                      </td>
                      <td className="py-3 text-zinc-400">
                        {formatJoinedAt(row.joinedAt, nowMs)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

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
    </div>
  );
}
