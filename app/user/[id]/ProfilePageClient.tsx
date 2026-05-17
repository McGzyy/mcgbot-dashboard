"use client";

import { FollowButton } from "@/app/components/FollowButton";
import { UserCallSuspensionStaffPanel } from "@/app/components/UserCallSuspensionStaffPanel";
import { useFollowingIds } from "@/app/hooks/useFollowingIds";
import {
  abbreviateCa,
  callTimeMs,
  formatCalledSnapshotLine,
  formatJoinedAt,
  multipleClass,
} from "@/lib/callDisplayFormat";
import {
  discordDefaultEmbedAvatarUrl,
  looksLikeDiscordSnowflake,
} from "@/lib/discordIdentity";
import {
  callClubMilestoneEmoji,
  callClubMilestoneLabel,
  compareMilestoneKeys,
} from "@/lib/milestoneTrophies";
import { CallerIntelligencePanel } from "@/app/components/profile/CallerIntelligencePanel";
import { ProfileDeskUpsell } from "@/app/components/profile/ProfileDeskUpsell";
import { ProfileTrackRecordChart } from "@/app/components/profile/ProfileTrackRecordChart";
import {
  buildProfileDistributionSegments,
  buildProfileTrackChartView,
  type ProfileTrackMetric,
} from "@/lib/profileChartData";
import type { CallerProfileIntel } from "@/lib/callerProfileIntel";
import { parseTopCallerTimesFromBadges } from "@/lib/topCallerBadgeDisplay";
import { useNotifications } from "@/app/contexts/NotificationsContext";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import {
  terminalChrome,
  terminalPage,
  terminalSurface,
  terminalUi,
} from "@/lib/terminalDesignTokens";

const CARD_HOVER =
  "transition-[box-shadow,border-color,transform,filter] duration-200 ease-out motion-safe:hover:border-zinc-600/55 motion-safe:hover:shadow-lg motion-safe:hover:shadow-black/40 motion-safe:hover:-translate-y-0.5";

const PROFILE_HERO_SHELL = `${terminalSurface.routeHeroFrame} ${terminalSurface.insetEdge} relative mb-6 overflow-hidden`;

/** In-page anchors — offset matches TopBar + optional announcement (see dashboardStickyChrome). */
const PROFILE_STICKY_BELOW_CHROME =
  "top-[var(--dashboard-sticky-below-chrome,6rem)]";
const PROFILE_SECTION_SCROLL =
  "scroll-mt-[var(--dashboard-sticky-below-chrome,6rem)]";

/** Fixed left rail — width + gap from profile column (see `profilePageColumnRef`). */
const PROFILE_DESK_NAV_WIDTH_PX = 200;
const PROFILE_DESK_NAV_GAP_PX = 20;
const PROFILE_DESK_NAV_SHELL = `${terminalSurface.insetPanel} ${terminalSurface.insetEdge} shadow-[0_16px_48px_-20px_rgba(0,0,0,0.9)] ring-1 ring-zinc-800/50 backdrop-blur-md`;

const PROFILE_PRIMARY_BTN =
  "rounded-lg border border-zinc-700/80 bg-gradient-to-b from-zinc-800/95 to-zinc-900/95 px-3.5 py-2 text-xs font-semibold text-zinc-100 shadow-md shadow-black/25 transition hover:border-cyan-500/35 hover:from-zinc-700/95 hover:to-zinc-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/35 disabled:opacity-50 motion-safe:active:scale-[0.98]";

const TROPHY_TIER_WELL = `${terminalSurface.insetPanel} ${terminalSurface.insetEdgeSoft} p-3`;

function profileNavLinkClass(active: boolean): string {
  return active
    ? "group flex items-center gap-2 rounded-md border-l-2 border-cyan-400/90 bg-gradient-to-r from-cyan-500/12 to-transparent py-2 pl-2 -ml-px text-[11px] font-semibold uppercase tracking-[0.14em] text-cyan-100 shadow-[inset_0_1px_0_0_rgba(34,211,238,0.14)]"
    : "group flex items-center gap-2 rounded-md py-2 pl-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500 transition hover:bg-zinc-900/80 hover:text-zinc-200";
}

function ProfileDeskNavLink({
  href,
  label,
  active,
}: {
  href: string;
  label: string;
  active: boolean;
}) {
  return (
    <a
      href={href}
      aria-current={active ? "location" : undefined}
      className={profileNavLinkClass(active)}
    >
      <span
        className={`h-1.5 w-1.5 shrink-0 rounded-full transition ${
          active
            ? "bg-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.75)]"
            : "bg-zinc-700 group-hover:bg-zinc-500"
        }`}
        aria-hidden
      />
      {label}
    </a>
  );
}

function readStickyBelowChromePx(): number {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(
    "--dashboard-sticky-below-chrome"
  );
  const parsed = parseFloat(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 96;
}

function ProfileDeskNavFixed({
  items,
  activeId,
  leftPx,
  topPx,
  navRef,
}: {
  items: { href: string; id: string; label: string }[];
  activeId: string;
  leftPx: number | null;
  topPx: number | null;
  navRef: RefObject<HTMLElement | null>;
}) {
  const ready = leftPx != null && topPx != null;
  return (
    <aside
      ref={navRef}
      className="pointer-events-none fixed z-[35] hidden w-[12.5rem] lg:block xl:w-[13rem]"
      style={{
        left: ready ? `${leftPx}px` : undefined,
        top: ready ? `${topPx}px` : undefined,
        visibility: ready ? "visible" : "hidden",
      }}
      aria-label="Profile section navigation"
    >
      <nav
        className={`pointer-events-auto max-h-[min(28rem,calc(100dvh-var(--dashboard-sticky-below-chrome,6rem)-1.25rem))] space-y-0.5 overflow-y-auto overscroll-contain p-2 ${PROFILE_DESK_NAV_SHELL} ${terminalChrome.scrollYHidden}`}
        aria-label="Profile sections"
      >
        <p className="px-2.5 pb-2 pt-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
          On this desk
        </p>
        {items.map((item) => (
          <ProfileDeskNavLink
            key={item.href}
            href={item.href}
            label={item.label}
            active={activeId === item.id}
          />
        ))}
      </nav>
    </aside>
  );
}

function profileNavPillClass(active: boolean): string {
  return active
    ? "shrink-0 rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-cyan-100"
    : "shrink-0 rounded-lg border border-zinc-800/90 bg-zinc-950/60 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-500 transition hover:border-zinc-700 hover:text-zinc-200";
}

const PROFILE_LIST_SCROLL = `max-h-[min(28rem,52vh)] overflow-y-auto overscroll-contain ${terminalChrome.scrollYHidden}`;

const PROFILE_CHIP_BTN_CYAN =
  "rounded-md border border-cyan-500/25 bg-cyan-950/30 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-cyan-200/90 transition hover:border-cyan-400/40 hover:bg-cyan-950/50 hover:text-cyan-50 disabled:opacity-50";

function ProfileEmptyState({
  icon,
  title,
  description,
  compact,
}: {
  icon: string;
  title: string;
  description: string;
  compact?: boolean;
}) {
  return (
    <div
      className={`mt-3 flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-zinc-700/50 ${terminalSurface.insetPanel} ${terminalSurface.insetEdgeSoft} px-6 text-center ${compact ? "py-8" : "py-10"}`}
    >
      <span className={`${compact ? "text-xl" : "text-2xl"} opacity-30`} aria-hidden>
        {icon}
      </span>
      <p className="text-sm font-medium text-zinc-400">{title}</p>
      <p className="max-w-[18rem] text-xs leading-relaxed text-zinc-600">{description}</p>
    </div>
  );
}

function ProfileSectionHeader({
  kicker,
  title,
  hint,
  badge,
}: {
  kicker: string;
  title: string;
  hint?: string;
  badge?: ReactNode;
}) {
  return (
    <div className="relative z-[1] mb-5 flex flex-wrap items-end justify-between gap-3 border-b border-zinc-800/70 pb-4">
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-cyan-500/20 to-transparent"
        aria-hidden
      />
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-cyan-300/80">
          {kicker}
        </p>
        <h2 className={`${terminalPage.sectionTitle} mt-1.5 text-lg sm:text-xl`}>{title}</h2>
        {hint ? <p className={`${terminalPage.sectionHint} mt-1 max-w-2xl`}>{hint}</p> : null}
      </div>
      {badge ?? null}
    </div>
  );
}

function TrophyEmptyHint({ short }: { short?: boolean }) {
  return (
    <div className="flex min-h-[2.75rem] items-center gap-2.5 rounded-lg border border-dashed border-zinc-700/40 bg-zinc-950/45 px-3 py-2">
      <span className="text-[15px] leading-none opacity-35 grayscale" aria-hidden>
        🏆
      </span>
      <p className={`leading-snug text-zinc-500 ${short ? "text-[11px]" : "text-xs"}`}>
        {short ? "Open slot" : "No podium finishes yet — keep calling."}
      </p>
    </div>
  );
}

type ProfileStats = {
  avgX: number;
  winRate: number;
  totalCalls: number;
};

type RecentCallRow = {
  id?: string;
  token: string;
  multiple: number;
  time: unknown;
  excludedFromStats?: boolean;
  tokenName?: string | null;
  tokenTicker?: string | null;
  callMarketCapUsd?: number | null;
  tokenImageUrl?: string | null;
};

type TrustedProCallRow = {
  id: string;
  contract_address: string;
  thesis: string;
  status: string;
  staff_notes: string | null;
  reviewed_at: string | null;
  published_at: string | null;
  views_count: number;
  created_at: string;
};

type ProfilePayload = {
  /** Resolved Discord snowflake (always set by `/api/user/[id]`). */
  discordId: string;
  /** Latest handle from call rows (Discord username / legacy). */
  username: string;
  /** Preferred label: OAuth global name when stored on `users`. */
  displayName: string;
  /** Discord CDN avatar URL from last sign-in when stored. */
  avatarUrl: string | null;
  isTopCaller: boolean;
  isTrustedPro: boolean;
  bio: string | null;
  created_at?: unknown;
  banner_url: string | null;
  banner_crop_x?: number | null;
  banner_crop_y?: number | null;
  x_handle?: string | null;
  x_verified?: boolean;
  callDistribution?: {
    under1: number;
    oneToTwo: number;
    twoToFive: number;
    fivePlus: number;
    total: number;
  };
  keyStats?: {
    bestMultiple: number | null;
    medianMultiple: number | null;
    last10Avg: number | null;
  };
  profile_visibility?: {
    show_stats?: boolean;
    show_trophies?: boolean;
    show_calls?: boolean;
    show_key_stats?: boolean;
    show_pinned_call?: boolean;
  } | null;
  stats: ProfileStats;
  recentCalls: RecentCallRow[];
  callerIntel?: CallerProfileIntel | null;
};

type TrophyTimeframe = "daily" | "weekly" | "monthly";

type TrophyRow = {
  id: string;
  rank: number;
  periodStartMs: number;
  createdAt: string | null;
};

type MilestoneTrophyRow = {
  id: string;
  milestoneKey: string;
  createdAt: string | null;
};

type TrophiesByTimeframe = Record<TrophyTimeframe, TrophyRow[]>;

type EditableProfile = {
  bio: string | null;
  banner_url: string | null;
};

function clampCropPercent(raw: unknown, fallback: number = 50): number {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(100, Math.round(n)));
}

const BIO_MAX = 200;

/** Solana-style base58 mint (loose check for explorer links). */
const SOLANA_MINT_LIKE = /^[1-9A-HJ-NP-Za-km-z]{32,48}$/;

function formatCallTokenForProfile(token: string): {
  display: string;
  explorerUrl: string | null;
} {
  const t = token.trim();
  if (!t || t === "Unknown") {
    return { display: "Mint not on file", explorerUrl: null };
  }
  if (SOLANA_MINT_LIKE.test(t)) {
    return {
      display: `${t.slice(0, 4)}…${t.slice(-4)}`,
      explorerUrl: `https://dexscreener.com/solana/${encodeURIComponent(t)}`,
    };
  }
  return { display: t, explorerUrl: null };
}

function formatDateJoined(createdAt: unknown): string | null {
  if (!createdAt) return null;
  const d = new Date(String(createdAt));
  if (isNaN(d.getTime())) return null;

  return `Joined ${d.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  })}`;
}

function callsEligibleForSnapshot(
  calls: { multiple: number; token?: string; excludedFromStats?: boolean }[]
) {
  return (calls || []).filter((c) => c.excludedFromStats !== true);
}

function computeBestCall(calls: { multiple: number; token?: string; excludedFromStats?: boolean }[]) {
  const list = callsEligibleForSnapshot(calls);
  if (!list.length) return { best: null, token: null };
  let best: number | null = null;
  let token: string | null = null;
  for (const c of list) {
    if (!c || typeof c.multiple !== "number" || !Number.isFinite(c.multiple)) {
      continue;
    }
    if (best == null || c.multiple > best) {
      best = c.multiple;
      const raw =
        typeof c.token === "string" && c.token.trim() ? c.token.trim() : null;
      token =
        raw && raw !== "Unknown"
          ? raw
          : null;
    }
  }
  return { best, token };
}

function computeHitRates(
  calls: { multiple: number; excludedFromStats?: boolean }[]
) {
  const list = callsEligibleForSnapshot(calls);
  if (!list.length) {
    return { rate2x: null, rate3x: null };
  }

  const multiples = list.map(c => c.multiple).filter(n => typeof n === "number");

  if (multiples.length === 0) {
    return { rate2x: null, rate3x: null };
  }

  const total = multiples.length;

  const hit2x = multiples.filter(m => m >= 2).length;
  const hit3x = multiples.filter(m => m >= 3).length;

  return {
    rate2x: (hit2x / total) * 100,
    rate3x: (hit3x / total) * 100,
  };
}

function getRecentForm(calls: { multiple: number; excludedFromStats?: boolean }[]) {
  const list = callsEligibleForSnapshot(calls);
  if (!list.length) return [];

  return list.slice(0, 5).map(c => {
    const m = c.multiple;

    if (m >= 2) return "green";
    if (m >= 1) return "neutral";
    return "red";
  });
}

