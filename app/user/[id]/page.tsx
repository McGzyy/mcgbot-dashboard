"use client";

import { FollowButton } from "@/app/components/FollowButton";
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
import { parseTopCallerTimesFromBadges } from "@/lib/topCallerBadgeDisplay";
import { useNotifications } from "@/app/contexts/NotificationsContext";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { terminalSurface, terminalUi } from "@/lib/terminalDesignTokens";

const CARD_HOVER =
  "transition-[box-shadow,border-color,transform] duration-200 ease-out hover:border-zinc-600/50 hover:shadow-lg hover:shadow-black/35";

/** Profile hero + shared deck framing — readable on shares / screenshots. */
const PROFILE_HERO_SHELL =
  "relative mb-10 overflow-hidden rounded-[1.75rem] border border-zinc-800/75 bg-zinc-950/50 shadow-[0_40px_120px_-52px_rgba(0,0,0,0.92)] ring-1 ring-white/[0.06] backdrop-blur-[2px]";

const TROPHY_TIER_WELL =
  "rounded-xl border border-zinc-800/50 bg-gradient-to-b from-zinc-900/45 to-zinc-950/95 p-3 shadow-[inset_0_1px_0_0_rgba(63,63,70,0.14)] ring-1 ring-white/[0.03]";

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
  return (
    <section
      className="relative overflow-hidden rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-zinc-900 via-zinc-950 to-emerald-950/45 p-6 shadow-2xl shadow-black/50 ring-1 ring-emerald-500/20 sm:p-8"
      aria-label="Pinned call showcase"
    >
      <div className="pointer-events-none absolute -right-28 -top-28 h-80 w-80 rounded-full bg-emerald-400/18 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 left-0 h-60 w-60 rounded-full bg-cyan-500/12 blur-3xl" />
      <div className="relative grid gap-6 sm:grid-cols-[1fr_auto] sm:items-end">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-emerald-400/95">
            Signature pick
          </p>
          <p className="mt-2 break-all font-mono text-[13px] leading-relaxed text-zinc-100 sm:text-sm">
            {token}
          </p>
          <p className="mt-3 text-xs text-zinc-500">{timeLabel}</p>
        </div>
        <div className="flex flex-col items-start sm:items-end">
          <p className="text-5xl font-black tabular-nums tracking-tighter text-transparent bg-gradient-to-br from-emerald-200 via-emerald-400 to-cyan-300 bg-clip-text sm:text-6xl sm:leading-[0.95]">
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
      className="relative overflow-hidden rounded-2xl border border-zinc-800/80 bg-zinc-900/40 p-6 sm:p-8"
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
}: {
  title: string;
  value: ReactNode;
  loading?: boolean;
  accent?: boolean;
}) {
  return (
    <div
      className={`flex min-h-[5.75rem] flex-col justify-between rounded-xl border px-4 py-3.5 shadow-md backdrop-blur-sm ${CARD_HOVER} ${
        accent
          ? "border-cyan-400/25 bg-gradient-to-br from-cyan-950/40 via-zinc-900/90 to-zinc-950 shadow-[inset_0_1px_0_0_rgba(34,211,238,0.14)] ring-1 ring-cyan-500/10"
          : "border-zinc-800/50 bg-gradient-to-br from-zinc-900/75 to-zinc-950 ring-1 ring-zinc-700/20 shadow-black/30"
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
}

function PanelCard({
  title,
  children,
  className = "",
  "data-tutorial": dataTutorial,
}: {
  title: string;
  children: ReactNode;
  className?: string;
  "data-tutorial"?: string;
}) {
  return (
    <div
      data-tutorial={dataTutorial}
      className={`${terminalSurface.insetPanel} w-full px-4 py-4 sm:px-5 sm:py-4 ${CARD_HOVER} ${className}`.trim()}
    >
      <h2 className="mb-3 flex items-center gap-2.5 border-b border-zinc-800/45 pb-3 text-[10px] font-semibold uppercase tracking-[0.24em] text-zinc-400">
        <span
          className="inline-flex h-1 w-1 shrink-0 rounded-full bg-cyan-400/90 shadow-[0_0_14px_rgba(34,211,238,0.5)]"
          aria-hidden
        />
        {title}
      </h2>
      {children}
    </div>
  );
}

function DepthMetricsGrid({
  keyStats: ks,
}: {
  keyStats: NonNullable<ProfilePayload["keyStats"]>;
}) {
  const baseTile =
    "rounded-xl border px-3.5 py-3 shadow-[inset_0_1px_0_0_rgba(63,63,70,0.16)] ring-1 ring-zinc-700/20";
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
  };
}

export default function UserProfilePage() {
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
      const res = await fetch(url, { signal });
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
      "Reset this user’s stats?\n\nThis excludes ALL of their existing calls from leaderboards and performance stats (history is retained).";
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
        setAdminOk(
          n == null ? "Reset complete." : `Reset complete. Excluded ${n} calls.`
        );
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
        error?: string;
      };
      if (!res.ok || json.success !== true) {
        setError(
          typeof json.error === "string" ? json.error : "Trophy reset failed."
        );
        return;
      }
      const d = json.deleted;
      setAdminOk(
        typeof d === "number"
          ? `Removed ${d} trophy row${d === 1 ? "" : "s"}.`
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
    void loadTrustedProCalls();
  }, [loadTrustedProCalls]);

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
  const isCurrentMonthlyTopCaller = Boolean(profile?.isTopCaller);
  const showTopCallerChip = isCurrentMonthlyTopCaller || topCallerTimes > 0;
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

  const xHandle = profile?.x_handle?.trim() || "";
  const xVerified = Boolean(profile?.x_verified);

  const visibility = {
    show_stats: profile?.profile_visibility?.show_stats ?? true,
    show_trophies: profile?.profile_visibility?.show_trophies ?? true,
    show_calls: profile?.profile_visibility?.show_calls ?? true,
    show_key_stats: profile?.profile_visibility?.show_key_stats ?? true,
    show_pinned_call: profile?.profile_visibility?.show_pinned_call ?? true,
  };

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
        className="relative mx-auto max-w-4xl animate-fade-in px-2 pb-16 sm:px-0 lg:max-w-6xl"
        data-tutorial="profile.pageIntro"
      >
        <div
          className="pointer-events-none absolute -left-24 top-0 hidden h-72 w-72 rounded-full bg-cyan-500/[0.06] blur-3xl lg:block"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -right-32 top-48 hidden h-96 w-96 rounded-full bg-violet-600/[0.05] blur-3xl lg:block"
          aria-hidden
        />

        <div className={`${PROFILE_HERO_SHELL}`}>
          <div className="relative h-[9.5rem] w-full overflow-hidden sm:h-[11rem]">
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
            className="relative border-t border-white/[0.05] px-4 pb-8 pt-1 sm:px-8 sm:pb-10 sm:pt-2"
            data-tutorial="profile.header"
          >
            <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:gap-10">
              <div className="relative shrink-0">
                <div
                  className="pointer-events-none absolute -inset-2 rounded-[1.15rem] bg-gradient-to-br from-cyan-500/25 via-transparent to-violet-600/20 opacity-70 blur-lg sm:-inset-2.5 sm:rounded-2xl"
                  aria-hidden
                />
                <img
                  src={avatarSrc}
                  alt=""
                  width={128}
                  height={128}
                  className="relative -mt-12 h-28 w-28 rounded-2xl border border-white/10 bg-zinc-900 object-cover shadow-[0_24px_56px_-14px_rgba(0,0,0,0.88)] ring-[3px] ring-zinc-950 sm:-mt-14 sm:h-[8.5rem] sm:w-[8.5rem]"
                />
              </div>
              <div className="min-w-0 flex-1 sm:pb-1">
                <div className="flex flex-wrap items-center gap-x-2.5 gap-y-2">
                  <h1 className="text-[1.65rem] font-semibold tracking-tight text-white drop-shadow-[0_2px_24px_rgba(0,0,0,0.55)] sm:text-[2.125rem] sm:leading-tight">
                    {showNameSkeleton ? (
                      <span className="inline-block h-9 w-52 max-w-full animate-pulse rounded-md bg-zinc-800/90" />
                    ) : (
                      displayName
                    )}
                  </h1>
                  {!loading && showTopCallerChip ? (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-orange-500/35 bg-gradient-to-r from-orange-950/90 to-amber-950/70 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-amber-100 shadow-md shadow-orange-950/30">
                      <span className="dashboard-fire-emoji text-sm leading-none" aria-hidden>
                        🔥
                      </span>
                      Top Caller
                      {topCallerTimes > 1 ? (
                        <span className="font-extrabold text-amber-200">{topCallerTimes}×</span>
                      ) : null}
                    </span>
                  ) : null}
                  {!loading && isTrustedPro ? (
                    <span className="inline-flex shrink-0 items-center rounded-full border border-violet-500/35 bg-gradient-to-r from-violet-950/90 to-indigo-950/70 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-violet-100 shadow-md shadow-violet-950/25">
                      Trusted Pro
                    </span>
                  ) : null}
                  {isOwnProfile ? (
                    <button
                      type="button"
                      onClick={() => setEditOpen(true)}
                      className="shrink-0 rounded-lg border border-zinc-600/70 bg-gradient-to-b from-zinc-800/90 to-zinc-900/90 px-3.5 py-1.5 text-xs font-semibold text-zinc-100 shadow-md shadow-black/30 transition hover:border-zinc-500 hover:from-zinc-700/90 hover:to-zinc-800/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/35 sm:ml-auto"
                    >
                      Edit Profile
                    </button>
                  ) : (
                    <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
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
                        className="px-3 py-1.5 text-xs"
                      />
                      <button
                        type="button"
                        onClick={() => setReportOpen(true)}
                        className="rounded-lg border border-zinc-700/70 bg-zinc-900/40 px-3 py-1.5 text-xs font-semibold text-zinc-200 transition hover:border-zinc-600 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500/30"
                      >
                        Report
                      </button>
                    </div>
                  )}
                </div>
                {!loading &&
                profile &&
                profile.username.trim() !== "" &&
                profile.displayName.trim() !== profile.username.trim() ? (
                  <p className="mt-1 text-sm text-zinc-500">
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
            </div>
          </header>
        </div>

      {visibility.show_pinned_call ? (
        <div className="mt-8">
          {pinnedLoading ? (
            <PinnedCallSpotlightSkeleton />
          ) : pinnedCall ? (
            <PinnedCallSpotlight
              token={pinnedCall.token}
              multiple={pinnedCall.multiple}
              timeLabel={formatJoinedAt(callTimeMs(pinnedCall.time), nowMs)}
            />
          ) : isOwnProfile ? (
            <div className="relative flex items-start gap-4 overflow-hidden rounded-2xl border border-zinc-700/40 bg-gradient-to-br from-zinc-900/90 via-zinc-950 to-zinc-950 px-5 py-5 shadow-[0_20px_60px_-36px_rgba(0,0,0,0.85)] ring-1 ring-white/[0.04] sm:items-center sm:gap-5 sm:px-7 sm:py-5">
              <div className="pointer-events-none absolute -right-16 top-1/2 h-36 w-36 -translate-y-1/2 rounded-full bg-cyan-500/[0.06] blur-3xl" aria-hidden />
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
        <p className="mt-8 text-sm text-red-400/90">{error}</p>
      ) : null}

      <div className="mt-10 grid grid-cols-12 gap-6 lg:items-start lg:gap-8">
        {visibility.show_stats ? (
        <section className="col-span-12" data-tutorial="profile.performance">
          <div
            className={`relative overflow-hidden ${terminalSurface.routeHeroFrame} p-5 sm:p-6`}
          >
            <div className="pointer-events-none absolute -right-24 top-0 h-48 w-48 rounded-full bg-cyan-500/[0.07] blur-3xl" aria-hidden />
            <div className="pointer-events-none absolute -left-20 bottom-0 h-40 w-40 rounded-full bg-emerald-600/[0.06] blur-3xl" aria-hidden />
            <div className="relative mb-5 flex flex-wrap items-center justify-between gap-3">
              <h2 className="flex items-center gap-3 text-xs font-bold uppercase tracking-[0.22em] text-zinc-300">
                <span className="h-px w-12 rounded-full bg-gradient-to-r from-cyan-400 via-cyan-400/50 to-transparent" />
                Performance
              </h2>
              {profile && profile.stats.totalCalls > 0 ? (
                <span className="rounded-full border border-zinc-700/45 bg-zinc-950/70 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-400 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)] tabular-nums">
                  {profile.stats.totalCalls} recorded
                </span>
              ) : null}
            </div>
            <div className="relative grid gap-4 sm:grid-cols-2 sm:gap-4 lg:grid-cols-5">
              <StatCard
                title="Avg X"
                loading={loading}
                accent
                value={profile ? `${profile.stats.avgX.toFixed(1)}x` : "—"}
              />
              <StatCard
                title="Win Rate"
                loading={loading}
                value={profile ? `${profile.stats.winRate.toFixed(0)}%` : "—"}
              />
              <StatCard
                title="Total Calls"
                loading={loading}
                value={profile ? profile.stats.totalCalls : "—"}
              />
              <StatCard
                title="2x Rate"
                loading={loading}
                value={hitRates.rate2x ? `${Math.round(hitRates.rate2x)}%` : "-"}
              />
              <StatCard
                title="3x+ Rate"
                loading={loading}
                value={hitRates.rate3x ? `${Math.round(hitRates.rate3x)}%` : "-"}
              />
            </div>
            {visibility.show_key_stats && hasDepthMetrics && keyStatsPayload ? (
              <div className="mt-5 border-t border-zinc-800/60 pt-4">
                <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
                  Depth metrics
                </p>
                <DepthMetricsGrid keyStats={keyStatsPayload} />
              </div>
            ) : null}
          </div>
        </section>
        ) : visibility.show_key_stats && hasDepthMetrics && keyStatsPayload ? (
        <section className="col-span-12">
          <div className={`${terminalSurface.routeHeroFrame} p-5 sm:p-6`}>
            <h2 className="mb-5 flex items-center gap-3 border-b border-zinc-800/45 pb-4 text-xs font-bold uppercase tracking-[0.22em] text-zinc-300">
              <span className="h-px w-12 rounded-full bg-gradient-to-r from-cyan-400 via-cyan-400/50 to-transparent" />
              Depth metrics
            </h2>
            <DepthMetricsGrid keyStats={keyStatsPayload} />
          </div>
        </section>
        ) : null}

        <div className="col-span-12 lg:col-span-8">
          {visibility.show_trophies ? (
          <section className="mb-4" data-tutorial="profile.trophies">
            <PanelCard title="Trophy Case" className="relative overflow-visible">
              <div
                className="pointer-events-none absolute -right-12 top-24 h-44 w-44 rounded-full bg-amber-400/[0.06] blur-3xl sm:top-28"
                aria-hidden
              />
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

          <section className="mb-4" data-tutorial="profile.distribution">
            <PanelCard title="Call Distribution">
              {(() => {
                const dist = profile?.callDistribution;
                const total = dist?.total ?? 0;
                const rows = [
                  { label: "<1x", count: dist?.under1 ?? 0 },
                  { label: "1–2x", count: dist?.oneToTwo ?? 0 },
                  { label: "2–5x", count: dist?.twoToFive ?? 0 },
                  { label: "5x+", count: dist?.fivePlus ?? 0 },
                ] as const;

                if (loading) {
                  return (
                    <div className="mt-3 space-y-3" aria-busy>
                      {rows.map((r) => (
                        <div key={r.label} className="flex items-center gap-2">
                          <div className="h-3 w-12 animate-pulse rounded bg-zinc-800/80" />
                          <div className="h-2 flex-1 animate-pulse rounded bg-zinc-800/80" />
                          <div className="h-3 w-16 animate-pulse rounded bg-zinc-800/80" />
                        </div>
                      ))}
                    </div>
                  );
                }

                return (
                  <div className="mt-3 rounded-xl border border-zinc-800/40 bg-zinc-950/30 p-4 ring-1 ring-white/[0.03]">
                    <div className="space-y-3">
                      {rows.map((r) => {
                        const pct =
                          total > 0 ? Math.round((r.count / total) * 100) : 0;
                        return (
                          <div key={r.label} className="flex items-center gap-3">
                            <span className="w-[3.25rem] shrink-0 font-mono text-[11px] font-medium tabular-nums text-zinc-500">
                              {r.label}
                            </span>
                            <div className="h-3 min-w-0 flex-1 rounded-full bg-black/40 ring-1 ring-zinc-700/35 shadow-inner">
                              <div
                                className="h-3 rounded-full bg-gradient-to-r from-cyan-400 via-teal-400 to-emerald-400 shadow-[0_0_20px_-4px_rgba(34,211,238,0.35)] transition-[width] duration-500 ease-out"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className="w-[4.5rem] shrink-0 text-right text-[11px] tabular-nums text-zinc-400">
                              <span className="font-semibold text-zinc-300">{r.count}</span>
                              {total > 0 ? (
                                <span className="text-zinc-600"> · {pct}%</span>
                              ) : null}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </PanelCard>
          </section>

          {visibility.show_calls ? (
          <section className="mb-4">
            <PanelCard title="Recent Calls" data-tutorial="profile.recentCalls">
              {loading ? (
                <div className="mt-3 flex min-h-[100px] flex-col items-center justify-center gap-3 rounded-xl border border-zinc-800/35 bg-zinc-950/25 py-10">
                  <div className="h-5 w-36 animate-pulse rounded-md bg-zinc-800/80" aria-busy />
                  <div className="h-4 w-48 animate-pulse rounded bg-zinc-800/60" aria-busy />
                  <p className="text-xs text-zinc-600">Loading calls…</p>
                </div>
              ) : !profile || profile.recentCalls.length === 0 ? (
                <div className="mt-3 flex min-h-[112px] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-zinc-700/45 bg-gradient-to-b from-zinc-950/40 to-zinc-950/20 px-6 py-10 text-center">
                  <span className="text-2xl opacity-25" aria-hidden>
                    📈
                  </span>
                  <p className="text-sm font-medium text-zinc-400">No calls yet</p>
                  <p className="max-w-[18rem] text-xs leading-relaxed text-zinc-600">
                    Calls you log on the dashboard build your public track record here.
                  </p>
                </div>
              ) : (
                <>
                  <div
                    className="mt-3 hidden grid-cols-[minmax(0,1fr)_auto_auto] gap-x-3 border-b border-zinc-700/40 pb-2.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500 sm:grid sm:gap-x-4 sm:px-2"
                    aria-hidden
                  >
                    <span>Call</span>
                    <span className="text-right">Result</span>
                    <span className="text-right">Time</span>
                  </div>
                  <ul className="divide-y divide-zinc-800/30 rounded-xl border border-zinc-800/35 bg-zinc-950/20 text-sm ring-1 ring-white/[0.02] sm:mt-2">
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
                        className="group flex flex-col gap-2 px-2 py-3 text-zinc-300 transition first:rounded-t-xl last:rounded-b-xl hover:bg-zinc-800/[0.18] sm:grid sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center sm:gap-x-4 sm:py-2.5"
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
                                className="rounded-md border border-zinc-800 bg-zinc-900/60 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-zinc-400 transition hover:border-zinc-700 hover:text-zinc-200"
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
                </>
              )}
            </PanelCard>
          </section>
          ) : null}

          <section className="mb-4">
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
                <div className="mt-3 flex min-h-[100px] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-zinc-700/45 bg-zinc-950/25 px-6 py-10 text-center">
                  <span className="text-xl opacity-30" aria-hidden>
                    ✦
                  </span>
                  <p className="text-sm font-medium text-zinc-400">No Trusted Pro calls yet</p>
                  <p className="max-w-xs text-xs text-zinc-600">
                    Approved thesis posts appear here for verified callers.
                  </p>
                </div>
              ) : (
                <>
                  <p className="mt-2 rounded-lg border border-violet-500/15 bg-violet-950/15 px-3 py-2 text-[11px] leading-snug text-zinc-500">
                    {trustedProIncludeAll
                      ? "Showing all statuses (owner/staff view)."
                      : "Showing approved-only."}
                  </p>
                  <ul className="mt-3 divide-y divide-zinc-800/30 rounded-xl border border-zinc-800/35 bg-zinc-950/20 text-sm ring-1 ring-white/[0.02]">
                    {trustedProCalls.map((c) => (
                      <li
                        key={c.id}
                        className="group flex flex-wrap items-start justify-between gap-3 px-2 py-3 transition first:rounded-t-xl last:rounded-b-xl hover:bg-zinc-800/[0.15]"
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
                </>
              )}
            </PanelCard>
          </section>
        </div>

        <aside className="col-span-12 lg:col-span-4">
          <div className="w-full max-w-sm space-y-5 lg:sticky lg:top-20 lg:z-10 lg:ml-auto lg:self-start">
            {isAdmin ? (
              <PanelCard title="Admin tools">
                <p className="mt-2 text-xs leading-relaxed text-zinc-500">
                  Exclude suspicious rows from the Recent Calls list, or reset aggregates. History is
                  never deleted; exclusions only change what counts in stats and boards.
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
                  Reset trophies
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

            <PanelCard title="Alpha Score" className="relative overflow-hidden">
              <div className="pointer-events-none absolute -right-6 -top-10 h-36 w-36 rounded-full bg-amber-400/12 blur-3xl" aria-hidden />
              <div className="pointer-events-none absolute -bottom-8 left-1/3 h-28 w-28 rounded-full bg-orange-600/10 blur-3xl" aria-hidden />
              <div className="relative mt-1 flex flex-col gap-1">
                <p className="bg-gradient-to-br from-amber-50 via-amber-200 to-orange-300 bg-clip-text text-4xl font-black tabular-nums tracking-tight text-transparent drop-shadow-[0_2px_28px_rgba(251,191,36,0.12)] sm:text-[2.75rem] sm:leading-none">
                  {alphaScore ? alphaScore.toFixed(2) : "—"}
                </p>
                <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-500">
                  Composite score
                </p>
              </div>
            </PanelCard>

            <PanelCard title="Profile Summary">
              <div className="mt-2 space-y-0 overflow-hidden rounded-xl border border-zinc-800/45 bg-zinc-950/40 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)]">
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
                <div className="rounded-xl border border-zinc-800/45 bg-gradient-to-b from-zinc-900/50 to-zinc-950/90 p-3.5 shadow-[inset_0_1px_0_0_rgba(63,63,70,0.12)]">
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
                <div className="rounded-xl border border-zinc-800/45 bg-gradient-to-b from-zinc-900/50 to-zinc-950/90 p-3.5 shadow-[inset_0_1px_0_0_rgba(63,63,70,0.12)]">
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
                <h3 className="text-sm font-semibold text-zinc-100">
                  Edit Profile
                </h3>
                <p className="mt-1 text-xs text-zinc-500">
                  Customize your profile. Add a bio, banner, and social links.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-md border border-zinc-800 bg-zinc-900/60 text-zinc-300 transition hover:bg-zinc-900 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/25"
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
                  className="mt-1 w-full resize-none rounded-lg border border-zinc-800 bg-[#0b0d12] px-3 py-2 text-sm text-zinc-200 outline-none ring-sky-500/30 focus:ring-2 disabled:opacity-60"
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
                  className="mt-1 w-full rounded-lg border border-zinc-800 bg-[#0b0d12] px-3 py-2 text-sm text-zinc-200 outline-none ring-sky-500/30 focus:ring-2 disabled:opacity-60"
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
                    className="rounded-md border border-zinc-800 bg-zinc-900/60 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-900 disabled:opacity-60"
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
                  className="mt-1 w-full rounded-lg border border-zinc-800 bg-[#0b0d12] px-3 py-2 text-sm text-zinc-200 outline-none ring-sky-500/30 focus:ring-2 disabled:opacity-60"
                  placeholder="Enter your X handle (e.g. mcgzyy)"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setEditOpen(false)}
                  disabled={editSaving}
                  className="rounded-md border border-zinc-800 bg-zinc-900/60 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-900 disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={editLoading || editSaving || editBio.length > BIO_MAX}
                  className="rounded-md bg-gradient-to-r from-cyan-500 to-sky-500 px-3 py-1.5 text-xs font-semibold text-white shadow-lg shadow-cyan-500/20 transition hover:from-cyan-400 hover:to-sky-400 disabled:opacity-60"
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
