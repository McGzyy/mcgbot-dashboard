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
  id?: string;
  token: string;
  multiple: number;
  time: unknown;
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

function formatDateJoined(createdAt: unknown): string | null {
  if (!createdAt) return null;
  const d = new Date(String(createdAt));
  if (isNaN(d.getTime())) return null;

  return `Joined ${d.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  })}`;
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
      className={`rounded-xl border border-zinc-800/80 bg-zinc-900/80 px-3 py-2.5 shadow-sm shadow-black/20 backdrop-blur-sm ${CARD_HOVER}`}
    >
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
        {title}
      </p>
      {loading ? (
        <div
          className="mt-1.5 h-8 w-20 max-w-full animate-pulse rounded-md bg-zinc-800/90"
          aria-busy
          aria-label="Loading"
        />
      ) : (
        <div className="mt-1.5 text-2xl font-bold tabular-nums tracking-tight text-zinc-50">
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
      className={`w-full rounded-xl border border-zinc-800/80 bg-zinc-900/80 px-4 py-3 shadow-sm shadow-black/20 backdrop-blur-sm ${CARD_HOVER} ${className}`.trim()}
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
    created_at: (o.created_at ?? o.createdAt) as unknown,
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
        console.log("Loaded profile:", data);

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
  const joinedText = !loading
    ? formatDateJoined(profile?.created_at)
    : null;

  console.log("Banner URL:", profile?.banner_url);

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
        console.log("[pin call] failed", res.status, txt);
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
      <div className="mx-auto max-w-3xl px-1 sm:px-0">
        <p className="text-sm text-zinc-500">Invalid profile link.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-1 sm:px-0">
      <div className="mb-4 h-24 w-full overflow-hidden rounded-xl">
        {profile?.banner_url ? (
          <img
            src={profile.banner_url}
            alt="Profile Banner"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="h-full w-full bg-gradient-to-r from-zinc-800 to-zinc-700" />
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
            <p className="mt-1.5 truncate text-xs text-zinc-500 tabular-nums">
              Discord ID · {uid}
            </p>
            {!loading && xHandle ? (
              <div className="mt-1 flex items-center gap-2">
                <span className="text-xs text-zinc-500">X:</span>
                <a
                  href={`https://x.com/${encodeURIComponent(xHandle)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-400 hover:underline"
                >
                  @{xHandle}
                </a>
                {xVerified ? (
                  <span className="rounded-full bg-blue-500/20 px-2 py-0.5 text-xs text-blue-300">
                    ✓ Verified
                  </span>
                ) : null}
              </div>
            ) : null}
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

      <div className="mt-10 grid grid-cols-12 gap-4">
        {visibility.show_stats ? (
        <section className="col-span-12">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-zinc-500">
            Stats
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <StatCard
              title="Avg X"
              loading={loading}
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
          </div>
        </section>
        ) : null}

        <div className="col-span-12 lg:col-span-8">
          {visibility.show_trophies ? (
          <section className="mb-4">
            <PanelCard title="Trophy Case" className="overflow-visible">
              {trophiesLoading ? (
                <div
                  className="mt-3 space-y-5"
                  aria-busy
                  aria-label="Loading trophies"
                >
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
                          <div className="h-2 flex-1 rounded bg-zinc-800">
                            <div
                              className="h-2 rounded bg-cyan-400"
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
                          {isOwnProfile && call.id ? (
                            <button
                              type="button"
                              onClick={() => pinCall(call.id!)}
                              className="ml-2 rounded-md border border-zinc-800 bg-zinc-900/60 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-zinc-400 transition hover:border-zinc-700 hover:text-zinc-200"
                            >
                              Pin
                            </button>
                          ) : null}
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
          ) : null}
        </div>

        <aside className="col-span-12 lg:col-span-4">
          <div className="w-full max-w-sm space-y-4 lg:ml-auto">
            <PanelCard title="Profile Summary">
              <div className="mt-2 space-y-2 text-sm text-zinc-400">
                <p className="truncate">
                  <span className="text-zinc-500">Discord ID:</span>{" "}
                  <span className="tabular-nums text-zinc-300">{uid}</span>
                </p>
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
              </div>
            </PanelCard>

            {visibility.show_pinned_call ? (
            <PanelCard title="Pinned Call">
              {pinnedLoading ? (
                <div className="mt-2 space-y-2" aria-busy>
                  <div className="h-4 w-40 animate-pulse rounded bg-zinc-800/80" />
                  <div className="h-8 w-24 animate-pulse rounded bg-zinc-800/80" />
                </div>
              ) : pinnedCall ? (
                <div className="mt-2 space-y-2">
                  <p
                    className="truncate font-mono text-[13px] text-zinc-200"
                    title={pinnedCall.token}
                  >
                    {pinnedCall.token}
                  </p>
                  <p className="text-3xl font-bold tabular-nums tracking-tight text-emerald-400">
                    {Number.isFinite(pinnedCall.multiple)
                      ? `${pinnedCall.multiple.toFixed(1)}x`
                      : "—"}
                  </p>
                  <p className="text-xs text-zinc-500">
                    {formatJoinedAt(callTimeMs(pinnedCall.time), nowMs)}
                  </p>
                </div>
              ) : (
                <p className="mt-2 text-sm text-zinc-500">No pinned call</p>
              )}
            </PanelCard>
            ) : null}

            {visibility.show_key_stats ? (
            <PanelCard title="Key Stats">
              <div className="mt-2 space-y-2">
                {(() => {
                  const best = profile?.keyStats?.bestMultiple ?? null;
                  const median = profile?.keyStats?.medianMultiple ?? null;
                  const last10 = profile?.keyStats?.last10Avg ?? null;
                  const strong = (n: number | null) =>
                    n != null && Number.isFinite(n) && n >= 2;
                  const valClass = (n: number | null) =>
                    `font-bold tabular-nums ${
                      strong(n) ? "text-emerald-400" : "text-zinc-200"
                    }`;

                  return (
                    <>
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <span className="text-sm text-zinc-500">Best Call</span>
                        <span className={valClass(best)}>
                          {best == null ? "—" : `${best.toFixed(1)}x`}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <span className="text-sm text-zinc-500">Median</span>
                        <span className={valClass(median)}>
                          {median == null ? "—" : `${median.toFixed(1)}x`}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <span className="text-sm text-zinc-500">Last 10</span>
                        <span className={valClass(last10)}>
                          {last10 == null ? "—" : `${last10.toFixed(1)}x`}
                        </span>
                      </div>
                    </>
                  );
                })()}
              </div>
            </PanelCard>
            ) : null}
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
  );
}
