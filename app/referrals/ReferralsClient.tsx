"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { formatJoinedAt } from "@/lib/callDisplayFormat";
import { terminalChrome, terminalSurface, terminalUi } from "@/lib/terminalDesignTokens";

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
  pendingQualifyingPayments: number;
  grantedLedgerRows: number;
  voidedLedgerRows: number;
  activePayingReferrals: number;
  legacyGrantedProDaysTotal: number;
  balanceCents?: number;
  pendingCreditCents?: number;
};

function fmtUsdFromCents(cents: number): string {
  const n = Math.max(0, Math.floor(Number(cents) || 0)) / 100;
  return n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 2 });
}

function initialsFromHandle(name: string): string {
  const s = name.replace(/[^a-z0-9]/gi, "").slice(0, 2);
  return (s || name.slice(0, 2)).toUpperCase() || "—";
}

function fmtX(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "—";
  return `${n.toFixed(1)}x`;
}

const statTile =
  "rounded-xl border border-zinc-800/85 bg-zinc-950/55 p-4 shadow-[inset_0_1px_0_0_rgba(63,63,70,0.14)] transition hover:border-zinc-700/90 hover:bg-zinc-950/75";

const statTileTop =
  "rounded-xl border border-amber-500/30 bg-gradient-to-br from-amber-500/[0.07] via-zinc-950 to-zinc-950 p-4 ring-1 ring-amber-500/15 shadow-[inset_0_1px_0_0_rgba(251,191,36,0.1)]";

const panelShell = `${terminalSurface.panelCard} p-4 sm:p-5`;

const REF_BASE = "https://mcgbot.xyz/ref";

function listEmptyState(title: string, body: string) {
  return (
    <div className="rounded-xl border border-dashed border-zinc-700/55 bg-zinc-950/35 px-4 py-10 text-center">
      <p className="text-sm font-medium text-zinc-400">{title}</p>
      <p className="mx-auto mt-2 max-w-sm text-xs leading-relaxed text-zinc-600">{body}</p>
    </div>
  );
}

type RefView = "overview" | "performance" | "rewards";

const refTabBase =
  "flex-1 rounded-md px-3 py-2.5 text-center text-sm font-semibold transition sm:py-2";
const refTabActive = "border border-emerald-500/35 bg-emerald-500/10 text-emerald-100 shadow-[inset_0_1px_0_0_rgba(16,185,129,0.12)]";
const refTabInactive =
  "border border-transparent text-zinc-500 hover:border-zinc-700/60 hover:bg-zinc-900/50 hover:text-zinc-200";

