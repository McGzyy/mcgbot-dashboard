"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { formatJoinedAt } from "@/lib/callDisplayFormat";

type Referral = {
  userId: string;
  joinedAt: number;
  displayName: string | null;
  avatarUrl: string | null;
};

type TopCoin = {
  symbol: string;
  multiplier: number;
  image: string | null;
};

type ReferralPerformance = {
  username: string;
  calls: number;
  avgX: number;
  bestX: number;
  active: boolean;
  topCoins?: TopCoin[];
};

type RewardSummary = {
  totalProDaysEarned: number;
  activePayingReferrals: number;
  creditDivisor: number;
  examplePlanDurationDays: number | null;
  estimatedDaysPerReferralRenewal: number | null;
};

function initialsFromHandle(name: string): string {
  const s = name.replace(/[^a-z0-9]/gi, "").slice(0, 2);
  return (s || name.slice(0, 2)).toUpperCase() || "—";
}

function fmtX(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "—";
  return `${n.toFixed(1)}x`;
}

const statCard =
  "rounded-xl border border-emerald-500/15 bg-emerald-950/[0.12] p-4 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)] transition hover:border-emerald-500/25 hover:bg-emerald-950/20";

const panelShell =
  "rounded-2xl border border-zinc-800/60 bg-gradient-to-b from-zinc-900/40 to-zinc-950/90 p-4 ring-1 ring-white/[0.04] sm:p-6";

const REF_BASE = "https://mcgbot.xyz/ref";

function listEmptyState(title: string, body: string) {
  return (
    <div className="rounded-xl border border-dashed border-zinc-700/55 bg-zinc-950/35 px-4 py-10 text-center">
      <p className="text-sm font-medium text-zinc-400">{title}</p>
      <p className="mx-auto mt-2 max-w-sm text-xs leading-relaxed text-zinc-600">{body}</p>
    </div>
  );
}

