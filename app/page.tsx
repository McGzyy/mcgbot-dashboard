"use client";

import { signIn, signOut, useSession } from "next-auth/react";
import { useCallback, useEffect, useMemo, useState } from "react";

const REF_BASE = "https://mcgbot.xyz/ref";

type ReferralRow = { userId: string; joinedAt: number };

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
}: {
  title: string;
  value: string | number;
  loading?: boolean;
}) {
  return (
    <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/60 p-5 shadow-sm shadow-black/20 backdrop-blur-sm">
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
        <p className="mt-2 text-3xl font-bold tabular-nums tracking-tight text-zinc-50">
          {value}
        </p>
      )}
    </div>
  );
}

export default function Home() {
  const { data: session, status } = useSession();
  const [copied, setCopied] = useState(false);
  const [total, setTotal] = useState(0);
  const [today, setToday] = useState(0);
  const [week, setWeek] = useState(0);
  const [referrals, setReferrals] = useState<ReferralRow[]>([]);
  const [statsLoading, setStatsLoading] = useState(true);

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
      setTotal(0);
      setToday(0);
      setWeek(0);
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
            setTotal(0);
            setToday(0);
            setWeek(0);
            setReferrals([]);
          }
          return;
        }
        const data: unknown = await res.json();
        if (cancelled || !data || typeof data !== "object") return;
        const o = data as Record<string, unknown>;
        if (!cancelled) {
          setTotal(typeof o.total === "number" ? o.total : 0);
          setToday(typeof o.today === "number" ? o.today : 0);
          setWeek(typeof o.week === "number" ? o.week : 0);
          setReferrals(parseReferrals(o.referrals));
        }
      } catch {
        if (!cancelled) {
          setTotal(0);
          setToday(0);
          setWeek(0);
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

  return (
    <div className="mx-auto max-w-[1100px]">
      <header className="mb-10 flex flex-col gap-4 border-b border-zinc-800/80 pb-6 sm:flex-row sm:items-center sm:justify-between">
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

      <section className="mb-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total Referrals" value={total} loading={statsLoading} />
        <StatCard title="Today" value={today} loading={statsLoading} />
        <StatCard title="This Week" value={week} loading={statsLoading} />
        <StatCard title="Rank" value="—" />
      </section>

      <section>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-zinc-500">
          Your Referral Link
        </h2>
        <div className="flex flex-col gap-3 rounded-xl border border-zinc-800/80 bg-zinc-900/60 p-4 shadow-sm shadow-black/20 sm:flex-row sm:items-stretch sm:gap-3">
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

      <section className="mt-12">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-zinc-500">
          Your Referrals
        </h2>
        <div className="w-full overflow-hidden rounded-xl border border-zinc-800/80 bg-zinc-900/60 p-4 shadow-sm shadow-black/20 backdrop-blur-sm sm:p-5">
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