export function ReferralsClient() {
  const pathname = usePathname() ?? "";
  const view: RefView = pathname.endsWith("/rewards")
    ? "rewards"
    : pathname.endsWith("/performance")
      ? "performance"
      : "overview";

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
            pendingQualifyingPayments: Number(rs.pendingQualifyingPayments) || 0,
            grantedLedgerRows: Number(rs.grantedLedgerRows) || 0,
            voidedLedgerRows: Number(rs.voidedLedgerRows) || 0,
            activePayingReferrals: Number(rs.activePayingReferrals) || 0,
            legacyGrantedProDaysTotal: Number(rs.legacyGrantedProDaysTotal) || 0,
            balanceCents: Number(rs.balanceCents) || 0,
            pendingCreditCents: Number(rs.pendingCreditCents) || 0,
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

  const heroBlurb =
    view === "rewards"
      ? "Qualifying subscription payments from people you referred. Ledger preview until a published reward policy turns rows into grants."
      : view === "performance"
        ? "Call performance for people you referred — averages, bests, and activity once they start logging calls."
        : "One link, full attribution. Track who you brought in and how they perform — same density as the rest of the terminal. Open this page anytime from your profile menu (top right).";

  return (
    <div className="mx-auto max-w-5xl px-4 pb-20 pt-4 sm:px-6">
      <header
        className={`mb-6 ${terminalChrome.headerRule} pb-6`}
        data-tutorial="referrals.hero"
      >
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-emerald-300/85">Referral program</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-50">Referrals</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-400">{heroBlurb}</p>
        </div>
        <nav
          className={`mt-6 flex gap-1 rounded-xl border border-zinc-800/80 bg-zinc-950/45 p-1 ${terminalSurface.insetEdgeSoft}`}
          aria-label="Referrals sections"
        >
          <Link
            href="/referrals"
            className={`${refTabBase} ${view === "overview" ? refTabActive : refTabInactive}`}
            prefetch={false}
          >
            Overview
          </Link>
          <Link
            href="/referrals/performance"
            className={`${refTabBase} ${view === "performance" ? refTabActive : refTabInactive}`}
            prefetch={false}
          >
            Performance
          </Link>
          <Link
            href="/referrals/rewards"
            className={`${refTabBase} ${view === "rewards" ? refTabActive : refTabInactive}`}
            prefetch={false}
          >
            Rewards
          </Link>
        </nav>
      </header>

      {view === "overview" && (
        <div
          className={`mb-6 rounded-xl border border-zinc-800/80 bg-zinc-950/40 px-4 py-3.5 ${terminalSurface.insetEdgeSoft}`}
        >
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">Flow</p>
          <ol className="mt-2 flex flex-col gap-2.5 text-sm text-zinc-300 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-3 sm:gap-y-1 sm:text-xs">
            <li className="flex items-center gap-2">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-zinc-600/80 bg-zinc-900 text-[11px] font-bold text-zinc-200">
                1
              </span>
              <span>Share your link (X, Discord, DMs)</span>
            </li>
            <span className="hidden text-zinc-600 sm:inline" aria-hidden>
              →
            </span>
            <li className="flex items-center gap-2">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-zinc-600/80 bg-zinc-900 text-[11px] font-bold text-zinc-200">
                2
              </span>
              <span>Friends join through McGBot</span>
            </li>
            <span className="hidden text-zinc-600 sm:inline" aria-hidden>
              →
            </span>
            <li className="flex items-center gap-2">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-zinc-600/80 bg-zinc-900 text-[11px] font-bold text-zinc-200">
                3
              </span>
              <span>Signups & performance roll up here</span>
            </li>
          </ol>
        </div>
      )}

      {(view === "overview" || view === "performance") && (
        <>
          <section
            className={`relative mb-8 overflow-hidden rounded-2xl border border-zinc-800/90 ${terminalSurface.panelCard} p-5 sm:p-6`}
            data-tutorial="referrals.linkHub"
          >
        <div
          className="pointer-events-none absolute inset-y-3 left-0 w-px bg-gradient-to-b from-emerald-500/50 via-emerald-400/30 to-transparent"
          aria-hidden
        />
        <div className="relative pl-3 sm:pl-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between sm:gap-3">
            <div className="min-w-0">
              <h2 className="text-sm font-semibold tracking-tight text-zinc-100">Your link</h2>
              <p className="mt-1 text-xs text-zinc-500">
                Vanity slug if configured; numeric ID link always works.
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
              <Link
                href="/settings#referral-link"
                className={terminalUi.secondaryButtonSm}
              >
                Edit in settings
              </Link>
              <span className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-200/90">
                Live
              </span>
            </div>
          </div>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-stretch">
            <div
              className={`min-w-0 flex-1 break-all rounded-xl border border-zinc-800/80 bg-black/35 px-3 py-3 font-mono text-[12px] text-zinc-200 ${terminalSurface.insetEdgeSoft} sm:text-sm`}
            >
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
              className="w-full shrink-0 rounded-xl border border-emerald-500/35 bg-emerald-500/15 px-4 py-3 text-sm font-semibold text-emerald-50 transition hover:bg-emerald-500/25 disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto sm:px-6"
            >
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          {vanityUrl && idUrl ? (
            <div className="mt-3 flex flex-col gap-2 rounded-xl border border-zinc-800/70 bg-zinc-900/30 px-3 py-3 text-xs text-zinc-500 sm:flex-row sm:items-center sm:justify-between">
              <span className="min-w-0">
                <span className="font-medium text-zinc-400">Fallback ID link</span>{" "}
                <span className="break-all font-mono text-zinc-500">{idUrl}</span>
              </span>
              <button
                type="button"
                onClick={() => void copyIdLink()}
                className="w-full shrink-0 rounded-md border border-zinc-700/80 bg-zinc-950/60 px-2.5 py-2 text-[11px] font-semibold text-zinc-200 transition hover:bg-zinc-900 sm:w-auto sm:py-1.5"
              >
                Copy ID link
              </button>
            </div>
          ) : null}
        </div>
      </section>

      <section aria-label="Referral stats" className="mb-8" data-tutorial="referrals.stats">
        <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-600">Network snapshot</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {topReferral ? (
            <div className={statTileTop}>
              <div className="flex items-start justify-between gap-2">
                <p className="text-[11px] font-medium uppercase tracking-wide text-amber-200/80">Best performer</p>
                <span className="shrink-0 rounded border border-amber-500/25 bg-black/30 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-200/90">
                  Top
                </span>
              </div>
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
                    className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-800/80 bg-black/40 px-2 py-1 text-[11px]"
                  >
                    <span className="font-semibold text-zinc-200">{coin.symbol}</span>
                    <span className="tabular-nums font-semibold text-emerald-400">{fmtX(coin.multiplier)}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex flex-col justify-center rounded-xl border border-dashed border-zinc-700/60 bg-zinc-950/40 p-4">
              <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">Best performer</p>
              <p className="mt-3 text-sm leading-snug text-zinc-500">
                When referred users start calling, your strongest avg / best multiple shows here.
              </p>
            </div>
          )}

          <div className={statTile}>
            <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">Total referrals</p>
            <p className="mt-2 text-2xl font-bold tabular-nums tracking-tight text-zinc-50">
              {referralsLoaded ? (refStats?.total ?? referrals.length) : "—"}
            </p>
            <p className="mt-1 text-xs text-zinc-600">All-time signups</p>
          </div>

          <div className={statTile}>
            <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">Today</p>
            <p className="mt-2 text-2xl font-bold tabular-nums tracking-tight text-zinc-50">
              {referralsLoaded ? (refStats?.today ?? 0) : "—"}
            </p>
            <p className="mt-1 text-xs text-zinc-600">New signups (24h)</p>
          </div>

          <div className={statTile}>
            <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">This week</p>
            <p className="mt-2 text-2xl font-bold tabular-nums tracking-tight text-zinc-50">
              {referralsLoaded ? (refStats?.week ?? 0) : "—"}
            </p>
            <p className="mt-1 text-xs text-zinc-600">New signups (7d)</p>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 lg:gap-6" data-tutorial="referrals.lists">
        <section className={panelShell}>
          <div className="mb-4 flex items-baseline justify-between gap-2 border-b border-zinc-800/70 pb-3">
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
                  className="flex flex-col gap-2 rounded-lg border border-zinc-800/70 bg-zinc-950/35 px-3 py-2.5 transition hover:border-zinc-700/90 hover:bg-zinc-900/40 sm:flex-row sm:items-center sm:justify-between sm:gap-3"
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
          <div className="mb-4 flex items-baseline justify-between gap-2 border-b border-zinc-800/70 pb-3">
            <h2 className="text-sm font-semibold tracking-tight text-zinc-100">Referral performance</h2>
            <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-600">Avg / best</span>
          </div>
          {performance.length > 0 ? (
            <ul className="space-y-2">
              {performance.map((p, i) => (
                <li
                  key={`${p.username}-${i}`}
                  className="rounded-lg border border-zinc-800/70 bg-zinc-950/35 px-3 py-3 transition hover:border-zinc-700/90 hover:bg-zinc-900/40"
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
        </>
      )}

      {view === "overview" && (
        <Link
          href="/referrals/rewards"
          className={`mb-8 block rounded-2xl border border-violet-500/25 bg-gradient-to-br from-violet-950/30 via-zinc-950/80 to-zinc-950 p-5 shadow-[inset_0_1px_0_0_rgba(139,92,246,0.12)] transition hover:border-violet-400/40 hover:from-violet-950/40 sm:p-6`}
          data-tutorial="referrals.rewards"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-violet-300/90">Rewards</p>
              <p className="mt-1 text-sm font-semibold text-zinc-100">Attribution ledger</p>
              <p className="mt-1 max-w-xl text-xs leading-relaxed text-zinc-500">
                10% of qualifying payments from referred members accrues as credit (cap per person). Open Rewards for
                the full ledger; redeem whole months on Membership.
              </p>
            </div>
            <div className="flex shrink-0 flex-col items-stretch gap-2 sm:items-end">
              {!referralsLoaded ? (
                <span className="text-xs text-zinc-500">Loading…</span>
              ) : rewardSummary ? (
                <p className="text-right text-xs text-zinc-400">
                  <span className="font-mono tabular-nums text-emerald-200/90">
                    {fmtUsdFromCents(rewardSummary.balanceCents ?? 0)}
                  </span>{" "}
                  spendable ·{" "}
                  <span className="font-mono tabular-nums text-amber-200/90">
                    {fmtUsdFromCents(rewardSummary.pendingCreditCents ?? 0)}
                  </span>{" "}
                  pending
                </p>
              ) : (
                <span className="text-xs text-zinc-500">Ledger preview</span>
              )}
              <span className="rounded-lg border border-violet-500/35 bg-violet-500/15 px-3 py-2 text-center text-xs font-semibold text-violet-100 sm:min-w-[8rem]">
                Open Rewards →
              </span>
            </div>
          </div>
        </Link>
      )}

      {view === "rewards" && (
        <section
          className={`rounded-2xl border border-zinc-800/90 ${terminalSurface.panelCard} p-5 sm:p-6`}
          data-tutorial="referrals.rewards"
        >
          <div className="border-b border-violet-500/20 pb-4">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-semibold tracking-tight text-zinc-100">Rewards</h2>
              <span className="rounded-md border border-violet-500/30 bg-violet-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-violet-200/90">
                Attribution
              </span>
            </div>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-zinc-500">
              You earn <span className="font-medium text-zinc-300">10%</span> of each referred member’s qualifying
              payment (USD) as account credit, up to <span className="font-medium text-zinc-300">six list-price months</span>{" "}
              per person in their first 24 months paid. Credit becomes spendable after a short refund window; redeem in
              whole-month bundles at public tier prices on <Link href="/membership" className="text-violet-300 underline">Membership</Link>.
            </p>
          </div>

          {!referralsLoaded ? (
            <div className="mt-5 rounded-xl border border-dashed border-zinc-700/60 bg-zinc-950/40 px-4 py-8 text-center">
              <p className="text-sm text-zinc-500">Loading reward snapshot…</p>
            </div>
          ) : rewardSummary ? (
            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div className="rounded-xl border border-emerald-500/25 bg-emerald-950/20 px-4 py-4 shadow-[inset_0_1px_0_0_rgba(16,185,129,0.12)]">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-300/90">Spendable credit</p>
                <p className="mt-2 text-2xl font-bold tabular-nums text-zinc-50">
                  {fmtUsdFromCents(rewardSummary.balanceCents ?? 0)}
                </p>
                <p className="mt-1 text-xs text-zinc-500">Applied at checkout on Membership (1/3/6/12 mo tiers).</p>
              </div>
              <div className="rounded-xl border border-amber-500/25 bg-amber-950/15 px-4 py-4 shadow-[inset_0_1px_0_0_rgba(245,158,11,0.1)]">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-200/85">Pending credit</p>
                <p className="mt-2 text-2xl font-bold tabular-nums text-zinc-50">
                  {fmtUsdFromCents(rewardSummary.pendingCreditCents ?? 0)}
                </p>
                <p className="mt-1 text-xs text-zinc-500">Accrued from payments still inside the refund/dispute window.</p>
              </div>
              <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/50 px-4 py-4 shadow-[inset_0_1px_0_0_rgba(139,92,246,0.08)]">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-violet-300/80">Pending events</p>
                <p className="mt-2 text-2xl font-bold tabular-nums text-zinc-50">
                  {rewardSummary.pendingQualifyingPayments}
                </p>
                <p className="mt-1 text-xs text-zinc-500">Qualifying payment rows (incl. in refund window).</p>
              </div>
              <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/50 px-4 py-4 shadow-[inset_0_1px_0_0_rgba(139,92,246,0.08)]">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-violet-300/80">
                  Paying refs (active sub)
                </p>
                <p className="mt-2 text-2xl font-bold tabular-nums text-zinc-50">
                  {rewardSummary.activePayingReferrals}
                </p>
                <p className="mt-1 text-xs text-zinc-500">Referred users with valid Pro right now.</p>
              </div>
              <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/50 px-4 py-4 shadow-[inset_0_1px_0_0_rgba(139,92,246,0.08)]">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-violet-300/80">Settled rows</p>
                <p className="mt-2 text-2xl font-bold tabular-nums text-zinc-50">{rewardSummary.grantedLedgerRows}</p>
                <p className="mt-1 text-xs text-zinc-500">Ledger rows already credited to balance (incl. legacy).</p>
              </div>
              <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/50 px-4 py-4 shadow-[inset_0_1px_0_0_rgba(139,92,246,0.08)]">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-violet-300/80">
                  Legacy Pro days total
                </p>
                <p className="mt-2 text-2xl font-bold tabular-nums text-zinc-50">
                  {rewardSummary.legacyGrantedProDaysTotal}
                </p>
                <p className="mt-1 text-xs text-zinc-500">Historical Pro-day grants on older rows.</p>
              </div>
            </div>
          ) : (
            <div className="mt-5 rounded-xl border border-dashed border-zinc-700/60 bg-zinc-950/40 px-4 py-6 text-center">
              <p className="text-sm text-zinc-500">
                Ledger summary unavailable. Ensure SUPABASE_SERVICE_ROLE_KEY is set on the server.
              </p>
            </div>
          )}

          {rewardSummary != null && rewardSummary.voidedLedgerRows > 0 ? (
            <p className="mt-4 text-xs text-zinc-600">
              Voided ledger rows:{" "}
              <span className="font-mono tabular-nums text-zinc-500">{rewardSummary.voidedLedgerRows}</span>
            </p>
          ) : null}

          <div className="mt-5 rounded-xl border border-dashed border-zinc-700/60 bg-zinc-950/35 px-4 py-4">
            <p className="text-xs font-medium text-zinc-300">Attribution</p>
            <p className="mx-auto mt-2 max-w-2xl text-xs leading-relaxed text-zinc-500">
              Last qualifying referral link click within 7 days can override Discord-invite attribution at Stripe
              checkout. One household / one referred account. Affiliates (cash) stay a separate program.
            </p>
          </div>
        </section>
      )}
    </div>
  );
}
