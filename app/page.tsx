"use client";

import { signIn, signOut, useSession } from "next-auth/react";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

const REF_BASE = "https://mcgbot.xyz/ref";

const STREAK_COUNT = 2;

const LIVE_FEED_MOCK = [
  { text: "🔥 alpha_sniper hit 4.2x", ago: "2m ago" },
  { text: "⚡ New call: SOLXYZ", ago: "just now" },
  { text: "📈 trend_hunter 3.1x", ago: "8m ago" },
  { text: "🚀 New dev detected", ago: "14m ago" },
];

const HOT_RIGHT_NOW_MOCK = [
  { token: "SOLXYZ", tag: "trending" },
  { token: "DEV123", tag: "active" },
  { token: "ABC", tag: "2.8x in last hour" },
];

const CARD_HOVER =
  "transition-transform duration-200 ease-out motion-safe:hover:scale-[1.01]";

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

export default function Home() {
  const { data: session, status } = useSession();
  const [copied, setCopied] = useState(false);
  const [referrals, setReferrals] = useState<ReferralRow[]>([]);
  const [statsLoading, setStatsLoading] = useState(true);
  const [stats, setStats] = useState<MeStats | null>(null);
  const [recentCalls, setRecentCalls] = useState<RecentCallRow[]>([]);
  const [callsLoading, setCallsLoading] = useState(true);

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
      <header className="mb-8 flex flex-col gap-4 border-b border-zinc-800/80 pb-6 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-lg font-semibold tracking-tight text-zinc-50 sm:text-xl">
          Dashboard
        </h1>
        <div className="flex flex-wrap items-center gap-3 sm:gap-4">
          {session.user?.image ? (
            <img
              src={session.user.image}
              alt=""
              className="h-9 w-9 rounded-full border border-zinc-700 object-cover"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="flex h-9 w-9 items-center justify-center rounded-full border border-zinc-700 bg-zinc-800 text-xs font-medium text-zinc-400">
              {(session.user?.name ?? "?").slice(0, 1).toUpperCase()}
            </div>
          )}
          <span className="max-w-[200px] truncate text-sm font-medium text-zinc-300">
            {session.user?.name ?? "User"}
          </span>
          <button
            type="button"
            onClick={() => signOut()}
            className="rounded-lg border border-zinc-700 bg-zinc-800/80 px-3 py-2 text-sm font-medium text-zinc-200 transition hover:border-zinc-600 hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-sky-500/40"
          >
            Logout
          </button>
        </div>
      </header>

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

      <div className="mb-8 grid gap-6 lg:grid-cols-2 lg:items-start">
        <div className="flex flex-col gap-6">
          <PanelCard title="Live Activity">
            <ul className="mt-4 max-h-[300px] space-y-0 divide-y divide-zinc-800/50 overflow-y-auto pr-1 text-sm">
              {LIVE_FEED_MOCK.map((item, i) => (
                <li
                  key={i}
                  className="dashboard-feed-item flex items-start justify-between gap-3 py-3 first:pt-1"
                  style={{ animationDelay: `${i * 70}ms` }}
                >
                  <span className="text-zinc-200">{item.text}</span>
                  <span className="shrink-0 text-xs tabular-nums text-zinc-500">
                    {item.ago}
                  </span>
                </li>
              ))}
            </ul>
          </PanelCard>

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
    </div>
  );
}