export default function ReferralsPage() {
  const { data: session, status } = useSession();
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [performance] = useState<ReferralPerformance[]>([]);
  const [copied, setCopied] = useState(false);
  const [referralVanitySlug, setReferralVanitySlug] = useState<string | null>(null);
  const [slugLoaded, setSlugLoaded] = useState(false);
  const [referralsLoaded, setReferralsLoaded] = useState(false);
  const [referralsError, setReferralsError] = useState<string | null>(null);
  const [refStats, setRefStats] = useState<{ total: number; today: number; week: number } | null>(null);
  const [rewardSummary, setRewardSummary] = useState<RewardSummary | null>(null);

  const discordId = session?.user?.id?.trim() ?? "";
  const idUrl = discordId ? `${REF_BASE}/${discordId}` : "";
  const vanityUrl =
    referralVanitySlug && referralVanitySlug.length > 0
      ? `${REF_BASE}/${referralVanitySlug}`
      : null;
  const primaryShareUrl = vanityUrl ?? idUrl;
  const refReady = status !== "loading" && Boolean(primaryShareUrl);

  useEffect(() => {
    if (status !== "authenticated" || !discordId) {
      setReferralVanitySlug(null);
      setSlugLoaded(status !== "loading");
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/me/referral-slug", { credentials: "same-origin" });
        const j = (await res.json().catch(() => ({}))) as Record<string, unknown>;
        if (cancelled) return;
        if (!res.ok) {
          setReferralVanitySlug(null);
          return;
        }
        const s =
          typeof j.referral_slug === "string" && j.referral_slug.trim()
            ? j.referral_slug.trim().toLowerCase()
            : null;
        setReferralVanitySlug(s);
      } catch {
        if (!cancelled) setReferralVanitySlug(null);
      } finally {
        if (!cancelled) setSlugLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [status, discordId]);

  const topReferral = useMemo(
    () => performance.filter((p) => p.calls > 0).sort((a, b) => b.avgX - a.avgX)[0],
    [performance]
  );

  const activeCount = useMemo(
    () => performance.filter((p) => p.active).length,
    [performance]
  );

  useEffect(() => {
    if (status !== "authenticated") {
      setReferrals([]);
      setRefStats(null);
      setRewardSummary(null);
      setReferralsLoaded(status !== "loading");
      setReferralsError(null);
      return;
    }
    let cancelled = false;
    setReferralsLoaded(false);
    setReferralsError(null);
    void (async () => {
      try {
        const res = await fetch("/api/referrals", { credentials: "same-origin" });
        const j = (await res.json().catch(() => ({}))) as Record<string, unknown>;
        if (cancelled) return;
        if (!res.ok) {
          setReferrals([]);
          setRefStats(null);
          setRewardSummary(null);
          setReferralsError(typeof j.error === "string" ? j.error : "Could not load referrals.");
          return;
        }

        const rows = Array.isArray(j.referrals) ? (j.referrals as Record<string, unknown>[]) : [];
        const mapped = rows
          .map((r) => ({
            userId: typeof r.referred_user_id === "string" ? r.referred_user_id : "",
            joinedAt: typeof r.joined_at === "number" ? r.joined_at : Number(r.joined_at),
            displayName:
              typeof r.referred_display_name === "string" && r.referred_display_name.trim()
                ? r.referred_display_name.trim()
                : null,
            avatarUrl:
              typeof r.referred_avatar_url === "string" && r.referred_avatar_url.trim()
                ? r.referred_avatar_url.trim()
                : null,
          }))
          .filter((r) => r.userId && Number.isFinite(r.joinedAt) && r.joinedAt > 0)
          .sort((a, b) => b.joinedAt - a.joinedAt);

        setReferrals(mapped);
        setRefStats({
          total: Number(j.total) || mapped.length,
          today: Number(j.today) || 0,
          week: Number(j.week) || 0,
        });

        const rs = j.rewardSummary as Record<string, unknown> | null | undefined;
        if (rs && typeof rs === "object") {
          setRewardSummary({
            totalProDaysEarned: Number(rs.totalProDaysEarned) || 0,
            activePayingReferrals: Number(rs.activePayingReferrals) || 0,
            creditDivisor: Number(rs.creditDivisor) || 5,
            examplePlanDurationDays:
              rs.examplePlanDurationDays == null
                ? null
                : Number.isFinite(Number(rs.examplePlanDurationDays))
                  ? Math.floor(Number(rs.examplePlanDurationDays))
                  : null,
            estimatedDaysPerReferralRenewal:
              rs.estimatedDaysPerReferralRenewal == null
                ? null
                : Number.isFinite(Number(rs.estimatedDaysPerReferralRenewal))
                  ? Math.floor(Number(rs.estimatedDaysPerReferralRenewal))
                  : null,
          });
        } else {
          setRewardSummary(null);
        }
      } catch {
        if (!cancelled) {
          setReferrals([]);
          setRefStats(null);
          setRewardSummary(null);
          setReferralsError("Could not load referrals.");
        }
      } finally {
        if (!cancelled) setReferralsLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [status]);

  const copyLink = useCallback(async () => {
    if (!primaryShareUrl) return;
    try {
      await navigator.clipboard.writeText(primaryShareUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      /* ignore */
    }
  }, [primaryShareUrl]);

  const copyIdLink = useCallback(async () => {
    if (!idUrl) return;
    try {
      await navigator.clipboard.writeText(idUrl);
    } catch {
      /* ignore */
    }
  }, [idUrl]);

  const hasReferrals = referrals.length > 0;
  const nowMs = Date.now();

  return (
    <div className="mx-auto w-full max-w-[1100px] space-y-6 px-0 py-6 sm:space-y-8 sm:py-10">
      {/* Hero */}
      <header
        className="relative overflow-hidden rounded-2xl border border-zinc-800/50 bg-gradient-to-br from-zinc-900/90 via-zinc-950 to-[#070708] p-5 shadow-[0_24px_60px_-40px_rgba(0,0,0,0.88)] ring-1 ring-white/[0.05] sm:p-8"
        data-tutorial="referrals.hero"
      >
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(105deg,transparent_38%,rgba(16,185,129,0.05)_50%,transparent_62%)]" />
        <div className="pointer-events-none absolute -right-20 -top-16 h-56 w-56 rounded-full bg-emerald-600/[0.07] blur-3xl" />
        <div className="pointer-events-none absolute -bottom-16 -left-12 h-48 w-48 rounded-full bg-cyan-500/[0.06] blur-3xl" />
        <div className="relative">
          <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-emerald-400/90">
            Referral program
          </p>
          <h1 className="mt-2 bg-gradient-to-b from-white via-zinc-100 to-zinc-500 bg-clip-text text-2xl font-bold tracking-tight text-transparent sm:text-3xl sm:tracking-tighter">
            Referrals
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-zinc-400">
            One link, full attribution. Track who you brought in, how they perform, and where your
            network compounds — built like a trading terminal, not a coupon page.
          </p>
        </div>
      </header>

      {/* Link hub */}
      <section
        className="relative overflow-hidden rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-950/[0.18] via-[#070a08] to-zinc-950 shadow-[0_0_0_1px_rgba(16,185,129,0.08),0_20px_50px_-36px_rgba(0,0,0,0.85)] ring-1 ring-emerald-500/10"
        data-tutorial="referrals.linkHub"
      >
        <div
          className="pointer-events-none absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-emerald-400/80 via-emerald-500/50 to-teal-700/40"
          aria-hidden
        />
        <div className="relative px-4 py-4 sm:px-6 sm:py-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between sm:gap-3">
            <div className="min-w-0">
              <h2 className="text-sm font-semibold tracking-tight text-zinc-100">Your link</h2>
              <p className="mt-1 text-xs text-emerald-100/45">
                Share your vanity link if you set one; the numeric link always works and never
                changes.
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
              <Link
                href="/settings#referral-link"
                className="rounded-md border border-zinc-600/80 bg-zinc-900/60 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-zinc-200 transition hover:border-zinc-500 hover:bg-zinc-800"
              >
                Edit in settings
              </Link>
              <span className="rounded-md border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-200/90">
                Live
              </span>
            </div>
          </div>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-stretch">
            <div className="min-w-0 flex-1 break-all rounded-xl border border-emerald-500/15 bg-black/40 px-3 py-3 font-mono text-[12px] text-zinc-200 shadow-inner sm:text-sm">
              {status === "loading" || !slugLoaded ? (
                <span className="text-zinc-500">Loading your link…</span>
              ) : primaryShareUrl ? (
                primaryShareUrl
              ) : (
                <span className="text-zinc-500">Sign in with Discord to see your referral link.</span>
              )}
            </div>
            <button
              type="button"
              onClick={() => void copyLink()}
              disabled={!refReady}
              className="w-full shrink-0 rounded-xl border border-emerald-400/35 bg-emerald-500/15 px-4 py-3 text-sm font-semibold text-emerald-50 transition hover:bg-emerald-500/25 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#050505] enabled:cursor-pointer disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto sm:px-6"
            >
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          {vanityUrl && idUrl ? (
            <div className="mt-3 flex flex-col gap-2 rounded-lg border border-zinc-800/60 bg-black/20 px-3 py-3 text-xs text-zinc-500 sm:flex-row sm:items-center sm:justify-between">
              <span className="min-w-0">
                <span className="font-medium text-zinc-400">Fallback ID link</span>{" "}
                <span className="break-all font-mono text-zinc-500">{idUrl}</span>
              </span>
              <button
                type="button"
                onClick={() => void copyIdLink()}
                className="w-full shrink-0 self-stretch rounded-md border border-zinc-700 bg-zinc-900 px-2.5 py-2 text-[11px] font-semibold text-zinc-200 transition hover:bg-zinc-800 sm:w-auto sm:self-center sm:py-1"
              >
                Copy ID link
              </button>
            </div>
          ) : null}
        </div>
      </section>

      {/* KPI strip */}
      <section aria-label="Referral stats" data-tutorial="referrals.stats">
        <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-600">
          Network snapshot
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {topReferral ? (
            <div className="relative overflow-hidden rounded-xl border border-yellow-500/25 bg-gradient-to-br from-yellow-500/[0.08] via-zinc-950/80 to-zinc-950 p-4 shadow-[0_0_28px_-8px_rgba(234,179,8,0.18)] ring-1 ring-yellow-500/10">
              <div className="absolute right-3 top-3 rounded border border-yellow-500/20 bg-black/40 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-yellow-200/90">
                Top
              </div>
              <p className="text-[11px] font-medium uppercase tracking-wide text-yellow-500/75">
                Best performer
              </p>
              <p className="mt-2 truncate text-sm font-semibold text-zinc-50">{topReferral.username}</p>
              <p className="mt-0.5 text-xs text-zinc-500">{topReferral.calls} calls</p>
              <div className="mt-3 flex items-end justify-between gap-2">
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-zinc-600">Avg</p>
                  <p className="text-lg font-bold tabular-nums text-emerald-300">{fmtX(topReferral.avgX)}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] uppercase tracking-wide text-zinc-600">Best</p>
                  <p className="text-lg font-bold tabular-nums text-amber-300">{fmtX(topReferral.bestX)}</p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {(topReferral.topCoins ?? []).slice(0, 3).map((coin) => (
                  <div
                    key={coin.symbol}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-800/80 bg-black/35 px-2 py-1 text-[11px]"
                  >
                    <span className="font-semibold text-zinc-200">{coin.symbol}</span>
                    <span className="tabular-nums font-semibold text-emerald-400">{fmtX(coin.multiplier)}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex flex-col justify-center rounded-xl border border-dashed border-yellow-500/20 bg-yellow-500/[0.03] p-4 ring-1 ring-yellow-500/5">
              <p className="text-[11px] font-medium uppercase tracking-wide text-yellow-500/50">Best performer</p>
              <p className="mt-3 text-sm leading-snug text-zinc-500">
                When referred users start calling, your strongest avg / best multiple shows here.
              </p>
            </div>
          )}

          <div className={statCard}>
            <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">Total referrals</p>
            <p className="mt-2 text-2xl font-bold tabular-nums tracking-tight text-zinc-50">
              {referralsLoaded ? (refStats?.total ?? referrals.length) : "—"}
            </p>
            <p className="mt-1 text-xs text-zinc-600">All-time signups</p>
          </div>

          <div className={statCard}>
            <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">Today</p>
            <p className="mt-2 text-2xl font-bold tabular-nums tracking-tight text-zinc-50">
              {referralsLoaded ? (refStats?.today ?? 0) : "—"}
            </p>
            <p className="mt-1 text-xs text-zinc-600">New signups (24h)</p>
          </div>

          <div className={statCard}>
            <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">This week</p>
            <p className="mt-2 text-2xl font-bold tabular-nums tracking-tight text-zinc-50">
              {referralsLoaded ? (refStats?.week ?? 0) : "—"}
            </p>
            <p className="mt-1 text-xs text-zinc-600">New signups (7d)</p>
          </div>
        </div>
      </section>

      {/* How it works */}
      <div
        className="rounded-xl border border-zinc-800/70 bg-zinc-950/50 px-4 py-3.5 sm:px-5"
        data-tutorial="referrals.flow"
      >
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-600">Flow</p>
        <ol className="mt-2 flex flex-col gap-2 text-sm text-zinc-400 sm:flex-row sm:flex-wrap sm:items-center sm:gap-1 sm:text-xs">
          <li className="flex items-center gap-2">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-emerald-500/30 bg-emerald-500/10 text-[11px] font-bold text-emerald-300">
              1
            </span>
            <span>Drop your link in X, Discord, or DMs</span>
          </li>
          <span className="hidden text-zinc-700 sm:inline" aria-hidden>
            ·
          </span>
          <li className="flex items-center gap-2">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-emerald-500/30 bg-emerald-500/10 text-[11px] font-bold text-emerald-300">
              2
            </span>
            <span>Friends sign up through McGBot</span>
          </li>
          <span className="hidden text-zinc-700 sm:inline" aria-hidden>
            ·
          </span>
          <li className="flex items-center gap-2">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-emerald-500/30 bg-emerald-500/10 text-[11px] font-bold text-emerald-300">
              3
            </span>
            <span>Performance rolls up here in real time</span>
          </li>
        </ol>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2" data-tutorial="referrals.lists">
        <section className={panelShell}>
          <div className="mb-4 flex items-baseline justify-between gap-2 border-b border-zinc-800/60 pb-3">
            <h2 className="text-sm font-semibold tracking-tight text-zinc-100">Recent referrals</h2>
            <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-600">Latest</span>
          </div>
          {referralsError ? (
            <p className="rounded-lg border border-red-500/25 bg-red-950/20 px-3 py-2 text-sm text-red-200/90">
              {referralsError}
            </p>
          ) : !referralsLoaded ? (
            listEmptyState("Loading…", "Fetching your referrals.")
          ) : hasReferrals ? (
            <ul className="space-y-2">
              {referrals.map((ref, i) => (
                <li
                  key={`${ref.userId}-${i}`}
                  className="flex flex-col gap-2 rounded-xl border border-zinc-800/50 bg-black/25 px-3 py-2.5 transition hover:border-emerald-500/20 hover:bg-emerald-950/15 sm:flex-row sm:items-center sm:justify-between sm:gap-3"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-zinc-700/80 bg-zinc-900 text-[11px] font-bold tabular-nums text-zinc-300">
                      {ref.avatarUrl ? (
                        <img
                          src={ref.avatarUrl}
                          alt=""
                          className="h-full w-full rounded-lg object-cover"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        initialsFromHandle(ref.displayName ?? ref.userId)
                      )}
                    </div>
                    <span className="min-w-0 truncate text-sm font-medium text-zinc-100">
                      {ref.displayName ?? `${ref.userId.slice(0, 6)}…${ref.userId.slice(-6)}`}
                    </span>
                  </div>
                  <span className="shrink-0 pl-12 text-xs tabular-nums text-zinc-500 sm:pl-0 sm:text-right">
                    {formatJoinedAt(ref.joinedAt, nowMs)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            listEmptyState(
              "No referrals yet",
              "Share your link above. When someone joins through it, they’ll appear in this list with join time."
            )
          )}
        </section>

        <section className={panelShell}>
          <div className="mb-4 flex items-baseline justify-between gap-2 border-b border-zinc-800/60 pb-3">
            <h2 className="text-sm font-semibold tracking-tight text-zinc-100">Referral performance</h2>
            <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-600">Avg / best</span>
          </div>
          {performance.length > 0 ? (
            <ul className="space-y-2">
              {performance.map((p, i) => (
                <li
                  key={`${p.username}-${i}`}
                  className="rounded-xl border border-zinc-800/50 bg-black/25 px-3 py-3 transition hover:border-emerald-500/20 hover:bg-emerald-950/10"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-zinc-700/80 bg-zinc-900 text-[11px] font-bold text-zinc-300">
                        {initialsFromHandle(p.username)}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-zinc-100">{p.username}</p>
                        <p className="text-xs text-zinc-500">{p.calls} calls</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs sm:justify-end">
                      <span className="text-zinc-500">
                        Avg{" "}
                        <span className="font-semibold tabular-nums text-emerald-400">
                          {p.avgX > 0 ? fmtX(p.avgX) : "—"}
                        </span>
                      </span>
                      <span className="text-zinc-500">
                        Best{" "}
                        <span className="font-semibold tabular-nums text-amber-300">
                          {p.bestX > 0 ? fmtX(p.bestX) : "—"}
                        </span>
                      </span>
                      <span
                        className={
                          p.active
                            ? "rounded-md border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-200"
                            : "rounded-md border border-zinc-700/60 bg-zinc-900/50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-zinc-500"
                        }
                      >
                        {p.active ? "Active" : "Idle"}
                      </span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            listEmptyState(
              "No performance data yet",
              "After your referrals place calls, avg multiples, bests, and activity show up here."
            )
          )}
        </section>
      </div>

      {/* Rewards */}
      <section className="relative overflow-hidden rounded-2xl border border-violet-500/20 bg-gradient-to-br from-violet-950/[0.2] via-[#08060f] to-zinc-950 p-5 ring-1 ring-violet-500/10 sm:p-8">
        <div className="pointer-events-none absolute -right-16 top-0 h-40 w-40 rounded-full bg-violet-500/10 blur-3xl" />
        <div className="relative">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-semibold tracking-tight text-zinc-100">Rewards</h2>
            <span className="rounded-md border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-200/90">
              Pro days
            </span>
          </div>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-zinc-500">
            When someone you referred completes a paid subscription (on-chain checkout), you earn bonus Pro
            time: each of their payments credits you about one slice of their billing period (see divisor N
            below). Cash milestones can layer on later; this phase is subscription credit only.
          </p>

          {!referralsLoaded ? (
            <div className="mt-5 rounded-xl border border-dashed border-violet-500/25 bg-black/30 px-4 py-8 text-center">
              <p className="text-sm text-zinc-500">Loading reward snapshot…</p>
            </div>
          ) : rewardSummary ? (
            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl border border-violet-500/20 bg-black/35 px-4 py-4">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-violet-200/70">
                  Credited so far
                </p>
                <p className="mt-2 text-2xl font-bold tabular-nums text-zinc-50">
                  {rewardSummary.totalProDaysEarned}
                </p>
                <p className="mt-1 text-xs text-zinc-500">Bonus Pro days added to your membership</p>
              </div>
              <div className="rounded-xl border border-violet-500/20 bg-black/35 px-4 py-4">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-violet-200/70">
                  Paying refs (active sub)
                </p>
                <p className="mt-2 text-2xl font-bold tabular-nums text-zinc-50">
                  {rewardSummary.activePayingReferrals}
                </p>
                <p className="mt-1 text-xs text-zinc-500">Referred users whose Pro is currently valid</p>
              </div>
              <div className="rounded-xl border border-violet-500/20 bg-black/35 px-4 py-4">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-violet-200/70">
                  Divisor N
                </p>
                <p className="mt-2 text-2xl font-bold tabular-nums text-zinc-50">{rewardSummary.creditDivisor}</p>
                <p className="mt-1 text-xs text-zinc-500">
                  You get floor(referee paid days ÷ N) days per referee payment (minimum 1).
                </p>
              </div>
              <div className="rounded-xl border border-violet-500/20 bg-black/35 px-4 py-4">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-violet-200/70">
                  Per renewal (example)
                </p>
                <p className="mt-2 text-2xl font-bold tabular-nums text-zinc-50">
                  {rewardSummary.estimatedDaysPerReferralRenewal != null
                    ? rewardSummary.estimatedDaysPerReferralRenewal
                    : "—"}
                </p>
                <p className="mt-1 text-xs text-zinc-500">
                  {rewardSummary.examplePlanDurationDays != null
                    ? `If a referee pays for the ${rewardSummary.examplePlanDurationDays}-day starter plan, one renewal credits you about this many days.`
                    : "Based on your live subscription plans (first plan row)."}
                </p>
              </div>
            </div>
          ) : (
            <div className="mt-5 rounded-xl border border-dashed border-zinc-600/40 bg-black/30 px-4 py-6 text-center">
              <p className="text-sm text-zinc-500">
                Reward totals need the service role on the server. Check SUPABASE_SERVICE_ROLE_KEY.
              </p>
            </div>
          )}

          <div className="mt-5 rounded-xl border border-dashed border-violet-500/25 bg-black/30 px-4 py-4">
            <p className="text-xs font-medium text-violet-200/85">Why five referrals can cover you</p>
            <p className="mx-auto mt-2 max-w-2xl text-xs leading-relaxed text-zinc-500">
              If N is 5 and each referee is on the same paid period length as you, five referees each renewing
              once in a stretch roughly replaces one full period of your own subscription (5 × 1/5 = 1).
              In practice, plans differ and renewals do not line up on a calendar — treat this as a rule of
              thumb, not a guaranteed monthly balance.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
