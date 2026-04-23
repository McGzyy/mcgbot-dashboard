"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNotifications } from "@/app/contexts/NotificationsContext";

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
      <div className="mx-auto max-w-6xl animate-pulse space-y-4 px-4 py-10">
        <div className="h-10 w-72 rounded-lg bg-zinc-800/60" />
        <div className="h-32 rounded-xl bg-zinc-900/40" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 pb-20 pt-4 sm:px-6">
      <header className="border-b border-white/[0.06] pb-8 pt-2" data-tutorial="trustedPro.header">
        <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-fuchsia-300/80">
          Arena
        </p>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Trusted Pro calls
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-zinc-400">
              Longform, thesis-driven posts from Trusted Pro members. Everyone can read; only Trusted Pro can submit.
            </p>
          </div>
          {canSubmit ? (
            <button
              type="button"
              onClick={() => setSubmitOpen(true)}
              className="rounded-xl bg-[color:var(--accent)] px-4 py-2.5 text-sm font-semibold text-black shadow-lg shadow-black/40 transition hover:bg-green-500"
            >
              Submit Trusted Pro call
            </button>
          ) : null}
        </div>
      </header>

      {canSubmit && me ? (
        <div className="mt-6 rounded-2xl border border-white/[0.06] bg-black/20 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-zinc-100">Your Trusted Pro stats</p>
              <p className="mt-1 text-xs text-zinc-500">
                {statLine}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-400">
              <span className="rounded-lg border border-zinc-800/70 bg-zinc-950/35 px-2.5 py-1">
                Total <span className="font-semibold tabular-nums text-zinc-100">{me.totals.submitted}</span>
              </span>
              <span className="rounded-lg border border-emerald-500/25 bg-emerald-950/20 px-2.5 py-1">
                Approved{" "}
                <span className="font-semibold tabular-nums text-emerald-100">{me.totals.approved}</span>
              </span>
              <span className="rounded-lg border border-red-500/25 bg-red-950/15 px-2.5 py-1">
                Denied <span className="font-semibold tabular-nums text-red-100">{me.totals.denied}</span>
              </span>
              <span className="rounded-lg border border-zinc-800/70 bg-zinc-950/35 px-2.5 py-1">
                Views <span className="font-semibold tabular-nums text-zinc-100">{me.viewsTotal}</span>
              </span>
            </div>
          </div>
        </div>
      ) : null}

      {!canSubmit ? (
        <div className="mt-6 rounded-2xl border border-white/[0.06] bg-black/20 p-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-zinc-100">Trusted Pro intel</p>
              <p className="mt-1 text-xs text-zinc-500">
                Aggregates across approved Trusted Pro calls.
              </p>
            </div>
            {canApply ? (
              <button
                type="button"
                onClick={() => setApplyOpen(true)}
                className="rounded-xl border border-emerald-500/25 bg-emerald-950/20 px-4 py-2 text-xs font-semibold text-emerald-100/90 transition hover:border-emerald-400/35"
              >
                Become a Trusted Pro
              </button>
            ) : null}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-zinc-400">
            <span className="rounded-lg border border-zinc-800/70 bg-zinc-950/35 px-2.5 py-1">
              Trusted Pros{" "}
              <span className="font-semibold tabular-nums text-zinc-100">
                {publicStats?.trustedPros ?? "—"}
              </span>
            </span>
            <span className="rounded-lg border border-zinc-800/70 bg-zinc-950/35 px-2.5 py-1">
              Total calls{" "}
              <span className="font-semibold tabular-nums text-zinc-100">
                {publicStats?.totalCalls ?? "—"}
              </span>
            </span>
            <span className="rounded-lg border border-zinc-800/70 bg-zinc-950/35 px-2.5 py-1">
              Avg call MC{" "}
              <span className="font-semibold tabular-nums text-zinc-100">
                {publicSummary?.mc ?? "—"}
              </span>
            </span>
            <span className="rounded-lg border border-zinc-800/70 bg-zinc-950/35 px-2.5 py-1">
              Avg ATH{" "}
              <span className="font-semibold tabular-nums text-zinc-100">
                {publicSummary?.avgAth ?? "—"}
              </span>
            </span>
            <span className="rounded-lg border border-zinc-800/70 bg-zinc-950/35 px-2.5 py-1">
              Avg time to ATH{" "}
              <span className="font-semibold tabular-nums text-zinc-100">
                {publicSummary?.avgT ?? "—"}
              </span>
            </span>
            <span className="rounded-lg border border-zinc-800/70 bg-zinc-950/35 px-2.5 py-1">
              Best call (ATH){" "}
              <span className="font-semibold tabular-nums text-zinc-100">
                {publicSummary?.bestAth ?? "—"}
              </span>
            </span>
          </div>
        </div>
      ) : null}

      {err ? (
        <div className="mt-6 rounded-xl border border-red-500/30 bg-red-950/20 px-4 py-3 text-sm text-red-200">
          {err}
        </div>
      ) : null}

      <div className="mt-8 space-y-3" data-tutorial="trustedPro.feed">
        {loading ? (
          <div className="rounded-xl border border-zinc-800 bg-black/20 px-4 py-10 text-center text-sm text-zinc-500">
            Loading…
          </div>
        ) : calls.length === 0 ? (
          <div className="rounded-xl border border-zinc-800 bg-black/20 px-4 py-10 text-center text-sm text-zinc-500">
            No Trusted Pro calls yet.
          </div>
        ) : (
          calls.map((c) => (
            <article key={c.id} className="rounded-2xl border border-white/[0.06] bg-black/20 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs text-zinc-500">
                    CA <span className="font-mono text-zinc-300">{shortAddr(c.contract_address)}</span>{" "}
                    <span className="text-zinc-700">·</span>{" "}
                    <span className="font-mono">{c.author_discord_id}</span>
                  </p>
                  <p className="mt-2 text-sm font-semibold text-zinc-100">{c.thesis}</p>
                  {c.narrative ? (
                    <p className="mt-2 text-sm leading-relaxed text-zinc-300">{c.narrative}</p>
                  ) : null}
                </div>
                <div className="shrink-0 text-right text-xs text-zinc-500">
                  <div className="tabular-nums">{c.views_count ?? 0} views</div>
                  <div className="mt-1 tabular-nums" title={c.published_at ?? c.created_at}>
                    {c.published_at ? "Published" : "Posted"}{" "}
                    <span className="text-zinc-300">{new Date(c.published_at ?? c.created_at).toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </article>
          ))
        )}
      </div>

      <Link
        href="/"
        className="mt-10 inline-flex text-sm font-semibold text-[color:var(--accent)] hover:underline"
      >
        ← Back to dashboard
      </Link>

      {submitOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-6"
          role="dialog"
          aria-modal="true"
          aria-label="Submit Trusted Pro call"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setSubmitOpen(false);
          }}
        >
          <div className="w-full max-w-2xl rounded-2xl border border-[#1a1a1a] bg-[#0a0a0a] p-4 shadow-xl shadow-black/50 backdrop-blur">
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
                className="rounded-md border border-[#1a1a1a] bg-[#0a0a0a] px-2 py-1 text-xs text-zinc-300 hover:bg-[#0a0a0a]"
                aria-label="Close"
                disabled={submitting}
              >
                Esc
              </button>
            </div>

            <div className="mt-4 grid gap-3">
              <input
                type="text"
                value={contractAddress}
                onChange={(e) => setContractAddress(e.target.value)}
                placeholder="Contract address"
                disabled={submitting}
                className="w-full rounded-lg border border-[#1a1a1a] bg-[#050505] px-3 py-2 text-sm text-zinc-200 outline-none ring-[color:var(--accent)]/20 focus:ring-2 disabled:opacity-60"
              />
              <textarea
                value={thesis}
                onChange={(e) => setThesis(e.target.value)}
                placeholder="Thesis (required)"
                disabled={submitting}
                className="min-h-[120px] w-full resize-y rounded-lg border border-[#1a1a1a] bg-[#050505] px-3 py-2 text-sm text-zinc-200 outline-none ring-[color:var(--accent)]/20 focus:ring-2 disabled:opacity-60"
              />
              <textarea
                value={narrative}
                onChange={(e) => setNarrative(e.target.value)}
                placeholder="Narrative / details (optional)"
                disabled={submitting}
                className="min-h-[120px] w-full resize-y rounded-lg border border-[#1a1a1a] bg-[#050505] px-3 py-2 text-sm text-zinc-200 outline-none ring-[color:var(--accent)]/20 focus:ring-2 disabled:opacity-60"
              />

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setSubmitOpen(false)}
                  disabled={submitting}
                  className="rounded-md border border-[#1a1a1a] bg-[#0a0a0a] px-3 py-1.5 text-xs font-medium text-zinc-300 hover:bg-[#0a0a0a] disabled:opacity-60"
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
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-6"
          role="dialog"
          aria-modal="true"
          aria-label="Become a Trusted Pro"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setApplyOpen(false);
          }}
        >
          <div className="w-full max-w-lg rounded-2xl border border-[#1a1a1a] bg-[#0a0a0a] p-4 shadow-xl shadow-black/50 backdrop-blur">
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
                className="rounded-md border border-[#1a1a1a] bg-[#0a0a0a] px-2 py-1 text-xs text-zinc-300 hover:bg-[#0a0a0a]"
                aria-label="Close"
                disabled={applyBusy}
              >
                Esc
              </button>
            </div>

            <div className="mt-4 grid gap-3">
              <textarea
                value={applyNote}
                onChange={(e) => setApplyNote(e.target.value)}
                placeholder="Optional note (what makes your calls unique, process, strengths)…"
                disabled={applyBusy}
                className="min-h-[120px] w-full resize-y rounded-lg border border-[#1a1a1a] bg-[#050505] px-3 py-2 text-sm text-zinc-200 outline-none ring-[color:var(--accent)]/20 focus:ring-2 disabled:opacity-60"
              />
              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setApplyOpen(false)}
                  disabled={applyBusy}
                  className="rounded-md border border-[#1a1a1a] bg-[#0a0a0a] px-3 py-1.5 text-xs font-medium text-zinc-300 hover:bg-[#0a0a0a] disabled:opacity-60"
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

