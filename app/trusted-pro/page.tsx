"use client";

import Link from "next/link";
import { signIn, useSession } from "next-auth/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNotifications } from "@/app/contexts/NotificationsContext";
import { looksLikeDiscordSnowflake } from "@/lib/discordIdentity";
import { dexscreenerTokenUrl, formatRelativeTime } from "@/lib/modUiUtils";
import { terminalChrome, terminalSurface, terminalPage, terminalUi } from "@/lib/terminalDesignTokens";

const SOLANA_MINT_LIKE = /^[1-9A-HJ-NP-Za-km-z]{32,48}$/;

function solMintDexUrl(ca: string): string | null {
  const t = ca.trim();
  if (!t || !SOLANA_MINT_LIKE.test(t)) return null;
  return dexscreenerTokenUrl("solana", t);
}

const panelShell = `${terminalSurface.routeSectionFrame} bg-gradient-to-b from-zinc-900/40 to-zinc-950/90 p-4 sm:p-5`;
const feedScrollClass =
  "max-h-[min(40rem,72vh)] overflow-y-auto overscroll-contain pr-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

type TrustedProMe = {
  trustedPro: boolean;
  approvalsNeeded: number;
  totals: { submitted: number; approved: number; denied: number; pending: number };
  viewsTotal: number;
};

type TrustedProPublicStats = {
  trustedPros: number;
  totalCalls: number;
  avgCallMcUsd: number | null;
  avgAthMultiple: number | null;
  avgTimeToAthMs: number | null;
  bestAthMultipleAllTime: number | null;
};

type TrustedProCall = {
  id: string;
  author_discord_id: string;
  contract_address: string;
  thesis: string;
  narrative: string | null;
  catalysts: unknown;
  risks: string | null;
  time_horizon: string | null;
  entry_plan: string | null;
  invalidation: string | null;
  sources: unknown;
  tags: unknown;
  published_at: string | null;
  views_count: number;
  created_at: string;
};

function shortAddr(ca: string) {
  const s = ca.trim();
  if (s.length <= 14) return s;
  return `${s.slice(0, 8)}…${s.slice(-4)}`;
}