function PinnedCallSpotlight({
  token,
  multiple,
  timeLabel,
}: {
  token: string;
  multiple: number;
  timeLabel: string;
}) {
  const multDisplay = Number.isFinite(multiple) ? multiple.toFixed(1) : null;
  const trimmed = token.trim();
  const fmt = formatCallTokenForProfile(trimmed);
  const titleAttr =
    trimmed && trimmed !== "Unknown" && SOLANA_MINT_LIKE.test(trimmed)
      ? trimmed
      : fmt.display;
  return (
    <section
      className={`relative isolate overflow-hidden ${terminalSurface.routeHeroFrame} border-emerald-500/30 bg-gradient-to-br from-zinc-900/95 via-zinc-950 to-emerald-950/35 p-5 ring-emerald-500/15 sm:p-6`}
      aria-label="Pinned call showcase"
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 z-[2] h-px bg-gradient-to-r from-transparent via-emerald-400/50 to-transparent" />
      <div className="pointer-events-none absolute -right-20 -top-16 h-48 w-48 rounded-full bg-emerald-500/[0.08] blur-3xl" aria-hidden />
      <div className="relative grid gap-6 sm:grid-cols-[1fr_auto] sm:items-end">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-emerald-400/95">
            Signature pick
          </p>
          {fmt.explorerUrl ? (
            <a
              href={fmt.explorerUrl}
              target="_blank"
              rel="noopener noreferrer"
              title={titleAttr}
              className="mt-2 block break-all font-mono text-[13px] leading-relaxed text-emerald-100/95 underline decoration-emerald-500/35 underline-offset-2 transition hover:text-white hover:decoration-emerald-400/55 sm:text-sm"
            >
              {fmt.display}
            </a>
          ) : (
            <p
              title={trimmed && trimmed !== fmt.display ? trimmed : undefined}
              className="mt-2 break-words font-mono text-[13px] leading-relaxed text-zinc-100 sm:text-sm"
            >
              {fmt.display}
            </p>
          )}
          <p className="mt-3 text-xs text-zinc-500">{timeLabel}</p>
        </div>
        <div className="flex flex-col items-start sm:items-end">
          <p className="text-5xl font-black tabular-nums tracking-tighter text-transparent bg-gradient-to-br from-emerald-200 via-emerald-400 to-cyan-300 bg-clip-text drop-shadow-[0_0_40px_rgba(52,211,153,0.18)] sm:text-6xl sm:leading-[0.95]">
            {multDisplay !== null ? `${multDisplay}×` : "—"}
          </p>
          <p className="mt-2 hidden text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500 sm:block">
            Peak multiple
          </p>
        </div>
      </div>
    </section>
  );
}

function PinnedCallSpotlightSkeleton() {
  return (
    <section
      className={`relative isolate overflow-hidden ${terminalSurface.insetPanel} p-6 sm:p-8`}
      aria-busy
      aria-label="Loading pinned call"
    >
      <div className="grid gap-6 sm:grid-cols-[1fr_auto] sm:items-end">
        <div className="space-y-3">
          <div className="h-3 w-32 animate-pulse rounded bg-zinc-800" />
          <div className="h-5 w-full max-w-lg animate-pulse rounded bg-zinc-800/80" />
          <div className="h-3 w-36 animate-pulse rounded bg-zinc-800" />
        </div>
        <div className="h-16 w-32 animate-pulse rounded-xl bg-zinc-800/90 sm:h-20 sm:w-40" />
      </div>
    </section>
  );
}

function computeAlphaScore({
  avg,
  median,
  last10,
  winRate,
}: {
  avg: number | null;
  median: number | null;
  last10: number | null;
  winRate: number | null;
}) {
  if (avg == null || !Number.isFinite(avg) || winRate == null || !Number.isFinite(winRate)) {
    return null;
  }
  const m = median != null && Number.isFinite(median) ? median : avg;
  const l = last10 != null && Number.isFinite(last10) ? last10 : avg;
  const winRateNormalized = winRate / 100;

  return m * 0.4 + l * 0.3 + avg * 0.2 + winRateNormalized * 0.1;
}

function rankMedal(rank: number): string {
  if (rank === 1) return "🥇";
  if (rank === 2) return "🥈";
  if (rank === 3) return "🥉";
  return "🏅";
}

function formatTrophyPeriodUtc(
  periodStartMs: number,
  timeframe: TrophyTimeframe
): string {
  if (!Number.isFinite(periodStartMs) || periodStartMs <= 0) return "";
  const d = new Date(periodStartMs);
  if (timeframe === "monthly") {
    return d.toLocaleDateString("en-US", {
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    });
  }
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function trophyTooltipText(
  timeframeLabel: string,
  rank: number,
  periodStartMs: number,
  timeframe: TrophyTimeframe
): string {
  const date = formatTrophyPeriodUtc(periodStartMs, timeframe);
  const rankPart = `#${rank}`;
  return date
    ? `${timeframeLabel} ${rankPart} — ${date}`
    : `${timeframeLabel} ${rankPart}`;
}

function parseTrophiesPayload(json: unknown): TrophiesByTimeframe | null {
  if (!json || typeof json !== "object" || "error" in json) return null;
  const o = json as Record<string, unknown>;
  const out: TrophiesByTimeframe = { daily: [], weekly: [], monthly: [] };
  for (const tf of ["daily", "weekly", "monthly"] as const) {
    const raw = o[tf];
    if (!Array.isArray(raw)) continue;
    for (const item of raw) {
      if (!item || typeof item !== "object") continue;
      const r = item as Record<string, unknown>;
      const id = typeof r.id === "string" ? r.id : String(r.id ?? "");
      const rank = typeof r.rank === "number" ? r.rank : Number(r.rank);
      const periodRaw = r.periodStartMs ?? r.period_start_ms;
      const periodStartMs =
        typeof periodRaw === "number" ? periodRaw : Number(periodRaw);
      const ca = r.createdAt ?? r.created_at;
      const createdAt =
        ca == null
          ? null
          : typeof ca === "string"
            ? ca
            : String(ca);
      if (!id || !Number.isFinite(rank) || rank < 1 || rank > 3) continue;
      out[tf].push({
        id,
        rank,
        periodStartMs: Number.isFinite(periodStartMs) ? periodStartMs : 0,
        createdAt,
      });
    }
  }
  return out;
}

function parseMilestoneTrophiesPayload(json: unknown): MilestoneTrophyRow[] {
  if (!json || typeof json !== "object" || "error" in json) return [];
  const o = json as Record<string, unknown>;
  const raw = o.milestones;
  if (!Array.isArray(raw)) return [];
  const out: MilestoneTrophyRow[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    const id = typeof r.id === "string" ? r.id : String(r.id ?? "");
    const mkRaw =
      typeof r.milestoneKey === "string"
        ? r.milestoneKey
        : typeof r.milestone_key === "string"
          ? r.milestone_key
          : "";
    const milestoneKey = mkRaw.trim();
    const ca = r.createdAt ?? r.created_at;
    const createdAt =
      ca == null
        ? null
        : typeof ca === "string"
          ? ca
          : String(ca);
    if (!id || !milestoneKey) continue;
    out.push({ id, milestoneKey, createdAt });
  }
  out.sort((a, b) => compareMilestoneKeys(a.milestoneKey, b.milestoneKey));
  return out;
}

function formatMilestoneJoinedTooltip(createdAt: string | null): string {
  if (!createdAt) return "Call club — earned once per account";
  const d = new Date(createdAt);
  if (isNaN(d.getTime())) return "Call club — earned once per account";
  const when = d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
  return `Joined ${when} (UTC)`;
}

function MilestoneClubStrip({ items }: { items: MilestoneTrophyRow[] }) {
  return (
    <div className="overflow-visible">
      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-400">
        Call clubs
      </p>
      <p className="mb-2 text-[11px] leading-snug text-zinc-500">
        One badge per club when any of your eligible dashboard calls hits the
        multiple (lifetime).
      </p>
      <div className="flex flex-wrap items-center gap-2 overflow-visible sm:gap-2.5">
        {items.length === 0 ? (
          <div className="flex min-h-[2.75rem] items-center gap-2.5 rounded-lg border border-dashed border-violet-500/15 bg-violet-950/10 px-3 py-2">
            <span className="text-[15px] leading-none opacity-40" aria-hidden>
              ◇
            </span>
            <p className="text-[11px] leading-snug text-zinc-500">
              Club badges unlock when you hit lifetime multiples.
            </p>
          </div>
        ) : (
          items.map((m) => {
            const label = callClubMilestoneLabel(m.milestoneKey);
            const tip = `${label} — ${formatMilestoneJoinedTooltip(m.createdAt)}`;
            return (
              <span
                key={m.id}
                className="group relative inline-flex shrink-0 cursor-default select-none rounded-md bg-gradient-to-b from-violet-950/50 to-zinc-950/90 px-2 py-1 text-xs font-medium text-violet-100 ring-1 ring-violet-500/35 shadow-md shadow-black/30"
                aria-label={tip}
              >
                <span className="mr-1.5" aria-hidden>
                  {callClubMilestoneEmoji(m.milestoneKey)}
                </span>
                {label}
                <span
                  role="tooltip"
                  className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-1.5 max-w-[220px] -translate-x-1/2 whitespace-pre-wrap rounded bg-zinc-800 px-2 py-1 text-left text-[11px] leading-snug text-zinc-200 opacity-0 shadow transition-opacity delay-75 duration-150 group-hover:opacity-100"
                >
                  {tip}
                </span>
              </span>
            );
          })
        )}
      </div>
    </div>
  );
}

function TrophyTierRow({
  label,
  timeframe,
  items,
  size,
}: {
  label: string;
  timeframe: TrophyTimeframe;
  items: TrophyRow[];
  size: "sm" | "md" | "lg";
}) {
  const sizeClass =
    size === "sm"
      ? "text-sm leading-none"
      : size === "md"
        ? "text-lg leading-none"
        : "text-2xl leading-none";
  const shellClass =
    size === "lg"
      ? "rounded-lg bg-gradient-to-b from-zinc-800/90 to-zinc-950/90 px-2.5 py-2 ring-1 ring-amber-500/30 shadow-lg shadow-black/40"
      : size === "md"
        ? "rounded-md bg-zinc-900/50 px-1.5 py-1 ring-1 ring-zinc-700/50"
        : "rounded bg-zinc-900/40 px-0.5 py-px ring-1 ring-zinc-800/60";

  return (
    <div className="overflow-visible">
      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-400">
        {label}
      </p>
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-2 overflow-visible sm:gap-x-3">
        {items.length === 0 ? (
          <TrophyEmptyHint short />
        ) : (
          items.map((t) => {
            const tooltipText = trophyTooltipText(
              label,
              t.rank,
              t.periodStartMs,
              timeframe
            );
            const rankAccent =
              t.rank === 1
                ? size === "lg"
                  ? "ring-2 ring-amber-400/50 shadow-lg shadow-amber-950/35"
                  : size === "md"
                    ? "ring-2 ring-amber-400/40 shadow-md shadow-amber-950/25"
                    : "ring-1 ring-amber-400/35"
                : "";
            return (
              <span
                key={t.id}
                className={`group relative inline-flex shrink-0 cursor-default select-none ${shellClass} ${rankAccent}`.trim()}
                aria-label={tooltipText}
              >
                <span
                  className={`inline-flex items-center justify-center ${sizeClass}`}
                  aria-hidden
                >
                  {rankMedal(t.rank)}
                </span>
                <span
                  role="tooltip"
                  className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-1.5 -translate-x-1/2 whitespace-nowrap rounded bg-zinc-800 px-2 py-1 text-xs text-zinc-200 opacity-0 shadow transition-opacity delay-75 duration-150 group-hover:opacity-100"
                >
                  {tooltipText}
                </span>
              </span>
            );
          })
        )}
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  loading,
  accent,
  selected,
  onSelect,
}: {
  title: string;
  value: ReactNode;
  loading?: boolean;
  accent?: boolean;
  selected?: boolean;
  onSelect?: () => void;
}) {
  const tile = (
    <div
      className={`${terminalPage.statTile} relative isolate flex min-h-[5.75rem] flex-col justify-between ${CARD_HOVER} motion-safe:hover:brightness-[1.03] ${
        accent ? "border-cyan-500/25 ring-1 ring-cyan-500/10" : ""
      } ${
        selected
          ? "border-cyan-400/50 ring-2 ring-cyan-400/30 shadow-[0_0_28px_-12px_rgba(34,211,238,0.32)]"
          : ""
      }`}
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
        {title}
      </p>
      {loading ? (
        <div
          className="mt-2 h-8 w-20 max-w-full animate-pulse rounded-md bg-zinc-800/90"
          aria-busy
          aria-label="Loading"
        />
      ) : (
        <div
          className={`mt-1 text-[1.65rem] font-bold tabular-nums tracking-tight sm:text-[1.75rem] ${
            accent
              ? "bg-gradient-to-br from-cyan-50 via-cyan-200 to-cyan-400 bg-clip-text text-transparent"
              : "text-zinc-50"
          }`}
        >
          {value}
        </div>
      )}
    </div>
  );

  if (!onSelect) return tile;

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className="w-full cursor-pointer rounded-xl text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/40"
    >
      {tile}
    </button>
  );
}

function PanelCard({
  title,
  badge,
  children,
  className = "",
  "data-tutorial": dataTutorial,
}: {
  title: string;
  badge?: ReactNode;
  children: ReactNode;
  className?: string;
  "data-tutorial"?: string;
}) {
  return (
    <div
      data-tutorial={dataTutorial}
      className={`${terminalSurface.insetPanel} ${terminalSurface.insetEdge} relative isolate w-full px-4 py-4 sm:px-5 sm:py-5 ${CARD_HOVER} ${className}`.trim()}
    >
      <div className="pointer-events-none absolute inset-x-4 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400/25 to-transparent sm:inset-x-5" />
      <div className="relative mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800/50 pb-3">
        <h2 className="flex min-w-0 items-center gap-2.5 text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-400">
          <span
            className="inline-flex h-1 w-1 shrink-0 rounded-full bg-cyan-400/90 shadow-[0_0_10px_rgba(34,211,238,0.45)]"
            aria-hidden
          />
          {title}
        </h2>
        {badge != null ? (
          <span className="shrink-0 rounded-full border border-zinc-700/45 bg-zinc-950/70 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500 tabular-nums">
            {badge}
          </span>
        ) : null}
      </div>
      {children}
    </div>
  );
}

