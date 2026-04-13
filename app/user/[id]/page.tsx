"use client";

import { FollowButton } from "@/app/components/FollowButton";
import { useFollowingIds } from "@/app/hooks/useFollowingIds";
import {
  callTimeMs,
  formatJoinedAt,
  multipleClass,
} from "@/lib/callDisplayFormat";
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
  token: string;
  multiple: number;
  time: unknown;
};

type ProfilePayload = {
  username: string;
  isTopCaller: boolean;
  isTrustedPro: boolean;
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
      ? "rounded-lg bg-gradient-to-b from-zinc-800/80 to-zinc-900/80 px-2.5 py-2 ring-1 ring-amber-500/25 shadow-md shadow-black/30"
      : size === "md"
        ? "rounded-md px-1.5 py-1 ring-1 ring-zinc-700/45"
        : "rounded px-0.5 py-px";

  return (
    <div className="overflow-visible">
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
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
            return (
              <span
                key={t.id}
                className={`group relative inline-flex shrink-0 cursor-default select-none ${shellClass}`}
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
}: {
  title: string;
  value: ReactNode;
  loading?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border border-zinc-800/80 bg-zinc-900/60 px-4 py-3 shadow-sm shadow-black/20 backdrop-blur-sm ${CARD_HOVER}`}
    >
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
        {title}
      </p>
      {loading ? (
        <div
          className="mt-1.5 h-9 w-20 max-w-full animate-pulse rounded-md bg-zinc-800/90"
          aria-busy
          aria-label="Loading"
        />
      ) : (
        <div className="mt-1.5 text-3xl font-bold tabular-nums tracking-tight text-zinc-50">
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
      className={`rounded-xl border border-zinc-800/80 bg-zinc-900/60 px-4 py-3 shadow-sm shadow-black/20 backdrop-blur-sm ${CARD_HOVER} ${className}`.trim()}
    >
      <h2 className="text-sm font-semibold tracking-wide text-zinc-400 uppercase">
        {title}
      </h2>
      {children}
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
      const token =
        typeof r.token === "string" ? r.token : String(r.token ?? "");
      const multiple = Number(r.multiple);
      if (!Number.isFinite(multiple)) continue;
      recentCalls.push({
        token: token || "Unknown",
        multiple,
        time: r.time,
      });
    }
  }
  return {
    username,
    isTopCaller: Boolean(o.isTopCaller),
    isTrustedPro: Boolean(o.isTrustedPro),
    stats,
    recentCalls,
  };
}

export default function UserProfilePage() {
  const params = useParams();
  const raw = params?.id;
  const userId =
    typeof raw === "string" ? raw : Array.isArray(raw) ? raw[0] : "";
  const { data: session } = useSession();
  const isOwnProfile =
    !!session?.user?.id?.trim() &&
    session.user.id.trim() === userId.trim();

  const { followingIds, setFollowing } = useFollowingIds();
  const [profile, setProfile] = useState<ProfilePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [followStats, setFollowStats] = useState<{
    followers: number;
    following: number;
    isFollowing: boolean;
  } | null>(null);
  const [trophies, setTrophies] = useState<TrophiesByTimeframe | null>(null);
  const [trophiesLoading, setTrophiesLoading] = useState(true);

  useEffect(() => {
    if (!userId?.trim()) {
      setLoading(false);
      setError("Invalid profile link.");
      setProfile(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    const url = `/api/user/${encodeURIComponent(userId.trim())}`;
    fetch(url)
      .then((res) => res.json().then((data) => ({ ok: res.ok, data })))
      .then(({ ok, data }) => {
        if (cancelled) return;
        if (!ok) {
          const msg =
            data &&
            typeof data === "object" &&
            typeof (data as { error?: string }).error === "string"
              ? (data as { error: string }).error
              : "Could not load profile.";
          setError(msg);
          setProfile(null);
          return;
        }
        const parsed = parseProfile(data);
        if (!parsed) {
          setError("Invalid profile response.");
          setProfile(null);
          return;
        }
        setProfile(parsed);
        setError(null);
      })
      .catch(() => {
        if (!cancelled) {
          setError("Could not load profile.");
          setProfile(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    if (!userId?.trim()) return;
    let cancelled = false;
    setFollowStats(null);
    const q = encodeURIComponent(userId.trim());
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
  }, [userId]);

  useEffect(() => {
    if (!userId?.trim()) {
      setTrophiesLoading(false);
      setTrophies(null);
      return;
    }

    let cancelled = false;
    setTrophiesLoading(true);
    const url = `/api/user/${encodeURIComponent(userId.trim())}/trophies`;
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
  }, [userId]);

  const refreshFollowStats = useCallback(async () => {
    const id = userId.trim();
    if (!id) return;
    const q = encodeURIComponent(id);
    try {
      const res = await fetch(`/api/follow?userId=${q}`);
      const data = await res.json().catch(() => null);
      if (!res.ok || !data || typeof data !== "object") {
        console.log("[profile] follow stats refresh", res.status);
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
      console.log("[profile] follow stats refresh", e);
    }
  }, [userId]);

  const nowMs = Date.now();
  const uid = userId.trim();
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

  if (!userId?.trim()) {
    return (
      <div className="mx-auto max-w-3xl px-1 sm:px-0">
        <p className="text-sm text-zinc-500">Invalid profile link.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-1 sm:px-0">
      <header className="border-b border-zinc-800/80 pb-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:gap-6">
          <img
            src={avatarSrc}
            alt=""
            width={96}
            height={96}
            className="h-24 w-24 shrink-0 rounded-full bg-zinc-900 object-cover ring-2 ring-zinc-800/80"
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-2">
              <h1 className="text-xl font-semibold tracking-tight text-zinc-50 sm:text-2xl">
                {showNameSkeleton ? (
                  <span className="inline-block h-8 w-48 max-w-full animate-pulse rounded-md bg-zinc-800/90" />
                ) : (
                  displayName
                )}
              </h1>
              {!loading && profile?.isTopCaller ? (
                <span className="inline-flex shrink-0 items-center rounded-md border border-orange-500/25 bg-orange-500/10 px-1.5 py-0.5 text-[10px] font-medium leading-none text-orange-200/95 sm:text-[11px]">
                  🔥 Top Caller
                </span>
              ) : null}
              {!loading && profile?.isTrustedPro ? (
                <span className="inline-flex shrink-0 items-center rounded-md border border-sky-500/25 bg-sky-500/10 px-1.5 py-0.5 text-[10px] font-medium leading-none text-sky-200/95 sm:text-[11px]">
                  🧠 Trusted Pro
                </span>
              ) : null}
              {!isOwnProfile ? (
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
              ) : null}
            </div>
            <p className="mt-1.5 truncate text-xs text-zinc-500 tabular-nums">
              Discord ID · {uid}
            </p>
            <p className="mt-2 text-xs text-zinc-500">
              {followStats ? (
                <>
                  <span className="tabular-nums text-zinc-400">
                    {followStats.followers.toLocaleString()}
                  </span>{" "}
                  Followers
                  <span className="mx-2 text-zinc-700">·</span>
                  <span className="tabular-nums text-zinc-400">
                    {followStats.following.toLocaleString()}
                  </span>{" "}
                  Following
                </>
              ) : (
                <span
                  className="inline-block h-4 w-44 max-w-full animate-pulse rounded bg-zinc-800/80"
                  aria-hidden
                />
              )}
            </p>
          </div>
        </div>
      </header>

      {error ? (
        <p className="mt-8 text-sm text-red-400/90">{error}</p>
      ) : null}

      <section className="mt-10">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-zinc-500">
          Stats
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard
            title="Avg X"
            loading={loading}
            value={
              profile ? `${profile.stats.avgX.toFixed(1)}x` : "—"
            }
          />
          <StatCard
            title="Win Rate"
            loading={loading}
            value={
              profile ? `${profile.stats.winRate.toFixed(0)}%` : "—"
            }
          />
          <StatCard
            title="Total Calls"
            loading={loading}
            value={profile ? profile.stats.totalCalls : "—"}
          />
        </div>
      </section>

      <section className="mt-8">
        <PanelCard title="Trophy Case" className="overflow-visible">
          {trophiesLoading ? (
            <div className="mt-3 space-y-5" aria-busy aria-label="Loading trophies">
              {(["Daily", "Weekly", "Monthly"] as const).map((label) => (
                <div key={label}>
                  <div className="mb-2 h-3 w-14 animate-pulse rounded bg-zinc-800/90" />
                  <div className="flex flex-wrap gap-2">
                    {Array.from({ length: 8 }, (_, j) => (
                      <div
                        key={j}
                        className="h-8 w-8 shrink-0 animate-pulse rounded-md bg-zinc-800/80"
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : trophies ? (
            <div className="mt-3 space-y-5">
              <TrophyTierRow
                label="Daily"
                timeframe="daily"
                items={trophies.daily}
                size="sm"
              />
              <TrophyTierRow
                label="Weekly"
                timeframe="weekly"
                items={trophies.weekly}
                size="md"
              />
              <TrophyTierRow
                label="Monthly"
                timeframe="monthly"
                items={trophies.monthly}
                size="lg"
              />
            </div>
          ) : (
            <p className="mt-2 text-sm text-zinc-500">
              Trophies are unavailable right now.
            </p>
          )}
        </PanelCard>
      </section>

      <section className="mt-8">
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
                className="mt-2 grid grid-cols-[minmax(0,1fr)_auto_auto] gap-x-3 border-b border-zinc-800/60 pb-2 text-[10px] font-medium uppercase tracking-wide text-zinc-500 sm:gap-x-4"
                aria-hidden
              >
                <span>Token / CA</span>
                <span className="text-right">Result</span>
                <span className="text-right">Time</span>
              </div>
              <ul className="divide-y divide-zinc-800/50 text-sm">
                {profile.recentCalls.map((call, i) => (
                  <li
                    key={`${call.token}-${String(call.time)}-${i}`}
                    className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-3 py-2.5 text-zinc-300 first:pt-2 sm:gap-x-4"
                  >
                    <span
                      className="min-w-0 truncate font-mono text-[13px] text-zinc-100"
                      title={call.token}
                    >
                      {call.token}
                    </span>
                    <span
                      className={`shrink-0 text-right text-sm font-semibold tabular-nums ${multipleClass(
                        call.multiple
                      )}`}
                    >
                      {call.multiple.toFixed(1)}x
                    </span>
                    <span className="shrink-0 text-right text-sm text-zinc-500">
                      {formatJoinedAt(callTimeMs(call.time), nowMs)}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </PanelCard>
      </section>
    </div>
  );
}