export default function TrustedProPage() {
  const { status } = useSession();
  const { addNotification } = useNotifications();
  const [me, setMe] = useState<TrustedProMe | null>(null);
  const [publicStats, setPublicStats] = useState<TrustedProPublicStats | null>(null);
  const [calls, setCalls] = useState<TrustedProCall[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [submitOpen, setSubmitOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [contractAddress, setContractAddress] = useState("");
  const [thesis, setThesis] = useState("");
  const [narrative, setNarrative] = useState("");

  const [applyOpen, setApplyOpen] = useState(false);
  const [applyBusy, setApplyBusy] = useState(false);
  const [applyNote, setApplyNote] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const [feedRes, meRes, statsRes] = await Promise.all([
        fetch("/api/public/trusted-pro-calls?limit=30&offset=0"),
        fetch("/api/me/trusted-pro", { credentials: "same-origin" }),
        fetch("/api/public/trusted-pro-stats"),
      ]);

      const feedJson = (await feedRes.json().catch(() => ({}))) as any;
      const meJson = (await meRes.json().catch(() => ({}))) as any;
      const statsJson = (await statsRes.json().catch(() => ({}))) as any;

      if (feedRes.ok && feedJson?.success === true) {
        setCalls(Array.isArray(feedJson.calls) ? feedJson.calls : []);
      } else {
        setCalls([]);
      }

      if (meRes.ok && meJson?.success === true) {
        setMe(meJson as TrustedProMe);
      } else if (status === "authenticated") {
        setMe({ trustedPro: false, approvalsNeeded: 3, totals: { submitted: 0, approved: 0, denied: 0, pending: 0 }, viewsTotal: 0 });
      } else {
        setMe(null);
      }

      if (statsRes.ok && statsJson?.success === true) {
        setPublicStats(statsJson as TrustedProPublicStats);
      } else {
        setPublicStats(null);
      }
    } catch {
      setErr("Could not load Trusted Pro calls.");
      setCalls([]);
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    void load();
  }, [load]);

  const canSubmit = me?.trustedPro === true;
  const canApply = status === "authenticated" && me?.trustedPro !== true;

  const submit = useCallback(async () => {
    if (!canSubmit) return;
    if (submitting) return;
    const ca = contractAddress.trim();
    const th = thesis.trim();
    if (!ca || th.length < 24) {
      addNotification({
        id: crypto.randomUUID(),
        text: "Contract address and thesis (min 24 chars) are required.",
        type: "call",
        createdAt: Date.now(),
        priority: "low",
      });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/trusted-pro-calls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contractAddress: ca,
          thesis: th,
          narrative: narrative.trim() || null,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as any;
      if (!res.ok || json?.success !== true) {
        addNotification({
          id: crypto.randomUUID(),
          text: typeof json?.error === "string" ? json.error : "Submit failed.",
          type: "call",
          createdAt: Date.now(),
          priority: "medium",
        });
        return;
      }
      addNotification({
        id: crypto.randomUUID(),
        text: json?.moderationRequired ? "Submitted for approval." : "Posted.",
        type: "call",
        createdAt: Date.now(),
        priority: "low",
      });
      setSubmitOpen(false);
      setContractAddress("");
      setThesis("");
      setNarrative("");
      await load();
    } finally {
      setSubmitting(false);
    }
  }, [addNotification, canSubmit, contractAddress, load, narrative, submitting, thesis]);

  const statLine = useMemo(() => {
    if (!me) return null;
    const a = me.totals.approved;
    const needed = me.approvalsNeeded;
    return `${a}/3 approvals • ${needed} until auto`;
  }, [me]);

  const publicSummary = useMemo(() => {
    if (!publicStats) return null;
    const mc =
      publicStats.avgCallMcUsd != null && Number.isFinite(publicStats.avgCallMcUsd)
        ? `$${Math.round(publicStats.avgCallMcUsd).toLocaleString("en-US")}`
        : "—";
    const avgAth =
      publicStats.avgAthMultiple != null && Number.isFinite(publicStats.avgAthMultiple)
        ? `${publicStats.avgAthMultiple.toFixed(2)}x`
        : "—";
    const bestAth =
      publicStats.bestAthMultipleAllTime != null && Number.isFinite(publicStats.bestAthMultipleAllTime)
        ? `${publicStats.bestAthMultipleAllTime.toFixed(2)}x`
        : "—";
    const avgT =
      publicStats.avgTimeToAthMs != null && Number.isFinite(publicStats.avgTimeToAthMs)
        ? `${Math.round(publicStats.avgTimeToAthMs / 60000).toLocaleString("en-US")}m`
        : "—";
    return { mc, avgAth, bestAth, avgT };
  }, [publicStats]);

  const apply = useCallback(async () => {
    if (!canApply) return;
    if (applyBusy) return;
    setApplyBusy(true);
    try {
      const res = await fetch("/api/me/trusted-pro-apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: applyNote.trim() || null }),
      });
      const json = (await res.json().catch(() => ({}))) as any;
      if (!res.ok || json?.success !== true) {
        addNotification({
          id: crypto.randomUUID(),
          text: typeof json?.error === "string" ? json.error : "Application failed.",
          type: "call",
          createdAt: Date.now(),
          priority: "medium",
        });
        return;
      }
      if (json.eligible !== true) {
        addNotification({
          id: crypto.randomUUID(),
          text: "You’re not eligible to apply yet. Keep building your track record and try again soon.",
          type: "call",
          createdAt: Date.now(),
          priority: "low",
        });
        return;
      }
      addNotification({
        id: crypto.randomUUID(),
        text: json.alreadyPending ? "Application already pending review." : "Application submitted for review.",
        type: "call",
        createdAt: Date.now(),
        priority: "low",
      });
      setApplyOpen(false);
      setApplyNote("");
    } finally {
      setApplyBusy(false);
    }
  }, [addNotification, applyBusy, applyNote, canApply]);

  if (status === "loading") {
    return (
      <div className="mx-auto max-w-6xl animate-pulse space-y-6 px-4 py-10 sm:px-6">
        <div className={`${terminalSurface.routeHeroFrame} p-8`}>
          <div className="h-4 w-32 rounded-md bg-zinc-800/70" />
          <div className="mt-5 h-9 max-w-xs rounded-lg bg-zinc-800/60 sm:h-10" />
          <div className="mt-4 h-20 max-w-2xl rounded-lg bg-zinc-800/45" />
        </div>
        <div className={`${panelShell} space-y-3`}>
          <div className="h-16 rounded-lg bg-zinc-800/40" />
        </div>
        <div className="space-y-3">
          <div className="h-28 rounded-2xl bg-zinc-900/40" />
          <div className="h-28 rounded-2xl bg-zinc-900/40" />
        </div>
      </div>
    );
  }

  const statTileBase = `${terminalPage.statTile} flex flex-col gap-0.5`;

  return (
    <div className="mx-auto max-w-6xl px-4 pb-20 pt-4 sm:px-6">
      <header
        className={`relative overflow-hidden ${terminalSurface.routeHeroFrame} p-6 sm:p-8 ${terminalChrome.headerRule}`}
        data-tutorial="trustedPro.header"
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-fuchsia-500/[0.07] blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-28 left-12 h-64 w-64 rounded-full bg-violet-600/[0.06] blur-3xl"
        />
        <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-fuchsia-300/85">
          Markets
        </p>
        <div className="relative mt-2 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-3xl font-bold tracking-tight text-white sm:text-[2.125rem] sm:leading-tight">
              Trusted Pro calls
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-zinc-400">
              Longform, thesis-driven posts from Trusted Pro members. Everyone can read; only Trusted Pros
              can submit new calls.
            </p>
          </div>
          {canSubmit ? (
            <button
              type="button"
              onClick={() => setSubmitOpen(true)}
              className="w-full shrink-0 rounded-xl bg-[color:var(--accent)] px-4 py-2.5 text-sm font-semibold text-black shadow-lg shadow-black/40 transition hover:bg-green-500 sm:w-auto"
            >
              Submit Trusted Pro call
            </button>
          ) : null}
        </div>
      </header>

      {canSubmit && me ? (
        <section className={`${panelShell} mt-8`}>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className={terminalPage.sectionTitle}>Your Trusted Pro stats</p>
              <p className={terminalPage.sectionHint}>{statLine}</p>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <div className={statTileBase}>
                <span className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">Total</span>
                <span className="text-lg font-semibold tabular-nums text-zinc-100">{me.totals.submitted}</span>
              </div>
              <div className={statTileBase}>
                <span className="text-[11px] font-medium uppercase tracking-wide text-emerald-500/80">
                  Approved
                </span>
                <span className="text-lg font-semibold tabular-nums text-emerald-100">{me.totals.approved}</span>
              </div>
              <div className={statTileBase}>
                <span className="text-[11px] font-medium uppercase tracking-wide text-red-400/80">Denied</span>
                <span className="text-lg font-semibold tabular-nums text-red-100">{me.totals.denied}</span>
              </div>
              <div className={statTileBase}>
                <span className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">Views</span>
                <span className="text-lg font-semibold tabular-nums text-zinc-100">{me.viewsTotal}</span>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {!canSubmit ? (
        <section className={`${panelShell} mt-8`}>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className={terminalPage.sectionTitle}>Trusted Pro intel</p>
              <p className={terminalPage.sectionHint}>Network aggregates across approved Trusted Pro calls.</p>
              {status === "unauthenticated" ? (
                <p className="mt-3 text-xs leading-relaxed text-zinc-500">
                  <button
                    type="button"
                    onClick={() => void signIn("discord", { callbackUrl: "/trusted-pro" })}
                    className="font-semibold text-fuchsia-300/90 underline decoration-fuchsia-500/30 underline-offset-2 transition hover:text-fuchsia-200"
                  >
                    Sign in with Discord
                  </button>{" "}
                  to apply for Trusted Pro.
                </p>
              ) : null}
            </div>
            {canApply ? (
              <button
                type="button"
                onClick={() => setApplyOpen(true)}
                className="w-full shrink-0 rounded-xl border border-emerald-500/30 bg-emerald-950/25 px-4 py-2.5 text-sm font-semibold text-emerald-100/95 shadow-[inset_0_1px_0_0_rgba(16,185,129,0.12)] transition hover:border-emerald-400/40 hover:bg-emerald-950/40 sm:w-auto"
              >
                Become a Trusted Pro
              </button>
            ) : null}
          </div>

          <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            {[
              { label: "Trusted Pros", value: publicStats?.trustedPros ?? "—" },
              { label: "Total calls", value: publicStats?.totalCalls ?? "—" },
              { label: "Avg call MC", value: publicSummary?.mc ?? "—" },
              { label: "Avg ATH", value: publicSummary?.avgAth ?? "—" },
              { label: "Avg time to ATH", value: publicSummary?.avgT ?? "—" },
              { label: "Best ATH", value: publicSummary?.bestAth ?? "—" },
            ].map((row) => (
              <div key={row.label} className={statTileBase}>
                <span className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">{row.label}</span>
                <span className="text-base font-semibold tabular-nums text-zinc-100">{row.value}</span>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {err ? (
        <div className="mt-8 rounded-xl border border-red-500/25 bg-red-950/25 px-4 py-3 text-sm text-red-200 ring-1 ring-red-500/10">
          {err}
        </div>
      ) : null}

      <section className={`${panelShell} mt-10`}>
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-zinc-800/60 pb-4">
          <div>
            <h2 className={terminalPage.sectionTitle}>Latest posts</h2>
            <p className={terminalPage.sectionHint}>
              {loading ? "Loading feed…" : `${calls.length} shown`}
            </p>
          </div>
        </div>

        <div className={`${feedScrollClass} mt-5 space-y-3`} data-tutorial="trustedPro.feed">
          {loading ? (
            <div className="space-y-3" aria-busy>
              {[0, 1, 2].map((i) => (
                <div key={i} className={`${terminalSurface.panelCardElevated} rounded-2xl p-4 shadow-none`}>
                  <div className="h-3 w-2/5 animate-pulse rounded bg-zinc-800/65" />
                  <div className="mt-3 h-5 w-4/5 animate-pulse rounded bg-zinc-800/55" />
                  <div className="mt-2 h-14 w-full animate-pulse rounded-lg bg-zinc-800/40" />
                </div>
              ))}
            </div>
          ) : calls.length === 0 ? (
            <div className="rounded-xl border border-dashed border-zinc-700/55 bg-zinc-950/35 px-4 py-14 text-center">
              <span className="text-2xl opacity-30" aria-hidden>
                ✦
              </span>
              <p className="mt-2 text-sm font-medium text-zinc-400">No Trusted Pro calls yet</p>
              <p className="mx-auto mt-2 max-w-sm text-xs leading-relaxed text-zinc-600">
                When members publish approved theses, they will appear here for everyone to read.
              </p>
            </div>
          ) : (
            calls.map((c) => {
              const dexUrl = solMintDexUrl(c.contract_address);
              const authorId = c.author_discord_id.trim();
              const authorHref = looksLikeDiscordSnowflake(authorId)
                ? `/user/${encodeURIComponent(authorId)}`
                : null;
              const displayTs = c.published_at ?? c.created_at;

              return (
                <article
                  key={c.id}
                  className={`group ${terminalSurface.panelCardElevated} relative rounded-2xl border-violet-500/10 bg-zinc-950/30 p-4 ring-1 ring-white/[0.02] transition hover:border-violet-500/25 hover:bg-zinc-900/25 sm:p-5`}
                >
                  <div className="pointer-events-none absolute inset-y-0 left-0 w-1 rounded-l-2xl bg-gradient-to-b from-violet-500/50 to-fuchsia-500/35 opacity-60 transition group-hover:opacity-100" />
                  <div className="relative flex flex-wrap items-start justify-between gap-4 pl-2 sm:pl-3">
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-zinc-500">
                        <span className="font-semibold uppercase tracking-[0.14em] text-zinc-600">CA</span>
                        {dexUrl ? (
                          <a
                            href={dexUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-mono text-violet-200/90 underline decoration-violet-500/30 underline-offset-2 transition hover:text-violet-100"
                          >
                            {shortAddr(c.contract_address)}
                          </a>
                        ) : (
                          <span className="break-all font-mono text-zinc-300">{shortAddr(c.contract_address)}</span>
                        )}
                        <span className="hidden text-zinc-700 sm:inline" aria-hidden>
                          ·
                        </span>
                        <span className="w-full text-zinc-600 sm:w-auto">Caller</span>
                        {authorHref ? (
                          <Link
                            href={authorHref}
                            className="font-mono text-zinc-300 underline decoration-zinc-600 underline-offset-2 transition hover:text-white"
                          >
                            {shortAddr(authorId)}
                          </Link>
                        ) : (
                          <span className="break-all font-mono text-zinc-400">{authorId || "—"}</span>
                        )}
                      </p>
                      <p className="mt-3 text-base font-semibold leading-snug tracking-tight text-zinc-50">
                        {c.thesis}
                      </p>
                      {c.narrative ? (
                        <p className="mt-2 text-sm leading-relaxed text-zinc-400">{c.narrative}</p>
                      ) : null}
                    </div>
                    <div className="shrink-0 text-right text-xs text-zinc-500">
                      <div className="tabular-nums text-zinc-400">
                        <span className="font-semibold text-zinc-300">{c.views_count ?? 0}</span> views
                      </div>
                      <div className="mt-1.5 tabular-nums">
                        <span className="block text-[10px] font-semibold uppercase tracking-wide text-zinc-600">
                          {c.published_at ? "Published" : "Posted"}
                        </span>
                        <time
                          className="text-zinc-400"
                          dateTime={displayTs}
                          title={new Date(displayTs).toLocaleString()}
                        >
                          {formatRelativeTime(displayTs)}
                        </time>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })
          )}
        </div>
      </section>

      <div className="mt-10 border-t border-zinc-800/60 pt-8">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm font-semibold text-[color:var(--accent)] transition hover:underline"
        >
          <span aria-hidden>←</span> Back to dashboard
        </Link>
      </div>

      {submitOpen ? (
        <div
          className={terminalUi.modalBackdropZ50}
          role="dialog"
          aria-modal="true"
          aria-label="Submit Trusted Pro call"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setSubmitOpen(false);
          }}
        >
          <div className={terminalUi.modalPanel2xlWide}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-zinc-100">Submit Trusted Pro call</h3>
                <p className="mt-1 text-xs text-zinc-500">
                  Contract address + thesis required. First 3 approvals per author go through staff review.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSubmitOpen(false)}
                className={terminalUi.modalCloseIconBtn}
                aria-label="Close"
                disabled={submitting}
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden>
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="mt-4 grid gap-3">
              <input
                type="text"
                value={contractAddress}
                onChange={(e) => setContractAddress(e.target.value)}
                placeholder="Contract address"
                disabled={submitting}
                className={terminalUi.formInput}
              />
              <textarea
                value={thesis}
                onChange={(e) => setThesis(e.target.value)}
                placeholder="Thesis (required)"
                disabled={submitting}
                className={`min-h-[120px] w-full resize-y ${terminalUi.formInput}`}
              />
              <textarea
                value={narrative}
                onChange={(e) => setNarrative(e.target.value)}
                placeholder="Narrative / details (optional)"
                disabled={submitting}
                className={`min-h-[120px] w-full resize-y ${terminalUi.formInput}`}
              />

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setSubmitOpen(false)}
                  disabled={submitting}
                  className={terminalUi.secondaryButtonSm}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={submit}
                  disabled={submitting || contractAddress.trim() === "" || thesis.trim().length < 24}
                  className="rounded-md bg-[color:var(--accent)] px-3 py-1.5 text-xs font-medium text-black shadow-lg shadow-black/40 transition hover:bg-green-500 disabled:opacity-60"
                >
                  {submitting ? "Submitting…" : "Submit"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {applyOpen ? (
        <div
          className={terminalUi.modalBackdropZ50}
          role="dialog"
          aria-modal="true"
          aria-label="Become a Trusted Pro"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setApplyOpen(false);
          }}
        >
          <div className={terminalUi.modalPanelLg2xl}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-zinc-100">Become a Trusted Pro</h3>
                <p className="mt-1 text-xs text-zinc-500">
                  If you’re eligible, you can submit an application for staff review.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setApplyOpen(false)}
                className={terminalUi.modalCloseIconBtn}
                aria-label="Close"
                disabled={applyBusy}
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden>
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="mt-4 grid gap-3">
              <textarea
                value={applyNote}
                onChange={(e) => setApplyNote(e.target.value)}
                placeholder="Optional note (what makes your calls unique, process, strengths)…"
                disabled={applyBusy}
                className={`min-h-[120px] w-full resize-y ${terminalUi.formInput}`}
              />
              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setApplyOpen(false)}
                  disabled={applyBusy}
                  className={terminalUi.secondaryButtonSm}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={apply}
                  disabled={applyBusy}
                  className="rounded-md bg-[color:var(--accent)] px-3 py-1.5 text-xs font-medium text-black shadow-lg shadow-black/40 transition hover:bg-green-500 disabled:opacity-60"
                >
                  {applyBusy ? "Submitting…" : "Apply"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