function DepthMetricsGrid({
  keyStats: ks,
}: {
  keyStats: NonNullable<ProfilePayload["keyStats"]>;
}) {
  const baseTile = terminalPage.statTile;
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {ks.bestMultiple != null ? (
        <div
          className={`${baseTile} border-emerald-500/20 bg-gradient-to-br from-emerald-950/35 via-zinc-900/90 to-zinc-950 ring-emerald-500/10`}
        >
          <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
            Peak multiple
          </p>
          <p className="mt-1 bg-gradient-to-br from-emerald-100 to-emerald-400 bg-clip-text text-xl font-bold tabular-nums text-transparent">
            {ks.bestMultiple.toFixed(1)}×
          </p>
        </div>
      ) : null}
      {ks.medianMultiple != null ? (
        <div className={`${baseTile} border-zinc-800/50 bg-gradient-to-br from-zinc-900/70 to-zinc-950`}>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
            Median X
          </p>
          <p className="mt-1 text-xl font-bold tabular-nums text-zinc-50">
            {ks.medianMultiple.toFixed(1)}×
          </p>
        </div>
      ) : null}
      {ks.last10Avg != null ? (
        <div
          className={`${baseTile} border-cyan-500/18 bg-gradient-to-br from-cyan-950/25 via-zinc-900/85 to-zinc-950 ring-cyan-500/8`}
        >
          <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
            Last 10 avg
          </p>
          <p className="mt-1 bg-gradient-to-br from-cyan-100 to-cyan-300 bg-clip-text text-xl font-bold tabular-nums text-transparent">
            {ks.last10Avg.toFixed(1)}×
          </p>
        </div>
      ) : null}
    </div>
  );
}

function parseProfile(json: unknown): ProfilePayload | null {
  if (!json || typeof json !== "object" || "error" in json) return null;
  const o = json as Record<string, unknown>;
  const discordRaw = o.discordId ?? o.discord_id;
  const discordId =
    typeof discordRaw === "string" && discordRaw.trim()
      ? discordRaw.trim()
      : "";
  const username = typeof o.username === "string" ? o.username : "";
  const displayNameFromApi =
    typeof o.displayName === "string" && o.displayName.trim() !== ""
      ? o.displayName.trim()
      : (username || "").trim() || "Profile";
  const avatarUrlRaw = o.avatarUrl ?? o.avatar_url;
  const avatarUrl =
    avatarUrlRaw != null &&
    typeof avatarUrlRaw === "string" &&
    avatarUrlRaw.trim() !== ""
      ? avatarUrlRaw.trim().slice(0, 800)
      : null;
  const statsRaw = o.stats;
  if (!statsRaw || typeof statsRaw !== "object") return null;
  const s = statsRaw as Record<string, unknown>;
  const stats: ProfileStats = {
    avgX: typeof s.avgX === "number" ? s.avgX : Number(s.avgX) || 0,
    winRate:
      typeof s.winRate === "number" ? s.winRate : Number(s.winRate) || 0,
    totalCalls:
      typeof s.totalCalls === "number"
        ? s.totalCalls
        : Number(s.totalCalls) || 0,
  };
  const recentRaw = o.recentCalls;
  const recentCalls: RecentCallRow[] = [];
  if (Array.isArray(recentRaw)) {
    for (const row of recentRaw) {
      if (!row || typeof row !== "object") continue;
      const r = row as Record<string, unknown>;
      if (r.excludedFromStats === true || r.excluded_from_stats === true) continue;
      const id =
        typeof r.id === "string"
          ? r.id.trim()
          : r.id == null
            ? ""
            : String(r.id).trim();
      const token =
        typeof r.token === "string" ? r.token : String(r.token ?? "");
      const multiple = Number(r.multiple);
      if (!Number.isFinite(multiple)) continue;
      const tokenName =
        typeof r.tokenName === "string" && r.tokenName.trim()
          ? r.tokenName.trim()
          : typeof r.token_name === "string" && r.token_name.trim()
            ? r.token_name.trim()
            : null;
      const tokenTicker =
        typeof r.tokenTicker === "string" && r.tokenTicker.trim()
          ? r.tokenTicker.trim()
          : typeof r.token_ticker === "string" && r.token_ticker.trim()
            ? r.token_ticker.trim()
            : null;
      const mcRaw = r.callMarketCapUsd ?? r.call_market_cap_usd;
      const mcNum =
        typeof mcRaw === "number" ? mcRaw : Number(mcRaw ?? NaN);
      const imgRaw = r.tokenImageUrl ?? r.token_image_url;
      const tokenImageUrl =
        typeof imgRaw === "string" && imgRaw.trim() ? imgRaw.trim() : null;
      recentCalls.push({
        id: id || undefined,
        token: token || "Unknown",
        multiple,
        time: r.time,
        excludedFromStats: r.excludedFromStats === true,
        tokenName,
        tokenTicker,
        callMarketCapUsd:
          Number.isFinite(mcNum) && mcNum > 0 ? mcNum : null,
        tokenImageUrl,
      });
    }
  }
  if (!discordId) return null;
  return {
    discordId,
    username,
    displayName: displayNameFromApi,
    avatarUrl,
    isTopCaller: Boolean(o.isTopCaller),
    isTrustedPro: Boolean(o.isTrustedPro),
    bio:
      o.bio == null
        ? null
        : typeof o.bio === "string"
          ? o.bio
          : String(o.bio),
    created_at: o.created_at ?? o.createdAt ?? null,
    banner_url:
      (o.banner_url ?? o.bannerUrl) == null
        ? null
        : typeof (o.banner_url ?? o.bannerUrl) === "string"
          ? String(o.banner_url ?? o.bannerUrl)
          : String(o.banner_url ?? o.bannerUrl),
    banner_crop_x:
      (o.banner_crop_x ?? o.bannerCropX) == null
        ? null
        : clampCropPercent(o.banner_crop_x ?? o.bannerCropX, 50),
    banner_crop_y:
      (o.banner_crop_y ?? o.bannerCropY) == null
        ? null
        : clampCropPercent(o.banner_crop_y ?? o.bannerCropY, 50),
    x_handle:
      (o.x_handle ?? o.xHandle) == null
        ? null
        : typeof (o.x_handle ?? o.xHandle) === "string"
          ? String(o.x_handle ?? o.xHandle)
          : String(o.x_handle ?? o.xHandle),
    x_verified: Boolean(o.x_verified ?? o.xVerified),
    callDistribution:
      o.callDistribution && typeof o.callDistribution === "object"
        ? {
            under1: Number((o.callDistribution as any).under1) || 0,
            oneToTwo: Number((o.callDistribution as any).oneToTwo) || 0,
            twoToFive: Number((o.callDistribution as any).twoToFive) || 0,
            fivePlus: Number((o.callDistribution as any).fivePlus) || 0,
            total: Number((o.callDistribution as any).total) || 0,
          }
        : undefined,
    keyStats:
      o.keyStats && typeof o.keyStats === "object"
        ? {
            bestMultiple:
              typeof (o.keyStats as any).bestMultiple === "number"
                ? (o.keyStats as any).bestMultiple
                : (o.keyStats as any).bestMultiple == null
                  ? null
                  : Number((o.keyStats as any).bestMultiple) || null,
            medianMultiple:
              typeof (o.keyStats as any).medianMultiple === "number"
                ? (o.keyStats as any).medianMultiple
                : (o.keyStats as any).medianMultiple == null
                  ? null
                  : Number((o.keyStats as any).medianMultiple) || null,
            last10Avg:
              typeof (o.keyStats as any).last10Avg === "number"
                ? (o.keyStats as any).last10Avg
                : (o.keyStats as any).last10Avg == null
                  ? null
                  : Number((o.keyStats as any).last10Avg) || null,
          }
        : undefined,
    profile_visibility:
      o.profile_visibility && typeof o.profile_visibility === "object"
        ? (o.profile_visibility as any)
        : null,
    stats,
    recentCalls,
    callerIntel:
      o.callerIntel && typeof o.callerIntel === "object"
        ? (o.callerIntel as CallerProfileIntel)
        : null,
  };
}

