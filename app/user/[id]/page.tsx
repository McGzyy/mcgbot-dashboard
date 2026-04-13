"use client";

import { FollowButton } from "@/app/components/FollowButton";
import { useFollowingIds } from "@/app/hooks/useFollowingIds";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { useEffect, useState, type ReactNode } from "react";

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
  stats: ProfileStats;
  recentCalls: RecentCallRow[];
};

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

function multipleClass(multiple: number): string {
  if (multiple >= 2) return "text-emerald-400";
  if (multiple < 1) return "text-red-400";
  return "text-zinc-200";
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
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div
      className={`rounded-xl border border-zinc-800/80 bg-zinc-900/60 px-4 py-3 shadow-sm shadow-black/20 backdrop-blur-sm ${CARD_HOVER}`}
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
  return { username, stats, recentCalls };
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

  const nowMs = Date.now();

  if (!userId?.trim()) {
    return (
      <div className="mx-auto max-w-3xl px-1 sm:px-0">
        <p className="text-sm text-zinc-500">Invalid profile link.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-1 sm:px-0">
      <header className="flex flex-col gap-3 border-b border-zinc-800/80 pb-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight text-zinc-50 sm:text-2xl">
            {loading ? (
              <span className="inline-block h-8 w-48 animate-pulse rounded-md bg-zinc-800/90" />
            ) : isOwnProfile && session?.user?.name ? (
              session.user.name
            ) : (
              (profile?.username?.trim() || userId.trim()) || "Profile"
            )}
          </h1>
          {!loading && profile ? (
            <p className="mt-1 truncate text-xs text-zinc-500 tabular-nums">
              {userId.trim()}
            </p>
          ) : null}
        </div>
        <FollowButton
          targetDiscordId={userId.trim()}
          following={followingIds.has(userId.trim())}
          onFollowingChange={(next) => setFollowing(userId.trim(), next)}
          className="self-start px-3 py-1.5 text-xs sm:self-center"
        />
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
            <ul className="mt-2 space-y-0 divide-y divide-zinc-800/50 text-sm">
              {profile.recentCalls.map((call, i) => (
                <li
                  key={`${call.token}-${String(call.time)}-${i}`}
                  className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-zinc-300 first:pt-1"
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
    </div>
  );
}
