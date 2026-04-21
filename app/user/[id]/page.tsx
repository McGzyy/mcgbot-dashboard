"use client";

import { FollowButton } from "@/app/components/FollowButton";
import { useFollowingIds } from "@/app/hooks/useFollowingIds";
import {
  callTimeMs,
  formatJoinedAt,
  multipleClass,
} from "@/lib/callDisplayFormat";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { useCallback, useEffect, useState, type ReactNode } from "react";

const CARD_HOVER =
  "transition-[box-shadow,border-color] duration-200 ease-out hover:border-zinc-600/50 hover:shadow-lg hover:shadow-black/35";

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
};

type ProfilePayload = {
  username: string;
  isTopCaller: boolean;
  isTrustedPro: boolean;
  bio: string | null;
  created_at?: unknown;
  banner_url: string | null;
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
    show_distribution?: boolean;
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

type TrophiesByTimeframe = Record<TrophyTimeframe, TrophyRow[]>;

type EditableProfile = {
  bio: string | null;
  banner_url: string | null;
};

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
      className="relative overflow-hidden rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-zinc-900 via-zinc-950 to-emerald-950/45 p-6 shadow-2xl shadow-black/50 ring-1 ring-white/[0.05] sm:p-8"
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
  if (!avg || !median || !last10 || !winRate) return null;

  const winRateNormalized = winRate / 100;

  const score =
    median * 0.4 +
    last10 * 0.3 +
    avg * 0.2 +
    winRateNormalized * 0.1;

  return score;
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
      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
        {label}
      </p>
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-2 overflow-visible sm:gap-x-3">
        {items.length === 0 ? (
          <span className="text-sm text-zinc-600">None yet</span>
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

function defaultDiscordAvatarUrl(discordId: string): string {
  try {
    const id = BigInt(discordId);
    const idx = Number((id >> BigInt(22)) % BigInt(6));
    return `https://cdn.discordapp.com/embed/avatars/${idx}.png`;
  } catch {
    return "https://cdn.discordapp.com/embed/avatars/0.png";
  }
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
      className={`flex min-h-[5.25rem] flex-col justify-between rounded-xl border px-3.5 py-3 shadow-md backdrop-blur-sm ${CARD_HOVER} ${
        accent
          ? "border-cyan-500/20 bg-gradient-to-br from-cyan-950/35 via-zinc-900/85 to-zinc-950 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)]"
          : "border-zinc-800/55 bg-gradient-to-br from-zinc-900/80 to-zinc-950/95 shadow-black/25"
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
          className={`mt-1 text-2xl font-bold tabular-nums tracking-tight ${
            accent
              ? "bg-gradient-to-br from-cyan-100 to-cyan-400 bg-clip-text text-transparent"
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
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`w-full rounded-xl border border-zinc-800/50 bg-gradient-to-b from-zinc-900/75 to-zinc-950/95 px-4 py-3.5 shadow-[0_12px_40px_-24px_rgba(0,0,0,0.85)] backdrop-blur-md ring-1 ring-white/[0.03] ${CARD_HOVER} ${className}`.trim()}
    >
      <h2 className="flex items-center gap-2.5 text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
        <span
          className="inline-flex h-1 w-1 shrink-0 rounded-full bg-cyan-400/80 shadow-[0_0_12px_rgba(34,211,238,0.45)]"
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
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {ks.bestMultiple != null ? (
        <div className="rounded-lg border border-zinc-800/50 bg-zinc-950/50 px-3 py-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
            Peak multiple
          </p>
          <p className="mt-1 text-lg font-bold tabular-nums text-emerald-300">
            {ks.bestMultiple.toFixed(1)}×
          </p>
        </div>
      ) : null}
      {ks.medianMultiple != null ? (
        <div className="rounded-lg border border-zinc-800/50 bg-zinc-950/50 px-3 py-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
            Median X
          </p>
          <p className="mt-1 text-lg font-bold tabular-nums text-zinc-100">
            {ks.medianMultiple.toFixed(1)}×
          </p>
        </div>
      ) : null}
      {ks.last10Avg != null ? (
        <div className="rounded-lg border border-zinc-800/50 bg-zinc-950/50 px-3 py-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
            Last 10 avg
          </p>
          <p className="mt-1 text-lg font-bold tabular-nums text-cyan-200/90">
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
  const username = typeof o.username === "string" ? o.username : "";
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
      recentCalls.push({
        id: id || undefined,
        token: token || "Unknown",
        multiple,
        time: r.time,
        excludedFromStats: r.excludedFromStats === true,
      });
    }
  }
  return {
    username,
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
  const profileUserId = userId.trim();
  const { data: session } = useSession();
  const isAdmin =
    (session?.user as { helpTier?: string } | undefined)?.helpTier === "admin";
  const isOwnProfile =
    !!session?.user?.id?.trim() && session.user.id.trim() === profileUserId;

  const { followingIds, setFollowing } = useFollowingIds();
  const [profile, setProfile] = useState<ProfilePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [adminBusy, setAdminBusy] = useState(false);
  const [adminOk, setAdminOk] = useState<string | null>(null);
  const [followStats, setFollowStats] = useState<{
    followers: number;
    following: number;
    isFollowing: boolean;
  } | null>(null);
  const [trophies, setTrophies] = useState<TrophiesByTimeframe | null>(null);
  const [trophiesLoading, setTrophiesLoading] = useState(true);
  const [badges, setBadges] = useState<string[]>([]);
  const [editOpen, setEditOpen] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [editBio, setEditBio] = useState("");
  const [editBannerUrl, setEditBannerUrl] = useState("");
  const [editXHandle, setEditXHandle] = useState("");
  const [editError, setEditError] = useState<string | null>(null);
  const [pinnedCall, setPinnedCall] = useState<{
    id: string;
    token: string;
    multiple: number;
    time: unknown;
  } | null>(null);
  const [pinnedLoading, setPinnedLoading] = useState(true);

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
    } catch {
      setError("Could not load profile.");
      setProfile(null);
      return false;
    } finally {
      setLoading(false);
    }
  }, [profileUserId]);

  const resetUserStats = useCallback(async () => {
    if (!isAdmin || !profileUserId) return;
    const ok = window.confirm(
      "Reset this user’s stats?\n\nThis excludes ALL of their existing calls from leaderboards and performance stats (history is retained)."
    );
    if (!ok) return;
    setAdminBusy(true);
    setAdminOk(null);
    setError(null);
    try {
      const res = await fetch(
        `/api/admin/users/${encodeURIComponent(profileUserId)}/reset-stats`,
        { method: "POST", credentials: "same-origin" }
      );
      const json = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        excluded?: number | null;
        error?: string;
      };
      if (!res.ok || json.success !== true) {
        setError(
          typeof json.error === "string" ? json.error : "Reset failed."
        );
        return;
      }
      const n = typeof json.excluded === "number" ? json.excluded : null;
      setAdminOk(n == null ? "Reset complete." : `Reset complete. Excluded ${n} calls.`);
      void fetchProfile();
    } catch {
      setError("Reset failed.");
    } finally {
      setAdminBusy(false);
    }
  }, [fetchProfile, isAdmin, profileUserId]);

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
            setEditXHandle("");
          }
          return;
        }

        const data = (await res.json().catch(() => null)) as unknown;

        if (!data || typeof data !== "object") return;
        const o = data as Record<string, unknown>;
        const bio = o.bio;
        const banner = o.banner_url ?? o.bannerUrl;
        const xh = o.x_handle ?? o.xHandle;

        if (cancelled) return;
        setEditBio(typeof bio === "string" ? bio : bio == null ? "" : String(bio));
        setEditBannerUrl(
          typeof banner === "string" ? banner : banner == null ? "" : String(banner)
        );
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
    if (!profileUserId) {
      setBadges([]);
      return;
    }
    let cancelled = false;
    const url = `/api/user/${encodeURIComponent(profileUserId)}/badges`;
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
  }, [profileUserId]);

  useEffect(() => {
    if (!profileUserId) return;
    let cancelled = false;
    setFollowStats(null);
    const q = encodeURIComponent(profileUserId);
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
  }, [profileUserId]);

  useEffect(() => {
    if (!profileUserId) {
      setTrophiesLoading(false);
      setTrophies(null);
      return;
    }

    let cancelled = false;
    setTrophiesLoading(true);
    const url = `/api/user/${encodeURIComponent(profileUserId)}/trophies`;
    fetch(url)
      .then((res) => res.json().then((data) => ({ ok: res.ok, data })))
      .then(({ ok, data }) => {
        if (cancelled) return;
        if (!ok) {
          setTrophies(null);
          return;
        }
        setTrophies(parseTrophiesPayload(data));
      })
      .catch(() => {
        if (!cancelled) setTrophies(null);
      })
      .finally(() => {
        if (!cancelled) setTrophiesLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [profileUserId]);

  const refreshFollowStats = useCallback(async () => {
    const id = profileUserId;
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
  }, [profileUserId]);

  const nowMs = Date.now();
  const uid = profileUserId;
  const avatarSrc =
    isOwnProfile && session?.user?.image
      ? session.user.image
      : defaultDiscordAvatarUrl(uid);

  const displayName =
    isOwnProfile && session?.user?.name?.trim()
      ? session.user.name.trim()
      : (profile?.username?.trim() || uid || "Profile");

  const showNameSkeleton =
    loading && !profile && !(isOwnProfile && session?.user?.name?.trim());

  const followingState =
    followStats !== null
      ? followStats.isFollowing
      : followingIds.has(uid);

  const isTopCaller = badges.includes("top_caller");
  const isTrustedPro = badges.includes("trusted_pro");

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
    show_distribution: profile?.profile_visibility?.show_distribution ?? true,
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
      <div className="mx-auto max-w-4xl animate-fade-in px-2 sm:px-0 lg:max-w-5xl">
      <div className="relative mb-6 h-36 w-full overflow-hidden rounded-2xl border border-zinc-800/70 bg-zinc-950 shadow-lg shadow-black/40 sm:mb-7 sm:h-40">
        {profile?.banner_url ? (
          <img
            src={profile.banner_url}
            alt="Profile Banner"
            className="h-full w-full object-cover object-center"
          />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-zinc-800 via-zinc-900 to-zinc-950" />
        )}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#050505] via-[#050505]/35 to-transparent" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_90%_60%_at_50%_-10%,rgba(34,211,238,0.14),transparent_50%)]" />
      </div>

      <header className="border-b border-zinc-800/60 pb-10 pt-2 sm:pt-3">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:gap-8">
          <img
            src={avatarSrc}
            alt=""
            width={128}
            height={128}
            className="-mt-11 h-28 w-28 shrink-0 rounded-2xl border border-zinc-700/50 bg-zinc-900 object-cover shadow-2xl shadow-black/60 ring-4 ring-[#050505] sm:-mt-12 sm:h-32 sm:w-32"
          />
          <div className="min-w-0 flex-1 sm:pb-1">
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-2">
              <h1 className="text-2xl font-bold tracking-tight text-zinc-50 drop-shadow-sm sm:text-3xl">
                {showNameSkeleton ? (
                  <span className="inline-block h-9 w-52 max-w-full animate-pulse rounded-md bg-zinc-800/90" />
                ) : (
                  displayName
                )}
              </h1>
              {!loading && isTopCaller ? (
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-orange-500/35 bg-gradient-to-r from-orange-950/90 to-amber-950/70 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-amber-100 shadow-md shadow-orange-950/30">
                  <span className="dashboard-fire-emoji text-sm leading-none" aria-hidden>
                    🔥
                  </span>
                  Top Caller
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
                <FollowButton
                  targetDiscordId={uid}
                  following={followingState}
                  onFollowingChange={(next) => {
                    setFollowing(uid, next);
                    setFollowStats((prev) =>
                      prev ? { ...prev, isFollowing: next } : prev
                    );
                  }}
                  onCountsRefresh={refreshFollowStats}
                  className="px-3 py-1.5 text-xs sm:ml-auto"
                />
              )}
            </div>
            {!loading && (bioText || joinedText) ? (
              <>
                {bioText ? (
                  <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-400">
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
                  className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700/60 bg-zinc-900/80 px-2.5 py-1 text-sm font-medium text-sky-300 transition hover:border-sky-500/40 hover:bg-sky-950/30 hover:text-sky-200"
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
            <div className="mt-3 inline-flex flex-wrap items-center gap-2 rounded-lg border border-zinc-800/80 bg-zinc-900/50 px-3 py-2 text-xs text-zinc-400">
              {followStats ? (
                <>
                  <span className="tabular-nums font-semibold text-zinc-200">
                    {followStats.followers.toLocaleString()}
                  </span>
                  <span className="text-zinc-600">followers</span>
                  <span className="text-zinc-700">·</span>
                  <span className="tabular-nums font-semibold text-zinc-200">
                    {followStats.following.toLocaleString()}
                  </span>
                  <span className="text-zinc-600">following</span>
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
            <div className="flex items-start gap-3 rounded-2xl border border-dashed border-zinc-700/50 bg-zinc-900/20 px-4 py-4 sm:items-center sm:gap-4 sm:px-6 sm:py-4">
              <span
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-zinc-700/60 bg-zinc-900/80 text-lg text-zinc-500"
                aria-hidden
              >
                📌
              </span>
              <div className="min-w-0 text-left">
                <p className="text-sm font-medium text-zinc-300">No signature pick yet</p>
                <p className="mt-1 text-xs leading-relaxed text-zinc-500">
                  Pin a call from <span className="text-zinc-400">Recent Calls</span> below — it
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

      <div className="mt-10 grid grid-cols-12 gap-5 lg:items-start lg:gap-6">
        {visibility.show_stats ? (
        <section className="col-span-12">
          <div className="rounded-2xl border border-zinc-800/55 bg-gradient-to-b from-zinc-900/40 to-zinc-950/90 p-4 shadow-[0_24px_80px_-48px_rgba(0,0,0,0.9)] ring-1 ring-white/[0.03] sm:p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 className="flex items-center gap-3 text-xs font-bold uppercase tracking-[0.2em] text-zinc-400">
                <span className="h-px w-10 rounded-full bg-gradient-to-r from-cyan-400/90 to-transparent" />
                Performance
              </h2>
              {profile && profile.stats.totalCalls > 0 ? (
                <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-600">
                  {profile.stats.totalCalls} recorded
                </span>
              ) : null}
            </div>
            <div className="grid gap-3 sm:grid-cols-2 sm:gap-3 lg:grid-cols-5">
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
          <div className="rounded-2xl border border-zinc-800/55 bg-gradient-to-b from-zinc-900/40 to-zinc-950/90 p-4 sm:p-5">
            <h2 className="mb-4 flex items-center gap-3 text-xs font-bold uppercase tracking-[0.2em] text-zinc-400">
              <span className="h-px w-10 rounded-full bg-gradient-to-r from-cyan-400/90 to-transparent" />
              Depth metrics
            </h2>
            <DepthMetricsGrid keyStats={keyStatsPayload} />
          </div>
        </section>
        ) : null}

        <div className="col-span-12 lg:col-span-8">
          {visibility.show_trophies ? (
          <section className="mb-4">
            <PanelCard title="Trophy Case" className="overflow-visible">
              {trophiesLoading ? (
                <div
                  className="mt-3 grid gap-3 sm:grid-cols-3"
                  aria-busy
                  aria-label="Loading trophies"
                >
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
              ) : trophies ? (
                <div className="mt-3 grid gap-3 sm:grid-cols-3 sm:gap-3">
                  <div className="rounded-lg border border-zinc-800/40 bg-zinc-950/35 px-2.5 py-2.5 sm:px-3">
                    <TrophyTierRow
                      label="Daily"
                      timeframe="daily"
                      items={trophies.daily}
                      size="sm"
                    />
                  </div>
                  <div className="rounded-lg border border-zinc-800/40 bg-zinc-950/35 px-2.5 py-2.5 sm:px-3">
                    <TrophyTierRow
                      label="Weekly"
                      timeframe="weekly"
                      items={trophies.weekly}
                      size="md"
                    />
                  </div>
                  <div className="rounded-lg border border-zinc-800/40 bg-zinc-950/35 px-2.5 py-2.5 sm:px-3">
                    <TrophyTierRow
                      label="Monthly"
                      timeframe="monthly"
                      items={trophies.monthly}
                      size="lg"
                    />
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

          {visibility.show_distribution ? (
          <section className="mb-4">
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
                  <div className="mt-3 space-y-2.5">
                    {rows.map((r) => {
                      const pct =
                        total > 0 ? Math.round((r.count / total) * 100) : 0;
                      return (
                        <div key={r.label} className="flex items-center gap-2">
                          <span className="w-12 text-xs text-zinc-400">
                            {r.label}
                          </span>
                          <div className="h-2.5 flex-1 rounded-full bg-zinc-800/90 ring-1 ring-zinc-700/40">
                            <div
                              className="h-2.5 rounded-full bg-gradient-to-r from-cyan-500 to-emerald-400 shadow-sm shadow-cyan-900/40"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="w-16 text-right text-xs text-zinc-500 tabular-nums">
                            {r.count}
                            {total > 0 ? ` (${pct}%)` : ""}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </PanelCard>
          </section>
          ) : null}

          {visibility.show_calls ? (
          <section className="mb-4">
            <PanelCard title="Recent Calls">
              {loading ? (
                <div className="flex min-h-[88px] items-center justify-center py-6">
                  <p className="text-sm text-zinc-500">Loading calls…</p>
                </div>
              ) : !profile || profile.recentCalls.length === 0 ? (
                <div className="flex min-h-[88px] items-center justify-center py-6">
                  <p className="text-sm text-zinc-500">No calls yet</p>
                </div>
              ) : (
                <>
                  <div
                    className="mt-2 grid grid-cols-[minmax(0,1fr)_auto_auto] gap-x-3 border-b border-zinc-700/50 pb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500 sm:gap-x-4"
                    aria-hidden
                  >
                    <span>Token / CA</span>
                    <span className="text-right">Result</span>
                    <span className="text-right">Time</span>
                  </div>
                  <ul className="divide-y divide-zinc-800/40 text-sm">
                    {profile.recentCalls.map((call, i) => {
                      const tokenFmt = formatCallTokenForProfile(call.token);
                      const titleMint =
                        call.token.trim() &&
                        call.token !== "Unknown" &&
                        SOLANA_MINT_LIKE.test(call.token.trim())
                          ? call.token.trim()
                          : tokenFmt.display;
                      return (
                      <li
                        key={`${call.token}-${String(call.time)}-${i}`}
                        className="group grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-3 py-2.5 text-zinc-300 transition first:pt-2 hover:bg-zinc-800/25 sm:gap-x-4"
                      >
                        <span className="min-w-0 font-mono text-[13px]">
                          {tokenFmt.explorerUrl ? (
                            <a
                              href={tokenFmt.explorerUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="truncate text-cyan-200/90 underline decoration-cyan-500/30 underline-offset-2 transition hover:text-cyan-100 hover:decoration-cyan-400/50"
                              title={titleMint}
                            >
                              {tokenFmt.display}
                            </a>
                          ) : (
                            <span
                              className={`block truncate ${
                                tokenFmt.display === "Mint not on file"
                                  ? "text-zinc-500"
                                  : "text-zinc-100"
                              }`}
                              title={titleMint}
                            >
                              {tokenFmt.display}
                            </span>
                          )}
                          {isOwnProfile && call.id ? (
                            <button
                              type="button"
                              onClick={() => pinCall(call.id!)}
                              className="ml-2 rounded-md border border-zinc-800 bg-zinc-900/60 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-zinc-400 transition hover:border-zinc-700 hover:text-zinc-200"
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
                              className={`ml-2 rounded-md border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide transition disabled:opacity-60 ${
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
                              {call.excludedFromStats === true ? "Restore" : "Exclude"}
                            </button>
                          ) : null}
                        </span>
                        <span
                          className={`shrink-0 text-right text-sm font-semibold tabular-nums ${multipleClass(
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
                        <span className="shrink-0 text-right text-sm text-zinc-500">
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
        </div>

        <aside className="col-span-12 lg:col-span-4">
          <div className="w-full max-w-sm space-y-4 lg:sticky lg:top-20 lg:z-10 lg:ml-auto lg:self-start">
            {isAdmin ? (
              <PanelCard title="Admin tools">
                <p className="mt-2 text-xs leading-relaxed text-zinc-500">
                  Exclude suspicious/outlier calls so they stop impacting global stats. Reset will exclude
                  all historical calls for this user (history is retained).
                </p>
                <button
                  type="button"
                  onClick={() => void resetUserStats()}
                  disabled={adminBusy}
                  className="mt-3 w-full rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm font-semibold text-red-100 transition hover:border-red-400/45 hover:bg-red-500/15 disabled:opacity-60"
                >
                  {adminBusy ? "Working…" : "Reset user stats"}
                </button>
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

            <PanelCard title="Alpha Score">
              <div className="mt-1 flex flex-col gap-1">
                <p className="bg-gradient-to-br from-amber-100 via-amber-200 to-orange-300 bg-clip-text text-4xl font-black tabular-nums tracking-tight text-transparent sm:text-5xl">
                  {alphaScore ? alphaScore.toFixed(2) : "—"}
                </p>
                <p className="text-[11px] font-medium uppercase tracking-[0.15em] text-zinc-500">
                  Composite score
                </p>
              </div>
            </PanelCard>

            <PanelCard title="Profile Summary">
              <div className="mt-2 space-y-2 text-sm text-zinc-400">
                {xHandle ? (
                  <p className="truncate">
                    <span className="text-zinc-500">X:</span>{" "}
                    <a
                      href={`https://x.com/${encodeURIComponent(xHandle)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-400 hover:underline"
                    >
                      @{xHandle}
                    </a>
                    {xVerified ? (
                      <span className="ml-2 rounded-full bg-blue-500/20 px-2 py-0.5 text-xs text-blue-300">
                        ✓ Verified
                      </span>
                    ) : null}
                  </p>
                ) : null}
                {isOwnProfile && xVerified ? (
                  <p className="text-xs text-zinc-500">
                    <Link
                      href="/settings#connected-accounts"
                      className="text-sky-400/90 hover:underline"
                    >
                      Unlink or reconnect X
                    </Link>{" "}
                    in Settings.
                  </p>
                ) : null}
              </div>
              <p className="mt-3 text-xs text-zinc-500">
                Discord ID · {uid}
              </p>
            </PanelCard>

            <PanelCard title="Call snapshot">
              <div className="mt-3 grid gap-5 sm:grid-cols-2 sm:gap-4">
                <div>
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
                  <p className="mt-2 text-3xl font-semibold tabular-nums text-emerald-400">
                    {bestCall.best != null ? `${bestCall.best.toFixed(1)}×` : "—"}
                  </p>
                  <p className="mt-1 text-[11px] text-zinc-500">
                    Highest in recent history
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                    Recent form
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {recentForm.length > 0 ? (
                      recentForm.map((f, i) => (
                        <span
                          key={i}
                          className={`h-3 w-3 rounded-full ring-1 ring-black/40 ${
                            f === "green"
                              ? "bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.35)]"
                              : f === "neutral"
                                ? "bg-zinc-500"
                                : "bg-red-400 shadow-[0_0_10px_rgba(248,113,113,0.25)]"
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
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-6"
          role="dialog"
          aria-modal="true"
          aria-label="Edit profile"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setEditOpen(false);
          }}
        >
          <div className="w-full max-w-lg rounded-xl border border-zinc-800/80 bg-zinc-950/90 p-4 shadow-xl shadow-black/50 backdrop-blur">
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
                className="rounded-md border border-zinc-800 bg-zinc-900/60 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-900"
                aria-label="Close"
              >
                Esc
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
      </div>
    </div>
  );
}