export default function ProfilePageClient() {
  const params = useParams();
  const raw = params?.id;
  const userId =
    typeof raw === "string" ? raw : Array.isArray(raw) ? raw[0] : "";
  /** Next passes one decode; normalize in case of legacy double-encoded paths. */
  const profileUserId = (() => {
    let v = userId.trim();
    for (let i = 0; i < 3 && v.includes("%"); i++) {
      try {
        const next = decodeURIComponent(v);
        if (next === v) break;
        v = next;
      } catch {
        break;
      }
    }
    return v;
  })();
  const { data: session } = useSession();
  const { addNotification } = useNotifications();
  const isAdmin =
    (session?.user as { helpTier?: string } | undefined)?.helpTier === "admin";
  const canModerate = session?.user?.canModerate === true;

  const { followingIds, setFollowing } = useFollowingIds();
  const [profile, setProfile] = useState<ProfilePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [adminBusy, setAdminBusy] = useState(false);
  const [adminOk, setAdminOk] = useState<string | null>(null);
  const [statsResetMode, setStatsResetMode] = useState<"full" | "cutover">("full");
  const [statsCutoverLocal, setStatsCutoverLocal] = useState("");
  const [followStats, setFollowStats] = useState<{
    followers: number;
    following: number;
    isFollowing: boolean;
  } | null>(null);
  const [trophies, setTrophies] = useState<TrophiesByTimeframe | null>(null);
  const [milestoneTrophies, setMilestoneTrophies] = useState<MilestoneTrophyRow[]>(
    []
  );
  const [trophiesLoading, setTrophiesLoading] = useState(true);
  const [badges, setBadges] = useState<string[]>([]);
  const [editOpen, setEditOpen] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [editBio, setEditBio] = useState("");
  const [editBannerUrl, setEditBannerUrl] = useState("");
  const [editBannerCropX, setEditBannerCropX] = useState<number>(50);
  const [editBannerCropY, setEditBannerCropY] = useState<number>(50);
  const [editXHandle, setEditXHandle] = useState("");
  const [editError, setEditError] = useState<string | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState("rugs");
  const [reportDetails, setReportDetails] = useState("");
  const [reportEvidence, setReportEvidence] = useState("");
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [pinnedCall, setPinnedCall] = useState<{
    id: string;
    token: string;
    multiple: number;
    time: unknown;
  } | null>(null);
  const [pinnedLoading, setPinnedLoading] = useState(true);
  const [trustedProCallsLoading, setTrustedProCallsLoading] = useState(false);
  const [trustedProCallsErr, setTrustedProCallsErr] = useState<string | null>(null);
  const [trustedProCalls, setTrustedProCalls] = useState<TrustedProCallRow[]>([]);
  const [trustedProIncludeAll, setTrustedProIncludeAll] = useState(false);

  const resolvedSnowflake =
    profile?.discordId?.trim() ||
    (looksLikeDiscordSnowflake(profileUserId) ? profileUserId.trim() : "");

  const isOwnProfile =
    !!session?.user?.id?.trim() &&
    (!!resolvedSnowflake
      ? session.user.id.trim() === resolvedSnowflake
      : looksLikeDiscordSnowflake(profileUserId) &&
        session.user.id.trim() === profileUserId.trim());

  const hasDeskAccess = session?.user?.hasDashboardAccess === true;
  const showProfileDeskUpsell =
    !isOwnProfile &&
    !loading &&
    profile != null &&
    (status === "unauthenticated" || (status === "authenticated" && !hasDeskAccess));

  const fetchProfile = useCallback(async (signal?: AbortSignal) => {
    if (!profileUserId) {
      setLoading(false);
      setError("Invalid profile link.");
      setProfile(null);
      return false;
    }

    setLoading(true);
    setError(null);

    const url = `/api/user/${encodeURIComponent(profileUserId)}`;
    try {
      const res = await fetch(url, { signal, cache: "no-store" });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        const msg =
          data &&
          typeof data === "object" &&
          typeof (data as { error?: string }).error === "string"
            ? (data as { error: string }).error
            : "Could not load profile.";
        setError(msg);
        setProfile(null);
        return false;
      }
      const parsed = parseProfile(data);
      if (!parsed) {
        setError("Invalid profile response.");
        setProfile(null);
        return false;
      }
      setProfile(parsed);
      setError(null);
      return true;
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") {
        return false;
      }
      if (e instanceof Error && e.name === "AbortError") {
        return false;
      }
      setError("Could not load profile.");
      setProfile(null);
      return false;
    } finally {
      setLoading(false);
    }
  }, [profileUserId]);

  const loadTrustedProCalls = useCallback(async () => {
    if (!profileUserId) return;
    setTrustedProCallsErr(null);
    setTrustedProCallsLoading(true);
    try {
      const url = `/api/user/${encodeURIComponent(profileUserId)}/trusted-pro-calls`;
      const res = await fetch(url, { credentials: "same-origin" });
      const json = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        error?: string;
        rows?: unknown;
        includeAllStatuses?: boolean;
      };
      if (!res.ok || json.success !== true) {
        setTrustedProCallsErr(
          typeof json.error === "string"
            ? json.error
            : "Failed to load Trusted Pro calls."
        );
        setTrustedProCalls([]);
        setTrustedProIncludeAll(false);
        return;
      }
      setTrustedProIncludeAll(Boolean(json.includeAllStatuses));
      const rowsIn = Array.isArray(json.rows) ? (json.rows as unknown[]) : [];
      const parsed: TrustedProCallRow[] = [];
      for (const r of rowsIn) {
        if (!r || typeof r !== "object") continue;
        const o = r as Record<string, unknown>;
        const id = typeof o.id === "string" ? o.id : "";
        const ca = typeof o.contract_address === "string" ? o.contract_address : "";
        const thesis = typeof o.thesis === "string" ? o.thesis : "";
        const status = typeof o.status === "string" ? o.status : "";
        const createdAt = typeof o.created_at === "string" ? o.created_at : "";
        if (!id || !ca || !thesis || !status || !createdAt) continue;
        parsed.push({
          id,
          contract_address: ca,
          thesis,
          status,
          staff_notes: typeof o.staff_notes === "string" ? o.staff_notes : null,
          reviewed_at: typeof o.reviewed_at === "string" ? o.reviewed_at : null,
          published_at: typeof o.published_at === "string" ? o.published_at : null,
          views_count: Number.isFinite(Number((o as any).views_count))
            ? Number((o as any).views_count)
            : 0,
          created_at: createdAt,
        });
      }
      setTrustedProCalls(parsed);
    } catch {
      setTrustedProCallsErr("Failed to load Trusted Pro calls.");
      setTrustedProCalls([]);
      setTrustedProIncludeAll(false);
    } finally {
      setTrustedProCallsLoading(false);
    }
  }, [profileUserId]);

  const resetUserStats = useCallback(async () => {
    if (!isAdmin) return;
    const targetId = resolvedSnowflake;
    if (!targetId) {
      window.alert("Profile could not be resolved yet — try again in a moment.");
      return;
    }
    let body: Record<string, string> = {};
    let confirmMsg =
      "Reset this user’s stats?\n\nThis excludes ALL of their existing calls from leaderboards and performance stats (history is retained).\n\nFull reset also clears leaderboard trophies and milestone “clubs” for this account.";
    if (statsResetMode === "cutover") {
      if (!statsCutoverLocal.trim()) {
        window.alert("Choose a date and time first — only calls at or after that instant will count toward stats.");
        return;
      }
      const iso = new Date(statsCutoverLocal).toISOString();
      body = { statsFromUtc: iso };
      confirmMsg = `Apply stats cutover?\n\nCalls before ${iso} will be excluded; calls on or after that time stay eligible (per-call exclusions preserved where possible).`;
    }
    const ok = window.confirm(confirmMsg);
    if (!ok) return;
    setAdminBusy(true);
    setAdminOk(null);
    setError(null);
    try {
      const res = await fetch(
        `/api/admin/users/${encodeURIComponent(targetId)}/reset-stats`,
        {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      );
      const json = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        excluded?: number | null;
        mode?: string;
        error?: string;
        trophiesDeleted?: number | null;
        milestoneTrophiesDeleted?: number | null;
      };
      if (!res.ok || json.success !== true) {
        setError(
          typeof json.error === "string" ? json.error : "Reset failed."
        );
        return;
      }
      if (json.mode === "cutover") {
        setAdminOk("Cutover applied. Stats now use calls on or after the chosen time.");
      } else {
        const n = typeof json.excluded === "number" ? json.excluded : null;
        const t = typeof json.trophiesDeleted === "number" ? json.trophiesDeleted : null;
        const m =
          typeof json.milestoneTrophiesDeleted === "number"
            ? json.milestoneTrophiesDeleted
            : null;
        const bits = [
          n == null ? "Reset complete." : `Excluded ${n} call row(s) from stats.`,
          t != null ? `Leaderboard trophies removed: ${t}.` : null,
          m != null ? `Milestone clubs cleared: ${m}.` : null,
        ].filter(Boolean);
        setAdminOk(bits.join(" "));
      }
      void fetchProfile();
    } catch {
      setError("Reset failed.");
    } finally {
      setAdminBusy(false);
    }
  }, [
    fetchProfile,
    isAdmin,
    resolvedSnowflake,
    statsCutoverLocal,
    statsResetMode,
  ]);

  const resetUserTrophies = useCallback(async () => {
    if (!isAdmin) return;
    const targetId = resolvedSnowflake;
    if (!targetId) {
      window.alert("Profile could not be resolved yet — try again in a moment.");
      return;
    }
    const ok = window.confirm(
      "Delete all leaderboard trophies for this user? This cannot be undone."
    );
    if (!ok) return;
    setAdminBusy(true);
    setAdminOk(null);
    setError(null);
    try {
      const res = await fetch(
        `/api/admin/users/${encodeURIComponent(targetId)}/reset-trophies`,
        { method: "POST", credentials: "same-origin" }
      );
      const json = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        deleted?: number | null;
        milestoneTrophiesDeleted?: number | null;
        error?: string;
      };
      if (!res.ok || json.success !== true) {
        setError(
          typeof json.error === "string" ? json.error : "Trophy reset failed."
        );
        return;
      }
      const d = json.deleted;
      const m =
        typeof json.milestoneTrophiesDeleted === "number"
          ? json.milestoneTrophiesDeleted
          : null;
      setAdminOk(
        typeof d === "number"
          ? `Removed ${d} trophy row${d === 1 ? "" : "s"}${
              m != null ? `; ${m} milestone club${m === 1 ? "" : "s"} cleared.` : "."
            }`
          : "Trophies cleared."
      );
      void fetchProfile();
    } catch {
      setError("Trophy reset failed.");
    } finally {
      setAdminBusy(false);
    }
  }, [fetchProfile, isAdmin, resolvedSnowflake]);

  const unlinkUserX = useCallback(async () => {
    if (!isAdmin) return;
    const targetId = resolvedSnowflake;
    if (!targetId) {
      window.alert("Profile could not be resolved yet — try again in a moment.");
      return;
    }
    const ok = window.confirm(
      "Unlink this user’s X (Twitter) handle from their profile?"
    );
    if (!ok) return;
    setAdminBusy(true);
    setAdminOk(null);
    setError(null);
    try {
      const res = await fetch(
        `/api/admin/users/${encodeURIComponent(targetId)}/unlink-x`,
        { method: "POST", credentials: "same-origin" }
      );
      const json = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        error?: string;
      };
      if (!res.ok || json.success !== true) {
        setError(
          typeof json.error === "string" ? json.error : "Unlink failed."
        );
        return;
      }
      setAdminOk("X account unlinked.");
      void fetchProfile();
    } catch {
      setError("Unlink failed.");
    } finally {
      setAdminBusy(false);
    }
  }, [fetchProfile, isAdmin, resolvedSnowflake]);

  const setCallExcluded = useCallback(
    async (callId: string, excluded: boolean) => {
      if (!isAdmin) return;
      const id = callId.trim();
      if (!id) return;
      setAdminBusy(true);
      setAdminOk(null);
      setError(null);
      try {
        const res = await fetch(
          `/api/admin/calls/${encodeURIComponent(id)}/exclusion`,
          {
            method: "PATCH",
            credentials: "same-origin",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              excluded,
              reason: excluded ? "admin_profile_toggle" : "",
            }),
          }
        );
        const json = (await res.json().catch(() => ({}))) as {
          success?: boolean;
          error?: string;
        };
        if (!res.ok || json.success !== true) {
          setError(
            typeof json.error === "string"
              ? json.error
              : "Could not update exclusion."
          );
          return;
        }
        setAdminOk(excluded ? "Call excluded from stats." : "Call restored to stats.");
        void fetchProfile();
      } catch {
        setError("Could not update exclusion.");
      } finally {
        setAdminBusy(false);
      }
    },
    [fetchProfile, isAdmin]
  );

  useEffect(() => {
    const controller = new AbortController();
    void fetchProfile(controller.signal);
    return () => {
      controller.abort();
    };
  }, [fetchProfile]);

  useEffect(() => {
    setTrustedProCalls([]);
    setTrustedProCallsErr(null);
    setTrustedProIncludeAll(false);
    setTrustedProCallsLoading(false);
  }, [profileUserId]);

  useEffect(() => {
    if (!profileUserId || loading) return;
    if (!profile?.isTrustedPro) {
      setTrustedProCalls([]);
      setTrustedProCallsErr(null);
      setTrustedProIncludeAll(false);
      setTrustedProCallsLoading(false);
      return;
    }
    void loadTrustedProCalls();
  }, [profileUserId, loading, profile?.isTrustedPro, loadTrustedProCalls]);

  useEffect(() => {
    if (!profileUserId) {
      setPinnedCall(null);
      setPinnedLoading(false);
      return;
    }
    let cancelled = false;
    setPinnedLoading(true);
    const url = `/api/user/${encodeURIComponent(profileUserId)}/pinned-call`;
    fetch(url)
      .then((res) => res.json().then((data) => ({ ok: res.ok, data })))
      .then(({ ok, data }) => {
        if (cancelled) return;
        if (!ok || !data || typeof data !== "object") {
          setPinnedCall(null);
          return;
        }
        const pc = (data as any).pinnedCall;
        if (!pc || typeof pc !== "object") {
          setPinnedCall(null);
          return;
        }
        const o = pc as Record<string, unknown>;
        const id = String(o.id ?? "").trim();
        if (!id) {
          setPinnedCall(null);
          return;
        }
        setPinnedCall({
          id,
          token: String(o.token ?? "Unknown"),
          multiple: Number(o.multiple ?? 0),
          time: o.time,
        });
      })
      .catch(() => {
        if (!cancelled) setPinnedCall(null);
      })
      .finally(() => {
        if (!cancelled) setPinnedLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [profileUserId]);

  useEffect(() => {
    if (!editOpen || !isOwnProfile) return;
    let cancelled = false;
    setEditLoading(true);
    setEditError(null);
    (async () => {
      try {
        const res = await fetch("/api/profile", { credentials: "same-origin" });
        if (!res.ok) {
          console.error("Profile fetch failed:", await res.text());
          if (!cancelled) {
            setEditBio("");
            setEditBannerUrl("");
            setEditBannerCropX(50);
            setEditBannerCropY(50);
            setEditXHandle("");
          }
          return;
        }

        const data = (await res.json().catch(() => null)) as unknown;

        if (!data || typeof data !== "object") return;
        const o = data as Record<string, unknown>;
        const bio = o.bio;
        const banner = o.banner_url ?? o.bannerUrl;
        const cropX = o.banner_crop_x ?? o.bannerCropX;
        const cropY = o.banner_crop_y ?? o.bannerCropY;
        const xh = o.x_handle ?? o.xHandle;

        if (cancelled) return;
        setEditBio(typeof bio === "string" ? bio : bio == null ? "" : String(bio));
        setEditBannerUrl(
          typeof banner === "string" ? banner : banner == null ? "" : String(banner)
        );
        setEditBannerCropX(clampCropPercent(cropX, 50));
        setEditBannerCropY(clampCropPercent(cropY, 50));
        setEditXHandle(
          typeof xh === "string"
            ? xh.replace(/^@+/, "")
            : xh == null
              ? ""
              : String(xh)
        );
      } catch (err) {
        console.error("Profile fetch failed:", err);
        if (!cancelled) {
          setEditBio("");
          setEditBannerUrl("");
          setEditBannerCropX(50);
          setEditBannerCropY(50);
          setEditXHandle("");
        }
      } finally {
        if (!cancelled) setEditLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [editOpen, isOwnProfile]);

  useEffect(() => {
    if (!resolvedSnowflake) {
      setBadges([]);
      return;
    }
    let cancelled = false;
    const url = `/api/user/${encodeURIComponent(resolvedSnowflake)}/badges`;
    fetch(url)
      .then((res) => res.json().then((data) => ({ ok: res.ok, data })))
      .then(({ ok, data }) => {
        if (cancelled) return;
        if (!ok) {
          setBadges([]);
          return;
        }
        if (Array.isArray(data)) {
          const next = data
            .map((b) => (typeof b === "string" ? b.trim() : String(b ?? "").trim()))
            .filter(Boolean);
          setBadges(next);
        } else {
          setBadges([]);
        }
      })
      .catch(() => {
        if (!cancelled) setBadges([]);
      });
    return () => {
      cancelled = true;
    };
  }, [resolvedSnowflake]);

  useEffect(() => {
    if (!resolvedSnowflake) return;
    let cancelled = false;
    setFollowStats(null);
    const q = encodeURIComponent(resolvedSnowflake);
    fetch(`/api/follow?userId=${q}`)
      .then((res) => res.json().then((data) => ({ ok: res.ok, data })))
      .then(({ ok, data }) => {
        if (cancelled) return;
        if (!ok || !data || typeof data !== "object") return;
        const d = data as Record<string, unknown>;
        const followers = d.followers;
        const following = d.following;
        if (typeof followers !== "number" || typeof following !== "number") {
          return;
        }
        setFollowStats({
          followers,
          following,
          isFollowing: Boolean(d.isFollowing),
        });
      })
      .catch(() => {})
      .finally(() => {
        if (cancelled) return;
        setFollowStats((prev) =>
          prev ?? { followers: 0, following: 0, isFollowing: false }
        );
      });
    return () => {
      cancelled = true;
    };
  }, [resolvedSnowflake]);

  useEffect(() => {
    if (!resolvedSnowflake) {
      setTrophiesLoading(false);
      setTrophies(null);
      setMilestoneTrophies([]);
      return;
    }

    let cancelled = false;
    setTrophiesLoading(true);
    const base = `/api/user/${encodeURIComponent(resolvedSnowflake)}`;

    Promise.all([
      fetch(`${base}/trophies`).then((res) =>
        res.json().then((data) => ({ ok: res.ok, data }))
      ),
      fetch(`${base}/milestone-trophies`).then((res) =>
        res.json().then((data) => ({ ok: res.ok, data }))
      ),
    ])
      .then(([{ ok: okT, data: dataT }, { ok: okM, data: dataM }]) => {
        if (cancelled) return;
        if (okT) setTrophies(parseTrophiesPayload(dataT));
        else setTrophies(null);
        if (okM) setMilestoneTrophies(parseMilestoneTrophiesPayload(dataM));
        else setMilestoneTrophies([]);
      })
      .catch(() => {
        if (!cancelled) {
          setTrophies(null);
          setMilestoneTrophies([]);
        }
      })
      .finally(() => {
        if (!cancelled) setTrophiesLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [resolvedSnowflake]);

  const refreshFollowStats = useCallback(async () => {
    const id = resolvedSnowflake;
    if (!id) return;
    const q = encodeURIComponent(id);
    try {
      const res = await fetch(`/api/follow?userId=${q}`);
      const data = await res.json().catch(() => null);
      if (!res.ok || !data || typeof data !== "object") {
        return;
      }
      const d = data as Record<string, unknown>;
      const followers = d.followers;
      const following = d.following;
      if (typeof followers !== "number" || typeof following !== "number") {
        return;
      }
      setFollowStats({
        followers,
        following,
        isFollowing: Boolean(d.isFollowing),
      });
    } catch (e) {
    }
  }, [resolvedSnowflake]);

  const submitProfileReport = useCallback(async () => {
    const target = resolvedSnowflake;
    if (!target) return;
    if (reportSubmitting) return;
    const reason = reportReason.trim();
    if (!reason) return;
    setReportSubmitting(true);
    try {
      const evidenceUrls = reportEvidence
        .split(/\r?\n/)
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 8);
      const res = await fetch("/api/report/profile", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetUserId: target,
          reason,
          details: reportDetails.trim() || null,
          evidenceUrls,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json || json.success !== true) {
        addNotification({
          id: crypto.randomUUID(),
          text:
            typeof (json as any).error === "string"
              ? (json as any).error
              : "Failed to submit report.",
          type: "call",
          createdAt: Date.now(),
          priority: "low",
        });
        return;
      }
      addNotification({
        id: crypto.randomUUID(),
        text: "Report submitted. Thank you.",
        type: "call",
        createdAt: Date.now(),
        priority: "medium",
      });
      setReportOpen(false);
      setReportDetails("");
      setReportEvidence("");
    } catch {
      addNotification({
        id: crypto.randomUUID(),
        text: "Failed to submit report.",
        type: "call",
        createdAt: Date.now(),
        priority: "low",
      });
    } finally {
      setReportSubmitting(false);
    }
  }, [addNotification, reportDetails, reportEvidence, reportReason, reportSubmitting, resolvedSnowflake]);

  const nowMs = Date.now();
  const snowflakeForFollow = resolvedSnowflake;
  const uid = resolvedSnowflake || profileUserId;
  const avatarSrc =
    isOwnProfile && session?.user?.image
      ? session.user.image
      : profile?.avatarUrl?.trim()
        ? profile.avatarUrl.trim()
        : discordDefaultEmbedAvatarUrl(uid);

  const displayName =
    isOwnProfile && session?.user?.name?.trim()
      ? session.user.name.trim()
      : profile?.displayName?.trim() ||
          profile?.username?.trim() ||
          uid ||
          "Profile";

  const showNameSkeleton =
    loading && !profile && !(isOwnProfile && session?.user?.name?.trim());

  const followingState =
    followStats !== null
      ? followStats.isFollowing
      : snowflakeForFollow
        ? followingIds.has(snowflakeForFollow)
        : false;

  const topCallerTimes = parseTopCallerTimesFromBadges(badges);
  /** Honor chips follow `/api/user/.../badges`, which only includes these when the Discord roles are present. */
  const showTopCallerChip = topCallerTimes > 0;
  const showTrustedProBadgeChip = badges.includes("trusted_pro");
  const isTrustedPro = Boolean(profile?.isTrustedPro);

  const bannerUrl = profile?.banner_url?.trim() || "";
  const bioText = profile?.bio?.trim() || "";
  const joinedText = !loading
    ? formatDateJoined(profile?.created_at)
    : null;
  const hitRates = computeHitRates(profile?.recentCalls || []);
  const bestCall = computeBestCall(profile?.recentCalls || []);
  const recentForm = getRecentForm(profile?.recentCalls || []);
  const avgMultiple = profile?.stats?.avgX ?? null;
  const winRate = profile?.stats?.winRate ?? null;
  const stats = {
    median: profile?.keyStats?.medianMultiple ?? null,
    last10Avg: profile?.keyStats?.last10Avg ?? null,
  };
  const alphaScore = computeAlphaScore({
    avg: avgMultiple,
    median: stats.median,
    last10: stats.last10Avg,
    winRate: winRate,
  });

  const [trackChartMetric, setTrackChartMetric] = useState<ProfileTrackMetric>("avg_x");

  const trackChartView = useMemo(
    () =>
      buildProfileTrackChartView(
        trackChartMetric,
        {
          recentCalls: profile?.recentCalls ?? [],
          callDistribution: profile?.callDistribution,
          stats: profile?.stats ?? { avgX: 0, winRate: 0, totalCalls: 0 },
          hitRates,
        },
        nowMs
      ),
    [
      trackChartMetric,
      profile?.recentCalls,
      profile?.callDistribution,
      profile?.stats,
      hitRates,
      nowMs,
    ]
  );

  const xHandle = profile?.x_handle?.trim() || "";
  const xVerified = Boolean(profile?.x_verified);

  const visibility = {
    show_stats: profile?.profile_visibility?.show_stats ?? true,
    show_trophies: profile?.profile_visibility?.show_trophies ?? true,
    show_calls: profile?.profile_visibility?.show_calls ?? true,
    show_key_stats: profile?.profile_visibility?.show_key_stats ?? true,
    show_pinned_call: profile?.profile_visibility?.show_pinned_call ?? true,
  };

  const profileNavItems = useMemo(() => {
    const items: { href: string; id: string; label: string }[] = [];
    if (visibility.show_pinned_call) {
      items.push({ href: "#signature-pick", id: "signature-pick", label: "Signature" });
    }
    if (visibility.show_stats) {
      items.push({ href: "#performance", id: "performance", label: "Performance" });
    }
    if (visibility.show_trophies) {
      items.push({ href: "#trophies", id: "trophies", label: "Trophies" });
    }
    items.push({ href: "#distribution", id: "distribution", label: "Distribution" });
    if (isTrustedPro) {
      items.push({ href: "#trusted-pro", id: "trusted-pro", label: "Trusted Pro" });
    }
    if (visibility.show_calls) {
      items.push({ href: "#recent-calls", id: "recent-calls", label: "Recent calls" });
    }
    return items;
  }, [
    visibility.show_pinned_call,
    visibility.show_stats,
    visibility.show_trophies,
    visibility.show_calls,
    isTrustedPro,
  ]);

  const [activeProfileSection, setActiveProfileSection] = useState(
    () => profileNavItems[0]?.id ?? "performance"
  );

  const profilePageColumnRef = useRef<HTMLDivElement>(null);
  const profileHeroRef = useRef<HTMLDivElement>(null);
  const deskNavRef = useRef<HTMLElement>(null);
  const [deskNavLeftPx, setDeskNavLeftPx] = useState<number | null>(null);
  const [deskNavTopPx, setDeskNavTopPx] = useState<number | null>(null);

  useEffect(() => {
    const column = profilePageColumnRef.current;
    const hero = profileHeroRef.current;
    if (!column || !hero || profileNavItems.length <= 1) {
      setDeskNavLeftPx(null);
      setDeskNavTopPx(null);
      return;
    }

    const syncDeskNavPosition = () => {
      if (!window.matchMedia("(min-width: 1024px)").matches) {
        setDeskNavLeftPx(null);
        setDeskNavTopPx(null);
        return;
      }
      const nav = deskNavRef.current;
      if (!nav) return;

      const columnRect = column.getBoundingClientRect();
      const heroBottom = hero.getBoundingClientRect().bottom;
      const navHeight = nav.offsetHeight;
      const stickyTop = readStickyBelowChromePx();

      setDeskNavLeftPx(
        Math.max(12, columnRect.left - PROFILE_DESK_NAV_WIDTH_PX - PROFILE_DESK_NAV_GAP_PX)
      );
      setDeskNavTopPx(Math.max(stickyTop, heroBottom - navHeight));
    };

    syncDeskNavPosition();
    const raf = requestAnimationFrame(syncDeskNavPosition);
    const observer = new ResizeObserver(syncDeskNavPosition);
    observer.observe(column);
    observer.observe(hero);
    const navEl = deskNavRef.current;
    if (navEl) observer.observe(navEl);
    window.addEventListener("resize", syncDeskNavPosition);
    window.addEventListener("scroll", syncDeskNavPosition, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      window.removeEventListener("resize", syncDeskNavPosition);
      window.removeEventListener("scroll", syncDeskNavPosition);
    };
  }, [profileNavItems.length, loading]);

  useEffect(() => {
    if (profileNavItems.length === 0) return;
    const elements = profileNavItems
      .map((item) => document.getElementById(item.id))
      .filter((el): el is HTMLElement => el != null);
    if (elements.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        const top = visible[0]?.target;
        if (top?.id) setActiveProfileSection(top.id);
      },
      { rootMargin: "-18% 0px -58% 0px", threshold: [0.08, 0.2, 0.45] }
    );

    for (const el of elements) observer.observe(el);
    return () => observer.disconnect();
  }, [profileNavItems, loading]);

  const keyStatsPayload = profile?.keyStats;
  const hasDepthMetrics = Boolean(
    keyStatsPayload &&
      (keyStatsPayload.bestMultiple != null ||
        keyStatsPayload.medianMultiple != null ||
        keyStatsPayload.last10Avg != null)
  );

  const handleSave = async () => {
    if (editSaving) return;
    if (editBio.length > BIO_MAX) {
      alert(`Bio must be ${BIO_MAX} characters or fewer.`);
      return;
    }
    setEditSaving(true);
    try {
      const bio = editBio.trim() === "" ? null : editBio;
      const banner_url =
        editBannerUrl.trim() === "" ? null : editBannerUrl.trim();
      const xHandle =
        editXHandle.trim() === ""
          ? null
          : editXHandle.trim().replace(/^@+/, "");

      const res = await fetch("/api/profile", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bio,
          banner_url,
          banner_crop_x: editBannerCropX,
          banner_crop_y: editBannerCropY,
          x_handle: xHandle,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        console.error("Save failed:", data);
        alert("Failed to save profile");
        return;
      }

      setEditOpen(false);
      window.location.reload();
    } catch (err) {
      console.error("Save error:", err);
      alert("Something went wrong");
    } finally {
      setEditSaving(false);
    }
  };

  async function pinCall(callId: string) {
    if (!isOwnProfile) return;
    const id = callId.trim();
    if (!id) return;
    try {
      const res = await fetch("/api/profile/pinned-call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pinned_call_id: id }),
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        console.warn("[pin call] failed", res.status, txt);
        return;
      }
      // refresh pinned call card
      setPinnedLoading(true);
      const url = `/api/user/${encodeURIComponent(profileUserId)}/pinned-call`;
      const data = await fetch(url).then((r) => r.json()).catch(() => null);
      const pc = data && typeof data === "object" ? (data as any).pinnedCall : null;
      if (pc && typeof pc === "object") {
        setPinnedCall({
          id: String((pc as any).id ?? "").trim(),
          token: String((pc as any).token ?? "Unknown"),
          multiple: Number((pc as any).multiple ?? 0),
          time: (pc as any).time,
        });
      } else {
        setPinnedCall(null);
      }
    } finally {
      setPinnedLoading(false);
    }
  }

  if (!userId?.trim()) {
    return (
      <div className="mx-auto max-w-4xl px-2 sm:px-0 lg:max-w-5xl">
        <p className="text-sm text-zinc-500">Invalid profile link.</p>
      </div>
    );
  }

  return (
    <div className="min-w-0">
      <div
        ref={profilePageColumnRef}
        className="relative mx-auto max-w-6xl animate-fade-in px-4 pb-[calc(4rem+var(--mcg-dock-stack,0px)+env(safe-area-inset-bottom,0px))] pt-2 selection:bg-cyan-500/20 selection:text-zinc-50 sm:px-6"
        data-tutorial="profile.pageIntro"
      >
        <div
          className="pointer-events-none absolute -left-32 top-8 hidden h-64 w-64 rounded-full bg-cyan-500/[0.04] blur-3xl lg:block"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -right-40 top-56 hidden h-72 w-72 rounded-full bg-violet-600/[0.03] blur-3xl lg:block"
          aria-hidden
        />

        {showProfileDeskUpsell ? (
          <ProfileDeskUpsell
            variant={status === "unauthenticated" ? "anonymous" : "needs_membership"}
          />
        ) : null}

        <div ref={profileHeroRef} className={`${PROFILE_HERO_SHELL}`}>
          <div className="relative h-[7rem] w-full overflow-hidden sm:h-[8.25rem]">
            {profile?.banner_url ? (
              <img
                src={profile.banner_url}
                alt="Profile Banner"
                className="h-full w-full object-cover scale-[1.01]"
                style={{
                  objectPosition: `${clampCropPercent(profile.banner_crop_x, 50)}% ${clampCropPercent(profile.banner_crop_y, 50)}%`,
                }}
              />
            ) : (
              <div className="relative h-full w-full bg-gradient-to-br from-zinc-700 via-zinc-900 to-black">
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_120%_80%_at_50%_100%,rgba(34,211,238,0.14),transparent_55%)]" />
              </div>
            )}
            <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.028)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.028)_1px,transparent_1px)] bg-[size:20px_20px] opacity-70" />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/65 to-transparent" />
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_55%_at_50%_-15%,rgba(34,211,238,0.18),transparent_52%)]" />
          </div>

          <header
            className="relative px-4 pb-5 pt-4 sm:px-6 sm:pb-6 sm:pt-5 lg:px-8"
            data-tutorial="profile.header"
          >
            <div className="pointer-events-none absolute inset-x-4 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400/40 to-transparent sm:inset-x-6 lg:inset-x-8" />
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-6 lg:gap-8">
              <div className="relative shrink-0">
                <div
                  className="pointer-events-none absolute -inset-1.5 rounded-[1.05rem] bg-gradient-to-br from-cyan-500/20 via-transparent to-violet-600/15 opacity-60 blur-md sm:-inset-2 sm:rounded-2xl"
                  aria-hidden
                />
                <img
                  src={avatarSrc}
                  alt=""
                  width={112}
                  height={112}
                  className="relative -mt-9 h-24 w-24 rounded-xl border border-white/10 bg-zinc-900 object-cover shadow-[0_20px_48px_-14px_rgba(0,0,0,0.88)] ring-[3px] ring-zinc-950 sm:-mt-11 sm:h-[7.25rem] sm:w-[7.25rem] sm:rounded-2xl"
                />
              </div>
              <div className="min-w-0 flex-1 pt-0.5 sm:pb-0 sm:pt-0">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between lg:gap-6">
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-cyan-300/80">
                      Trader desk
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-2">
                      <h1 className="text-2xl font-bold tracking-tight text-white drop-shadow-[0_2px_24px_rgba(0,0,0,0.55)] sm:text-3xl sm:leading-tight">
                        {showNameSkeleton ? (
                          <span className="inline-block h-9 w-52 max-w-full animate-pulse rounded-md bg-zinc-800/90" />
                        ) : (
                          displayName
                        )}
                      </h1>
                      {!loading && showTopCallerChip ? (
                        <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-orange-500/35 bg-gradient-to-r from-orange-950/90 to-amber-950/70 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-amber-100 shadow-[0_4px_14px_-6px_rgba(0,0,0,0.5),0_0_30px_-12px_rgba(251,146,60,0.38)]">
                          <span className="dashboard-fire-emoji text-sm leading-none" aria-hidden>
                            🔥
                          </span>
                          Top Caller
                          {topCallerTimes > 1 ? (
                            <span className="font-extrabold text-amber-200">{topCallerTimes}×</span>
                          ) : null}
                        </span>
                      ) : null}
                      {!loading && showTrustedProBadgeChip ? (
                        <span className="inline-flex shrink-0 items-center rounded-full border border-violet-500/35 bg-gradient-to-r from-violet-950/90 to-indigo-950/70 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-violet-100 shadow-[0_4px_14px_-6px_rgba(0,0,0,0.45),0_0_28px_-12px_rgba(139,92,246,0.32)]">
                          Trusted Pro
                        </span>
                      ) : null}
                    </div>
                    {!loading &&
                    profile &&
                    profile.username.trim() !== "" &&
                    profile.displayName.trim() !== profile.username.trim() ? (
                      <p className="mt-3 text-sm text-zinc-500">
                        <span className="text-zinc-500">@{profile.username}</span>
                      </p>
                    ) : null}
                    {!loading && (bioText || joinedText) ? (
                      <>
                        {bioText ? (
                          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-zinc-300">
                            {bioText}
                          </p>
                        ) : null}
                        {joinedText ? (
                          <p
                            className={`${
                              bioText ? "mt-1" : "mt-2"
                            } text-sm text-zinc-500`}
                          >
                            {joinedText}
                          </p>
                        ) : null}
                      </>
                    ) : null}
                    {!loading && xHandle ? (
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <a
                          href={`https://x.com/${encodeURIComponent(xHandle)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-600/50 bg-zinc-950/60 px-2.5 py-1 text-sm font-medium text-sky-300 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)] transition hover:border-sky-500/35 hover:bg-sky-950/35 hover:text-sky-200"
                        >
                          <span className="text-zinc-500">𝕏</span>@{xHandle}
                        </a>
                        {xVerified ? (
                          <span className="inline-flex items-center rounded-full border border-emerald-500/35 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-emerald-300">
                            Verified
                          </span>
                        ) : null}
                      </div>
                    ) : null}
                    <div className="mt-4 inline-flex flex-wrap items-center gap-x-2.5 gap-y-1 rounded-xl border border-zinc-700/35 bg-zinc-950/55 px-4 py-2.5 text-xs text-zinc-400 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)] backdrop-blur-sm">
                      {followStats ? (
                        <>
                          <span className="tabular-nums font-semibold text-zinc-100">
                            {followStats.followers.toLocaleString()}
                          </span>
                          <span className="text-zinc-500">followers</span>
                          <span className="text-zinc-600">·</span>
                          <span className="tabular-nums font-semibold text-zinc-100">
                            {followStats.following.toLocaleString()}
                          </span>
                          <span className="text-zinc-500">following</span>
                        </>
                      ) : (
                        <span
                          className="inline-block h-4 w-44 max-w-full animate-pulse rounded bg-zinc-800/80"
                          aria-hidden
                        />
                      )}
                    </div>
                  </div>

                  <aside className="flex w-full shrink-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end sm:gap-2 lg:w-[12rem] lg:flex-col lg:items-stretch xl:w-52">
                    <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
                      {isOwnProfile ? (
                        <button
                          type="button"
                          onClick={() => setEditOpen(true)}
                          className="w-full rounded-lg border border-zinc-600/70 bg-gradient-to-b from-zinc-800/90 to-zinc-900/90 px-3.5 py-2 text-xs font-semibold text-zinc-100 shadow-md shadow-black/30 transition hover:border-cyan-500/35 hover:from-zinc-700/95 hover:to-zinc-900 hover:shadow-[0_0_28px_-10px_rgba(34,211,238,0.45)] focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/40 motion-safe:active:scale-[0.98] sm:w-auto sm:px-3.5 sm:py-1.5"
                        >
                          Edit Profile
                        </button>
                      ) : hasDeskAccess ? (
                        <>
                          <FollowButton
                            targetDiscordId={snowflakeForFollow}
                            following={followingState}
                            onFollowingChange={(next) => {
                              if (!snowflakeForFollow) return;
                              setFollowing(snowflakeForFollow, next);
                              setFollowStats((prev) =>
                                prev ? { ...prev, isFollowing: next } : prev
                              );
                            }}
                            onCountsRefresh={refreshFollowStats}
                            className="px-3 py-1.5 text-xs sm:py-2"
                          />
                          {snowflakeForFollow ? (
                            <a
                              href={`https://discord.com/users/${encodeURIComponent(snowflakeForFollow)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 rounded-lg border border-[#5865F2]/35 bg-[#5865F2]/12 px-3 py-2 text-xs font-semibold text-[#c9cdfb] transition hover:border-[#5865F2]/50 hover:bg-[#5865F2]/20 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#5865F2]/35 sm:py-1.5"
                            >
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                viewBox="0 0 24 24"
                                fill="currentColor"
                                className="h-3.5 w-3.5 shrink-0 opacity-90"
                                aria-hidden
                              >
                                <path d="M20.317 4.369a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.249a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.249.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.331c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.419 0 1.334-.956 2.419-2.157 2.419zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.419 0 1.334-.946 2.419-2.157 2.419z" />
                              </svg>
                              Open in Discord
                            </a>
                          ) : null}
                          <button
                            type="button"
                            onClick={() => setReportOpen(true)}
                            className="rounded-lg border border-zinc-700/70 bg-zinc-900/40 px-3 py-2 text-xs font-semibold text-zinc-200 transition hover:border-zinc-600 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500/30 sm:py-1.5"
                          >
                            Report
                          </button>
                        </>
                      ) : (
                        <Link
                          href="/membership"
                          className="w-full rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-2 text-center text-xs font-semibold text-emerald-100 transition hover:bg-emerald-500/15 sm:w-auto"
                        >
                          Get access to follow
                        </Link>
                      )}
                    </div>
                    {!loading && profile && visibility.show_stats ? (
                      <Link
                        href="#performance"
                        scroll
                        className={`group w-full min-w-[11rem] ${terminalSurface.insetPanel} ${terminalSurface.insetEdge} p-2.5 transition motion-safe:hover:border-cyan-500/25 sm:flex-1 lg:flex-none lg:text-right`}
                      >
                        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
                          Track record
                        </p>
                        <p className="mt-1 bg-gradient-to-br from-cyan-100 to-cyan-400 bg-clip-text text-2xl font-bold tabular-nums tracking-tight text-transparent">
                          {profile.stats.avgX.toFixed(1)}×
                          <span className="ml-1 text-sm font-semibold tracking-normal text-zinc-400">
                            avg
                          </span>
                        </p>
                        <p className="mt-1 text-[11px] tabular-nums text-zinc-500">
                          {profile.stats.totalCalls.toLocaleString()} calls ·{" "}
                          <span className="text-zinc-400">{Math.round(profile.stats.winRate)}% WR</span>
                        </p>
                        <p className="mt-2 text-[10px] font-medium uppercase tracking-wider text-cyan-500/80 transition group-hover:text-cyan-400">
                          View performance →
                        </p>
                      </Link>
                    ) : null}
                  </aside>
                </div>
              </div>
            </div>
          </header>
        </div>

      {profileNavItems.length > 1 ? (
        <ProfileDeskNavFixed
          items={profileNavItems}
          activeId={activeProfileSection}
          leftPx={deskNavLeftPx}
          topPx={deskNavTopPx}
          navRef={deskNavRef}
        />
      ) : null}

      {visibility.show_pinned_call ? (
        <div className={`mt-6 ${PROFILE_SECTION_SCROLL}`} id="signature-pick">
          {pinnedLoading ? (
            <PinnedCallSpotlightSkeleton />
          ) : pinnedCall ? (
            <PinnedCallSpotlight
              token={pinnedCall.token}
              multiple={pinnedCall.multiple}
              timeLabel={formatJoinedAt(callTimeMs(pinnedCall.time), nowMs)}
            />
          ) : isOwnProfile ? (
            <div
              className={`relative flex items-start gap-3 overflow-hidden ${terminalSurface.insetPanel} ${terminalSurface.insetEdge} px-4 py-4 sm:items-center sm:gap-4 sm:px-5 sm:py-4`}
            >
              <span
                className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-cyan-500/20 bg-gradient-to-br from-zinc-800/90 to-zinc-950 text-lg shadow-inner shadow-black/40"
                aria-hidden
              >
                📌
              </span>
              <div className="relative min-w-0 text-left">
                <p className="text-sm font-semibold tracking-tight text-zinc-100">No signature pick yet</p>
                <p className="mt-1.5 text-xs leading-relaxed text-zinc-500">
                  Pin a call from <span className="font-medium text-zinc-400">Recent Calls</span> below — it
                  becomes your headline showcase.
                </p>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {error ? (
        <p className="mt-6 text-sm text-red-400/90">{error}</p>
      ) : null}

      {profileNavItems.length > 1 ? (
        <nav
          className={`mt-6 flex gap-1.5 overflow-x-auto pb-1 lg:hidden ${terminalChrome.scrollYHidden}`}
          aria-label="Profile sections"
        >
          {profileNavItems.map(({ href, id, label }) => (
            <a
              key={href}
              href={href}
              aria-current={activeProfileSection === id ? "location" : undefined}
              className={profileNavPillClass(activeProfileSection === id)}
            >
              {label}
            </a>
          ))}
        </nav>
      ) : null}

      <div className="mt-6 lg:mt-8">
        <div className="min-w-0">
      <div className="grid grid-cols-12 gap-5 lg:items-start lg:gap-6 xl:gap-8">
        {visibility.show_stats ? (
        <section
          id="performance"
          className={`col-span-12 ${PROFILE_SECTION_SCROLL}`}
          data-tutorial="profile.performance"
        >
          <div
            className={`relative isolate overflow-hidden ${terminalSurface.routeHeroFrame} ${terminalSurface.insetEdge} p-5 sm:p-6 before:pointer-events-none before:absolute before:inset-0 before:bg-[radial-gradient(ellipse_90%_55%_at_0%_0%,rgba(34,211,238,0.07),transparent_55%)]`}
          >
            <div className="pointer-events-none absolute inset-x-4 top-0 z-[2] h-px bg-gradient-to-r from-transparent via-cyan-400/40 to-transparent sm:inset-x-6" />
            <ProfileSectionHeader
              kicker="Track record"
              title="Performance"
              hint="Aggregated call stats — exclusions and visibility settings apply."
              badge={
                profile && profile.stats.totalCalls > 0 ? (
                  <span className="rounded-full border border-zinc-700/45 bg-zinc-950/70 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-400 tabular-nums shadow-[inset_0_1px_0_0_rgba(63,63,70,0.2)]">
                    {profile.stats.totalCalls} recorded
                  </span>
                ) : null
              }
            />
            <div className="relative z-[1] mt-5 grid gap-5 lg:grid-cols-[minmax(0,1.12fr)_minmax(0,1fr)] lg:items-stretch">
              <ProfileTrackRecordChart view={trackChartView} loading={loading} />
              <div className="grid grid-cols-2 gap-3">
                <StatCard
                  title="Avg X"
                  loading={loading}
                  accent
                  selected={trackChartMetric === "avg_x"}
                  onSelect={() => setTrackChartMetric("avg_x")}
                  value={profile ? `${profile.stats.avgX.toFixed(1)}x` : "—"}
                />
                <StatCard
                  title="Win Rate"
                  loading={loading}
                  selected={trackChartMetric === "win_rate"}
                  onSelect={() => setTrackChartMetric("win_rate")}
                  value={profile ? `${profile.stats.winRate.toFixed(0)}%` : "—"}
                />
                <StatCard
                  title="Total Calls"
                  loading={loading}
                  selected={trackChartMetric === "total_calls"}
                  onSelect={() => setTrackChartMetric("total_calls")}
                  value={profile ? profile.stats.totalCalls : "—"}
                />
                <StatCard
                  title="2x Rate"
                  loading={loading}
                  selected={trackChartMetric === "rate_2x"}
                  onSelect={() => setTrackChartMetric("rate_2x")}
                  value={hitRates.rate2x ? `${Math.round(hitRates.rate2x)}%` : "-"}
                />
                <StatCard
                  title="3x+ Rate"
                  loading={loading}
                  selected={trackChartMetric === "rate_3x"}
                  onSelect={() => setTrackChartMetric("rate_3x")}
                  value={hitRates.rate3x ? `${Math.round(hitRates.rate3x)}%` : "-"}
                />
              </div>
            </div>
            <p className="relative z-[1] mt-3 flex flex-wrap items-center gap-2 text-[10px] font-medium uppercase tracking-[0.16em] text-zinc-600">
              <span className="inline-flex rounded border border-zinc-800/80 bg-zinc-950/70 px-1.5 py-0.5 font-mono text-[9px] tracking-normal text-zinc-500">
                stat
              </span>
              Select a metric to drive the chart
            </p>
            {visibility.show_key_stats && hasDepthMetrics && keyStatsPayload ? (
              <div id="depth-metrics" className="relative z-[1] mt-5 border-t border-zinc-800/60 pt-4">
                <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
                  Depth metrics
                </p>
                <DepthMetricsGrid keyStats={keyStatsPayload} />
              </div>
            ) : null}
            {profile?.callerIntel ? (
              <div
                id="caller-intelligence"
                className="relative z-[1] mt-5 border-t border-zinc-800/60 pt-4"
              >
                <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
                  Caller intelligence
                </p>
                <CallerIntelligencePanel intel={profile.callerIntel} />
              </div>
            ) : null}
          </div>
        </section>
        ) : visibility.show_key_stats && hasDepthMetrics && keyStatsPayload ? (
        <section id="depth-metrics" className={`col-span-12 ${PROFILE_SECTION_SCROLL}`}>
          <div className={`relative isolate ${terminalSurface.routeHeroFrame} overflow-hidden p-5 sm:p-6`}>
            <div className="pointer-events-none absolute inset-x-4 top-0 z-[2] h-px bg-gradient-to-r from-transparent via-cyan-400/40 to-transparent sm:inset-x-6" />
            <ProfileSectionHeader
              kicker="Advanced"
              title="Depth metrics"
              hint="Peak, median, and recency-weighted multiples."
            />
            <div className="relative z-[1]">
              <DepthMetricsGrid keyStats={keyStatsPayload} />
            </div>
          </div>
        </section>
        ) : null}

        <div className="col-span-12 lg:col-span-8">
          {visibility.show_trophies ? (
          <section id="trophies" className={`mb-4 ${PROFILE_SECTION_SCROLL}`} data-tutorial="profile.trophies">
            <PanelCard title="Trophy Case" className="relative overflow-visible">
              {trophiesLoading ? (
                <div className="mt-3 space-y-4" aria-busy aria-label="Loading trophies">
                  <div className="grid gap-3 sm:grid-cols-3">
                    {(["Daily", "Weekly", "Monthly"] as const).map((label) => (
                      <div
                        key={label}
                        className="rounded-lg border border-zinc-800/40 bg-zinc-950/30 px-3 py-3"
                      >
                        <div className="mb-2 h-3 w-14 animate-pulse rounded bg-zinc-800/90" />
                        <div className="flex flex-wrap gap-2">
                          {Array.from({ length: 5 }, (_, j) => (
                            <div
                              key={j}
                              className="h-7 w-7 shrink-0 animate-pulse rounded-md bg-zinc-800/80"
                            />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="rounded-lg border border-zinc-800/40 bg-zinc-950/30 px-3 py-3">
                    <div className="mb-2 h-3 w-24 animate-pulse rounded bg-zinc-800/90" />
                    <div className="flex flex-wrap gap-2">
                      <div className="h-8 w-28 shrink-0 animate-pulse rounded-md bg-zinc-800/80" />
                      <div className="h-8 w-28 shrink-0 animate-pulse rounded-md bg-zinc-800/80" />
                    </div>
                  </div>
                </div>
              ) : trophies ? (
                <div className="relative mt-3 space-y-4">
                  <div className="grid gap-3 sm:grid-cols-3 sm:gap-4">
                    <div className={TROPHY_TIER_WELL}>
                      <TrophyTierRow
                        label="Daily"
                        timeframe="daily"
                        items={trophies.daily}
                        size="sm"
                      />
                    </div>
                    <div className={TROPHY_TIER_WELL}>
                      <TrophyTierRow
                        label="Weekly"
                        timeframe="weekly"
                        items={trophies.weekly}
                        size="md"
                      />
                    </div>
                    <div className={`${TROPHY_TIER_WELL} ring-amber-500/10`}>
                      <TrophyTierRow
                        label="Monthly"
                        timeframe="monthly"
                        items={trophies.monthly}
                        size="lg"
                      />
                    </div>
                  </div>
                  <div className={`${TROPHY_TIER_WELL} sm:py-3`}>
                    <MilestoneClubStrip items={milestoneTrophies} />
                  </div>
                </div>
              ) : (
                <p className="mt-2 text-sm text-zinc-500">
                  Trophies are unavailable right now.
                </p>
              )}
            </PanelCard>
          </section>
          ) : null}

          <section id="distribution" className={`mb-4 ${PROFILE_SECTION_SCROLL}`} data-tutorial="profile.distribution">
            <PanelCard title="Call Distribution">
              {loading ? (
                <div className={`mt-3 ${terminalPage.statTile} space-y-3 p-4`} aria-busy>
                  {buildProfileDistributionSegments({
                    under1: 0,
                    oneToTwo: 0,
                    twoToFive: 0,
                    fivePlus: 0,
                    total: 0,
                  }).map((s) => (
                    <div key={s.key} className="flex items-center gap-3">
                      <div className="h-3 w-10 animate-pulse rounded bg-zinc-800/80" />
                      <div className="h-2 flex-1 animate-pulse rounded bg-zinc-800/70" />
                    </div>
                  ))}
                </div>
              ) : profile?.callDistribution && profile.callDistribution.total > 0 ? (
                <div className={`mt-3 ${terminalPage.statTile} space-y-2.5 p-4`}>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                    {profile.callDistribution.total.toLocaleString()} calls in distribution
                  </p>
                  {buildProfileDistributionSegments(profile.callDistribution).map((s) => {
                    const pct = Math.round(
                      (s.count / profile.callDistribution!.total) * 100
                    );
                    return (
                      <div key={s.key} className="flex items-center gap-3">
                        <span className="w-[3.25rem] shrink-0 font-mono text-[11px] font-medium tabular-nums text-zinc-500">
                          {s.label}
                        </span>
                        <div className="h-2.5 min-w-0 flex-1 overflow-hidden rounded-full bg-black/40 ring-1 ring-zinc-700/35">
                          <div
                            className="h-full rounded-full transition-[width] duration-500 ease-out"
                            style={{
                              width: `${pct}%`,
                              backgroundColor: s.fill,
                            }}
                          />
                        </div>
                        <span className="w-[4.5rem] shrink-0 text-right text-[11px] tabular-nums text-zinc-400">
                          <span className="font-semibold text-zinc-300">{s.count}</span>
                          <span className="text-zinc-600"> · {pct}%</span>
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <ProfileEmptyState
                  compact
                  icon="◎"
                  title="No distribution yet"
                  description="Bucket breakdown appears once calls are recorded on this desk."
                />
              )}
            </PanelCard>
          </section>

          {isTrustedPro ? (
          <section id="trusted-pro" className={`mb-4 ${PROFILE_SECTION_SCROLL}`}>
            <PanelCard title="Trusted Pro calls">
              {trustedProCallsErr ? (
                <div className="mt-3 rounded-xl border border-red-500/15 bg-red-950/20 px-4 py-6 text-center">
                  <p className="text-sm text-red-300/90">{trustedProCallsErr}</p>
                </div>
              ) : trustedProCallsLoading ? (
                <div className="mt-3 flex min-h-[88px] flex-col items-center justify-center gap-2 rounded-xl border border-zinc-800/35 bg-zinc-950/25 py-8">
                  <div className="h-4 w-40 animate-pulse rounded bg-zinc-800/70" aria-busy />
                  <p className="text-xs text-zinc-600">Loading Trusted Pro calls…</p>
                </div>
              ) : trustedProCalls.length === 0 ? (
                <ProfileEmptyState
                  compact
                  icon="✦"
                  title="No Trusted Pro calls yet"
                  description="Approved thesis posts appear here for verified callers."
                />
              ) : (
                <>
                  <p className="mt-2 rounded-lg border border-violet-500/15 bg-violet-950/15 px-3 py-2 text-[11px] leading-snug text-zinc-500">
                    {trustedProIncludeAll
                      ? "Showing all statuses (owner/staff view)."
                      : "Showing approved-only."}
                  </p>
                  <div className={`${terminalSurface.dashboardListWell} mt-3`}>
                  <ul className={`${terminalUi.notificationsList} text-sm`}>
                    {trustedProCalls.map((c) => (
                      <li
                        key={c.id}
                        className="group flex flex-wrap items-start justify-between gap-3 px-2 py-3 transition hover:bg-zinc-900/40 sm:px-3"
                      >
                        <div className="min-w-0">
                          <p className="text-xs text-zinc-500">
                            <span className="font-mono text-zinc-300">{abbreviateCa(c.contract_address)}</span>
                            <span className="mx-2 text-zinc-700">·</span>
                            <span className="uppercase tracking-wide">{c.status}</span>
                          </p>
                          <p className="mt-1 text-sm font-semibold text-zinc-100">{c.thesis}</p>
                          {trustedProIncludeAll && c.staff_notes ? (
                            <p className="mt-1 text-xs text-zinc-500">Staff: {c.staff_notes}</p>
                          ) : null}
                        </div>
                        <div className="shrink-0 text-right text-xs text-zinc-500">
                          <div className="tabular-nums">{c.views_count} views</div>
                          <div className="mt-1 tabular-nums" title={c.published_at ?? c.created_at}>
                            {new Date(c.published_at ?? c.created_at).toLocaleDateString()}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                  </div>
                </>
              )}
            </PanelCard>
          </section>
          ) : null}

          {visibility.show_calls ? (
          <section id="recent-calls" className={`mb-4 ${PROFILE_SECTION_SCROLL}`}>
            <PanelCard
              title="Recent Calls"
              badge={
                profile && profile.recentCalls.length > 0
                  ? `${profile.recentCalls.length} rows`
                  : undefined
              }
              data-tutorial="profile.recentCalls"
            >
              {loading ? (
                <div className="mt-3 flex min-h-[100px] flex-col items-center justify-center gap-3 rounded-xl border border-zinc-800/35 bg-zinc-950/25 py-10">
                  <div className="h-5 w-36 animate-pulse rounded-md bg-zinc-800/80" aria-busy />
                  <div className="h-4 w-48 animate-pulse rounded bg-zinc-800/60" aria-busy />
                  <p className="text-xs text-zinc-600">Loading calls…</p>
                </div>
              ) : !profile || profile.recentCalls.length === 0 ? (
                <ProfileEmptyState
                  icon="📈"
                  title="No calls yet"
                  description="Calls you log on the dashboard build your public track record here."
                />
              ) : (
                <>
                  <div className={`${terminalSurface.dashboardListWell} mt-3`}>
                  <div
                    className="hidden grid-cols-[minmax(0,1fr)_auto_auto] gap-x-3 border-b border-zinc-800/70 px-2 pb-2.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500 sm:grid sm:gap-x-4"
                    aria-hidden
                  >
                    <span>Call</span>
                    <span className="text-right">Result</span>
                    <span className="text-right">Time</span>
                  </div>
                  <div className={PROFILE_LIST_SCROLL}>
                  <ul className={`${terminalUi.notificationsList} text-sm`}>
                    {profile.recentCalls.map((call, i) => {
                      const ca = call.token.trim();
                      const dexUrl =
                        ca &&
                        ca !== "Unknown" &&
                        SOLANA_MINT_LIKE.test(ca)
                          ? `https://dexscreener.com/solana/${encodeURIComponent(ca)}`
                          : null;
                      const summary = formatCalledSnapshotLine({
                        tokenName: call.tokenName,
                        tokenTicker: call.tokenTicker,
                        callMarketCapUsd: call.callMarketCapUsd ?? null,
                        callCa: call.token,
                      });
                      const titleMint =
                        ca && ca !== "Unknown"
                          ? `${summary}\n${ca}`
                          : summary;
                      return (
                      <li
                        key={`${call.token}-${String(call.time)}-${i}`}
                        className="group flex flex-col gap-2 px-2 py-3 text-zinc-300 transition hover:bg-zinc-900/40 sm:grid sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center sm:gap-x-4 sm:px-3 sm:py-2.5"
                      >
                        <span className="min-w-0 text-[13px] leading-snug">
                          <div className="flex min-w-0 items-start gap-2">
                            {call.tokenImageUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={call.tokenImageUrl}
                                alt=""
                                className="mt-0.5 h-8 w-8 shrink-0 rounded-lg border border-zinc-600/40 object-cover shadow-sm shadow-black/40 ring-1 ring-white/[0.04]"
                                loading="lazy"
                                referrerPolicy="no-referrer"
                              />
                            ) : null}
                            <div className="min-w-0 flex-1">
                            {dexUrl ? (
                              <a
                                href={dexUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block font-medium text-cyan-200/90 underline decoration-cyan-500/30 underline-offset-2 transition hover:text-cyan-100 hover:decoration-cyan-400/50 sm:truncate"
                                title={titleMint}
                              >
                                {summary}
                              </a>
                            ) : (
                              <span
                                className="block font-medium text-zinc-100 sm:truncate"
                                title={titleMint}
                              >
                                {summary}
                              </span>
                            )}
                            {ca && ca !== "Unknown" && SOLANA_MINT_LIKE.test(ca) ? (
                              <span className="mt-0.5 block font-mono text-[11px] text-zinc-500">
                                {abbreviateCa(ca)}
                              </span>
                            ) : null}
                            </div>
                          </div>
                          <div className="mt-1.5 flex flex-wrap gap-1">
                            {isOwnProfile && call.id ? (
                              <button
                                type="button"
                                onClick={() => pinCall(call.id!)}
                                className={PROFILE_CHIP_BTN_CYAN}
                              >
                                Pin
                              </button>
                            ) : null}
                            {isAdmin && call.id ? (
                              <button
                                type="button"
                                onClick={() =>
                                  void setCallExcluded(
                                    call.id!,
                                    call.excludedFromStats !== true
                                  )
                                }
                                disabled={adminBusy}
                                className={`rounded-md border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide transition disabled:opacity-60 ${
                                  call.excludedFromStats === true
                                    ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-200 hover:border-emerald-400/40"
                                    : "border-red-500/25 bg-red-500/10 text-red-200 hover:border-red-400/40"
                                }`}
                                title={
                                  call.excludedFromStats === true
                                    ? "Restore this call to stats"
                                    : "Exclude this call from stats"
                                }
                              >
                                {call.excludedFromStats === true
                                  ? "Restore"
                                  : "Exclude"}
                              </button>
                            ) : null}
                          </div>
                        </span>
                        <div className="flex items-center justify-between gap-3 text-xs sm:hidden">
                          <span
                            className={`font-semibold tabular-nums ${multipleClass(call.multiple)}`}
                          >
                            <span className="inline-flex items-center gap-2">
                              {call.multiple.toFixed(1)}x
                              {call.excludedFromStats ? (
                                <span className="inline-flex items-center rounded-full border border-red-500/30 bg-red-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-200">
                                  Excluded
                                </span>
                              ) : null}
                            </span>
                          </span>
                          <span className="tabular-nums text-zinc-500">
                            {formatJoinedAt(callTimeMs(call.time), nowMs)}
                          </span>
                        </div>
                        <span
                          className={`hidden shrink-0 text-right text-sm font-semibold tabular-nums sm:block ${multipleClass(
                            call.multiple
                          )}`}
                        >
                          <span className="inline-flex items-center gap-2">
                            {call.multiple.toFixed(1)}x
                            {call.excludedFromStats ? (
                              <span className="inline-flex items-center rounded-full border border-red-500/30 bg-red-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-200">
                                Excluded
                              </span>
                            ) : null}
                          </span>
                        </span>
                        <span className="hidden shrink-0 text-right text-sm text-zinc-500 sm:block">
                          {formatJoinedAt(callTimeMs(call.time), nowMs)}
                        </span>
                      </li>
                    );
                    })}
                  </ul>
                  </div>
                  </div>
                </>
              )}
            </PanelCard>
          </section>
          ) : null}
        </div>

        <aside className="col-span-12 lg:col-span-4">
          <div
            className={`w-full space-y-5 lg:sticky ${PROFILE_STICKY_BELOW_CHROME} lg:z-[10] lg:self-start`}
          >
            {canModerate && resolvedSnowflake && !isOwnProfile ? (
              <UserCallSuspensionStaffPanel mode="profile" targetDiscordId={resolvedSnowflake} />
            ) : null}

            {isAdmin ? (
              <PanelCard title="Admin tools">
                <p className="mt-2 text-xs leading-relaxed text-zinc-500">
                  Exclude suspicious rows from the Recent Calls list, or reset aggregates. History is
                  never deleted; exclusions only change what counts in stats and boards.{" "}
                  <span className="text-zinc-400">
                    Full stats reset also clears leaderboard trophies and milestone clubs (same as a clean slate
                    before go-live).
                  </span>
                </p>

                <div className="mt-3 space-y-2 rounded-lg border border-zinc-800/80 bg-zinc-950/40 p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                    Stats reset
                  </p>
                  <label className="flex cursor-pointer items-center gap-2 text-xs text-zinc-300">
                    <input
                      type="radio"
                      name="stats-reset-mode"
                      className="accent-red-400"
                      checked={statsResetMode === "full"}
                      onChange={() => setStatsResetMode("full")}
                      disabled={adminBusy}
                    />
                    Full reset — exclude every existing call from stats
                  </label>
                  <label className="flex cursor-pointer items-center gap-2 text-xs text-zinc-300">
                    <input
                      type="radio"
                      name="stats-reset-mode"
                      className="accent-red-400"
                      checked={statsResetMode === "cutover"}
                      onChange={() => setStatsResetMode("cutover")}
                      disabled={adminBusy}
                    />
                    Cutover — only calls on or after this time count
                  </label>
                  {statsResetMode === "cutover" ? (
                    <input
                      type="datetime-local"
                      value={statsCutoverLocal}
                      onChange={(e) => setStatsCutoverLocal(e.target.value)}
                      disabled={adminBusy}
                      className="mt-1 w-full rounded-md border border-zinc-800 bg-[#0b0d12] px-2 py-1.5 text-xs text-zinc-200 outline-none ring-sky-500/25 focus:ring-2 disabled:opacity-60"
                    />
                  ) : null}
                  <button
                    type="button"
                    onClick={() => void resetUserStats()}
                    disabled={adminBusy}
                    className="mt-2 w-full rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm font-semibold text-red-100 transition hover:border-red-400/45 hover:bg-red-500/15 disabled:opacity-60"
                  >
                    {adminBusy ? "Working…" : "Apply stats reset"}
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => void resetUserTrophies()}
                  disabled={adminBusy}
                  className="mt-3 w-full rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm font-semibold text-amber-100 transition hover:border-amber-400/45 hover:bg-amber-500/15 disabled:opacity-60"
                >
                  Reset trophies and milestone clubs only
                </button>

                {(profile?.x_handle?.trim() || profile?.x_verified) ? (
                  <button
                    type="button"
                    onClick={() => void unlinkUserX()}
                    disabled={adminBusy}
                    className="mt-2 w-full rounded-lg border border-zinc-600 bg-zinc-900/60 px-3 py-2 text-sm font-semibold text-zinc-100 transition hover:border-zinc-500 hover:bg-zinc-800/60 disabled:opacity-60"
                  >
                    Unlink X account
                  </button>
                ) : null}

                {adminOk ? (
                  <p className="mt-2 text-xs font-semibold text-emerald-300/90">
                    {adminOk}
                  </p>
                ) : null}
              </PanelCard>
            ) : null}

            {isOwnProfile && !xVerified ? (
              <PanelCard title="X account">
                <p className="mt-2 text-xs leading-relaxed text-zinc-500">
                  Connect your X account with OAuth (no DMs or codes). Open{" "}
                  <Link
                    href="/settings#connected-accounts"
                    className="text-sky-400 hover:underline"
                  >
                    Settings → Connected accounts
                  </Link>{" "}
                  to link.
                </p>
              </PanelCard>
            ) : null}

            <div
              className={`relative overflow-hidden ${terminalSurface.routeHeroFrame} ${terminalSurface.insetEdge} p-5`}
            >
              <div className="pointer-events-none absolute inset-x-4 top-0 h-px bg-gradient-to-r from-transparent via-amber-400/35 to-transparent" />
              <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-amber-300/85">
                Desk rating
              </p>
              <p className="mt-2 bg-gradient-to-br from-amber-50 via-amber-200 to-orange-300 bg-clip-text text-4xl font-black tabular-nums tracking-tight text-transparent sm:text-[2.75rem] sm:leading-none">
                {alphaScore ? alphaScore.toFixed(2) : "—"}
              </p>
              <p className={`${terminalPage.sectionHint} mt-2`}>
                Composite of avg X, median, recent form, and win rate.
              </p>
            </div>

            <PanelCard title="Profile Summary">
              <div className={`mt-2 space-y-0 overflow-hidden ${terminalSurface.insetPanel} ${terminalSurface.insetEdgeSoft}`}>
                {xHandle ? (
                  <div className="border-b border-zinc-800/40 px-3.5 py-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                      X (Twitter)
                    </p>
                    <p className="mt-1.5 truncate text-sm">
                      <a
                        href={`https://x.com/${encodeURIComponent(xHandle)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-sky-300 transition hover:text-sky-200"
                      >
                        @{xHandle}
                      </a>
                      {xVerified ? (
                        <span className="ml-2 inline-flex items-center rounded-full border border-sky-500/25 bg-sky-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sky-300">
                          Verified
                        </span>
                      ) : null}
                    </p>
                  </div>
                ) : null}
                {isOwnProfile && xVerified ? (
                  <div className="border-b border-zinc-800/40 px-3.5 py-2.5">
                    <p className="text-xs text-zinc-500">
                      <Link
                        href="/settings#connected-accounts"
                        className="font-medium text-sky-400/90 hover:text-sky-300 hover:underline"
                      >
                        Unlink or reconnect X
                      </Link>{" "}
                      in Settings.
                    </p>
                  </div>
                ) : null}
                <div className="px-3.5 py-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                    Discord ID
                  </p>
                  <p className="mt-1.5 font-mono text-[11px] tabular-nums text-zinc-300">
                    {resolvedSnowflake || "—"}
                  </p>
                </div>
              </div>
            </PanelCard>

            <PanelCard title="Call snapshot">
              <div className="mt-3 grid gap-4 sm:grid-cols-2 sm:gap-3">
                <div className={`${terminalPage.statTile} p-3.5`}>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                    Best call
                  </p>
                  {(() => {
                    const fmt = bestCall.token
                      ? formatCallTokenForProfile(bestCall.token)
                      : { display: "Mint not on file", explorerUrl: null as string | null };
                    return fmt.explorerUrl ? (
                      <a
                        href={fmt.explorerUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1 block truncate text-sm text-cyan-200/90 underline decoration-cyan-500/30 underline-offset-2 hover:text-cyan-100"
                        title={bestCall.token ?? undefined}
                      >
                        {fmt.display}
                      </a>
                    ) : (
                      <p
                        className={`mt-1 truncate text-sm ${
                          fmt.display === "Mint not on file"
                            ? "text-zinc-500"
                            : "text-zinc-300"
                        }`}
                        title={bestCall.token ?? undefined}
                      >
                        {fmt.display}
                      </p>
                    );
                  })()}
                  <p className="mt-2 bg-gradient-to-br from-emerald-100 to-emerald-400 bg-clip-text text-3xl font-bold tabular-nums text-transparent">
                    {bestCall.best != null ? `${bestCall.best.toFixed(1)}×` : "—"}
                  </p>
                  <p className="mt-1 text-[11px] text-zinc-500">
                    Highest in recent history
                  </p>
                </div>
                <div className={`${terminalPage.statTile} p-3.5`}>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                    Recent form
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {recentForm.length > 0 ? (
                      recentForm.map((f, i) => (
                        <span
                          key={i}
                          className={`h-3.5 w-3.5 rounded-full ring-2 ring-zinc-950 ${
                            f === "green"
                              ? "bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.45)]"
                              : f === "neutral"
                                ? "bg-zinc-500 shadow-inner"
                                : "bg-red-400 shadow-[0_0_12px_rgba(248,113,113,0.35)]"
                          }`}
                          title={f === "green" ? "≥2×" : f === "neutral" ? "1–2×" : "<1×"}
                        />
                      ))
                    ) : (
                      <span className="text-sm text-zinc-500">No streak yet</span>
                    )}
                  </div>
                  <p className="mt-3 text-[11px] leading-snug text-zinc-600">
                    Last five calls, newest → oldest
                  </p>
                </div>
              </div>
            </PanelCard>

          </div>
        </aside>
      </div>
        </div>
      </div>

      {editOpen ? (
        <div
          className={terminalUi.modalBackdropZ50}
          role="dialog"
          aria-modal="true"
          aria-label="Edit profile"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setEditOpen(false);
          }}
        >
          <div className={terminalUi.modalPanelLgXl}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-cyan-300/75">
                  Profile editor
                </p>
                <h3 className={`${terminalPage.sectionTitle} mt-1.5`}>Edit profile</h3>
                <p className={`${terminalPage.sectionHint} mt-1`}>
                  Bio, banner crop, and display handle.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditOpen(false)}
                className={terminalUi.modalCloseIconBtn}
                aria-label="Close"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden>
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <div>
                <label className="text-xs font-medium text-zinc-400">
                  Bio
                </label>
                <textarea
                  value={editBio}
                  onChange={(e) => setEditBio(e.target.value)}
                  maxLength={BIO_MAX + 50}
                  rows={4}
                  disabled={editLoading || editSaving}
                  className={`mt-1 w-full resize-none ${terminalUi.formInput}`}
                  placeholder="A short bio…"
                />
                <p className="mt-1 text-xs text-zinc-500">
                  <span
                    className={
                      editBio.length > BIO_MAX
                        ? "text-red-400/90"
                        : "text-zinc-500"
                    }
                  >
                    {editBio.length}/{BIO_MAX}
                  </span>
                </p>
              </div>

              <div>
                <label className="text-xs font-medium text-zinc-400">
                  Banner URL
                </label>
                <input
                  type="url"
                  value={editBannerUrl}
                  onChange={(e) => setEditBannerUrl(e.target.value)}
                  disabled={editLoading || editSaving}
                  className={`mt-1 w-full ${terminalUi.formInput}`}
                  placeholder="https://…"
                />
                <div className="mt-3 space-y-3">
                  <div className="relative h-24 w-full overflow-hidden rounded-xl border border-zinc-800/70 bg-zinc-950/60 shadow-inner shadow-black/30">
                    {editBannerUrl.trim() ? (
                      <>
                        <img
                          src={editBannerUrl.trim()}
                          alt=""
                          className="h-full w-full object-cover"
                          style={{
                            objectPosition: `${editBannerCropX}% ${editBannerCropY}%`,
                          }}
                        />
                        <div className="pointer-events-none absolute inset-0 ring-1 ring-cyan-400/20" />
                        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent" />
                      </>
                    ) : (
                      <div className="h-full w-full bg-gradient-to-br from-zinc-800 via-zinc-900 to-zinc-950" />
                    )}
                    <div className="pointer-events-none absolute inset-0 opacity-70">
                      <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-cyan-400/20" />
                      <div className="absolute top-1/2 left-0 h-px w-full -translate-y-1/2 bg-cyan-400/20" />
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <div className="flex items-center justify-between">
                        <label className="text-[11px] font-medium text-zinc-500">
                          Crop X
                        </label>
                        <span className="text-[11px] tabular-nums text-zinc-600">
                          {editBannerCropX}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        step={1}
                        value={editBannerCropX}
                        onChange={(e) =>
                          setEditBannerCropX(clampCropPercent(e.target.value, 50))
                        }
                        disabled={editLoading || editSaving}
                        className="mt-1 w-full accent-cyan-400 disabled:opacity-60"
                        aria-label="Banner crop x"
                      />
                    </div>
                    <div>
                      <div className="flex items-center justify-between">
                        <label className="text-[11px] font-medium text-zinc-500">
                          Crop Y
                        </label>
                        <span className="text-[11px] tabular-nums text-zinc-600">
                          {editBannerCropY}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        step={1}
                        value={editBannerCropY}
                        onChange={(e) =>
                          setEditBannerCropY(clampCropPercent(e.target.value, 50))
                        }
                        disabled={editLoading || editSaving}
                        className="mt-1 w-full accent-cyan-400 disabled:opacity-60"
                        aria-label="Banner crop y"
                      />
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setEditBannerCropX(50);
                      setEditBannerCropY(50);
                    }}
                    disabled={editLoading || editSaving}
                    className={terminalUi.secondaryButtonSm}
                  >
                    Reset crop
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-zinc-400">
                  X (Twitter) Handle
                </label>
                <input
                  type="text"
                  value={editXHandle}
                  onChange={(e) => setEditXHandle(e.target.value)}
                  disabled={editLoading || editSaving}
                  className={`mt-1 w-full ${terminalUi.formInput}`}
                  placeholder="Enter your X handle (e.g. mcgzyy)"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setEditOpen(false)}
                  disabled={editSaving}
                  className={terminalUi.secondaryButtonSm}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={editLoading || editSaving || editBio.length > BIO_MAX}
                  className={`${PROFILE_PRIMARY_BTN} px-4`}
                >
                  {editSaving ? "Saving…" : "Save"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {reportOpen ? (
        <div
          className={terminalUi.modalBackdropZ50}
          role="dialog"
          aria-modal="true"
          aria-label="Report user"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setReportOpen(false);
          }}
        >
          <div className={terminalUi.modalPanelLgXl}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-zinc-100">Report user</h3>
                <p className="mt-1 text-xs text-zinc-500">
                  Optional evidence helps. Screenshots/links are welcome but not required.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setReportOpen(false)}
                className={terminalUi.modalCloseIconBtn}
                aria-label="Close"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden>
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <div>
                <label className="text-xs font-medium text-zinc-400">Reason</label>
                <select
                  value={reportReason}
                  onChange={(e) => setReportReason(e.target.value)}
                  disabled={reportSubmitting}
                  className={`mt-1 w-full ${terminalUi.formInput} text-zinc-100 ring-red-500/20`}
                >
                  <option value="rugs">Sharing rugs / scam promos (proof optional)</option>
                  <option value="harassment">Harassment / FUD in chat (screenshots optional)</option>
                  <option value="impersonation">Impersonation</option>
                  <option value="spam">Spam</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-zinc-400">Details (optional)</label>
                <textarea
                  value={reportDetails}
                  onChange={(e) => setReportDetails(e.target.value)}
                  rows={4}
                  disabled={reportSubmitting}
                  className={`mt-1 w-full resize-none ${terminalUi.formInput} text-zinc-100 ring-red-500/20`}
                  placeholder="What happened? Where? Any context that helps moderators review."
                />
              </div>

              <div>
                <label className="text-xs font-medium text-zinc-400">
                  Evidence URLs (optional, one per line)
                </label>
                <textarea
                  value={reportEvidence}
                  onChange={(e) => setReportEvidence(e.target.value)}
                  rows={3}
                  disabled={reportSubmitting}
                  className={`mt-1 w-full resize-none font-mono text-[12px] ${terminalUi.formInput} text-zinc-100 ring-red-500/20`}
                  placeholder={"https://discord.com/channels/...\nhttps://imgur.com/..."}
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setReportOpen(false)}
                  disabled={reportSubmitting}
                  className={terminalUi.secondaryButtonSm}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void submitProfileReport()}
                  disabled={reportSubmitting}
                  className="rounded-md bg-gradient-to-r from-red-500 to-rose-500 px-3 py-1.5 text-xs font-semibold text-white shadow-lg shadow-black/30 transition hover:from-red-400 hover:to-rose-400 disabled:opacity-60"
                >
                  {reportSubmitting ? "Submitting…" : "Submit report"}
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
