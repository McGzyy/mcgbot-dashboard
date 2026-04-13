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
  bio: string | null;
  banner_url: string | null;
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
    bio:
      o.bio == null
        ? null
        : typeof o.bio === "string"
          ? o.bio
          : String(o.bio),
    banner_url:
      (o.banner_url ?? o.bannerUrl) == null
        ? null
        : typeof (o.banner_url ?? o.bannerUrl) === "string"
          ? String(o.banner_url ?? o.bannerUrl)
          : String(o.banner_url ?? o.bannerUrl),
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
  const isOwnProfile =
    !!session?.user?.id?.trim() && session.user.id.trim() === profileUserId;

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
  const [badges, setBadges] = useState<string[]>([]);
  const [editOpen, setEditOpen] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [editBio, setEditBio] = useState("");
  const [editBannerUrl, setEditBannerUrl] = useState("");
  const [editError, setEditError] = useState<string | null>(null);

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

  useEffect(() => {
    const controller = new AbortController();
    void fetchProfile(controller.signal);
    return () => {
      controller.abort();
    };
  }, [fetchProfile]);

  useEffect(() => {
    if (!editOpen || !isOwnProfile) return;
    let cancelled = false;
    setEditLoading(true);
    setEditError(null);
    fetch("/api/profile")
      .then((res) => res.json().then((data) => ({ ok: res.ok, data })))
      .then(({ ok, data }) => {
        if (cancelled) return;
        if (!ok || !data || typeof data !== "object") {
          setEditError("Could not load profile.");
          return;
        }
        const o = data as Record<string, unknown>;
        const bio = o.bio;
        const banner = o.banner_url ?? o.bannerUrl;
        setEditBio(
          typeof bio === "string" ? bio : bio == null ? "" : String(bio)
        );
        setEditBannerUrl(
          typeof banner === "string"
            ? banner
            : banner == null
              ? ""
              : String(banner)
        );
      })
      .catch(() => {
        if (!cancelled) setEditError("Could not load profile.");
      })
      .finally(() => {
        if (!cancelled) setEditLoading(false);
      });
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
        console.log("TROPHIES:", data, ok ? null : new Error("HTTP error"));
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

  async function saveProfileEdits() {
    if (editSaving) return;
    const bio = editBio;
    if (bio.length > BIO_MAX) {
      setEditError(`Bio must be ${BIO_MAX} characters or fewer.`);
      return;
    }
    setEditSaving(true);
    setEditError(null);
    try {
      const nextBio = bio.trim() === "" ? null : bio;
      const nextBannerUrl =
        editBannerUrl.trim() === "" ? null : editBannerUrl.trim();
      const payload: EditableProfile = {
        bio: nextBio,
        banner_url: nextBannerUrl,
      };
      const res = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        console.log("[edit profile] save failed", res.status, txt);
        setEditError("Could not save profile.");
        return;
      }
      setProfile((prev) =>
        prev ? { ...prev, bio: nextBio, banner_url: nextBannerUrl } : prev
      );
      console.log("Profile updated:", nextBio, nextBannerUrl);
      await fetchProfile();
      setEditOpen(false);
    } catch (e) {
      console.log("[edit profile] save error", e);
      setEditError("Could not save profile.");
    } finally {
      setEditSaving(false);
    }
  }

  if (!userId?.trim()) {
    return (
      <div className="mx-auto max-w-3xl px-1 sm:px-0">
        <p className="text-sm text-zinc-500">Invalid profile link.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-1 sm:px-0">
      <div className="mb-5 overflow-hidden rounded-xl border border-zinc-800/80 bg-zinc-900/60">
        {bannerUrl ? (
          <img
            src={bannerUrl}
            alt=""
            className="h-[140px] w-full object-cover"
          />
        ) : (
          <div className="h-[140px] w-full bg-gradient-to-r from-zinc-900 via-zinc-800 to-zinc-900" />
        )}
      </div>
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
              {!loading && isTopCaller ? (
                <span className="inline-flex shrink-0 items-center rounded-full bg-zinc-800 px-2 py-1 text-xs font-medium leading-none text-zinc-300">
                  🔥 Top Caller
                </span>
              ) : null}
              {!loading && isTrustedPro ? (
                <span className="inline-flex shrink-0 items-center rounded-full bg-zinc-800 px-2 py-1 text-xs font-medium leading-none text-zinc-300">
                  🧠 Trusted Pro
                </span>
              ) : null}
              {isOwnProfile ? (
                <button
                  type="button"
                  onClick={() => setEditOpen(true)}
                  className="shrink-0 rounded-md border border-zinc-700/80 bg-zinc-800/50 px-3 py-1.5 text-xs font-medium text-zinc-200 transition hover:border-zinc-600 hover:bg-zinc-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/40 sm:ml-auto"
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
            {!loading && bioText ? (
              <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-400">
                {bioText}
              </p>
            ) : null}
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
                  Update your bio and banner URL.
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

              {editError ? (
                <p className="text-sm text-red-400/90">{editError}</p>
              ) : null}

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
                  onClick={saveProfileEdits}
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
  );
}
