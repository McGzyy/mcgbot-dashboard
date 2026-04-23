"use client";

import { useTokenChartModal } from "@/app/contexts/TokenChartModalContext";
import { formatCalledSnapshotLine } from "@/lib/callDisplayFormat";
import { dexscreenerTokenUrl, formatRelativeTime } from "@/lib/modUiUtils";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNotifications } from "@/app/contexts/NotificationsContext";

type TapeRow = {
  id: string;
  callCa: string;
  liveMultiple: number;
  athMultiple: number;
  liveMarketCapUsd?: number | null;
  callTime: unknown;
  source: string;
  messageUrl: string | null;
  username: string;
  excludedFromStats?: boolean;
  tokenName?: string | null;
  tokenTicker?: string | null;
  callMarketCapUsd?: number | null;
  tokenImageUrl?: string | null;
};

const WINDOWS = [
  { id: "24h", label: "Live (24h)" },
  { id: "7d", label: "7 days" },
  { id: "all", label: "All time" },
] as const;

function callTimeIso(callTime: unknown): string | null {
  if (typeof callTime === "string" && callTime.trim()) return callTime;
  if (typeof callTime === "number" && Number.isFinite(callTime)) {
    try {
      return new Date(callTime).toISOString();
    } catch {
      return null;
    }
  }
  return null;
}

export default function BotCallsPage() {
  const { status } = useSession();
  const { addNotification } = useNotifications();
  const { openTokenChart } = useTokenChartModal();
  const [timeWindow, setTimeWindow] = useState<(typeof WINDOWS)[number]["id"]>("24h");
  const [minMultiple, setMinMultiple] = useState<number>(0);
  const [showExcluded, setShowExcluded] = useState(false);
  const [rows, setRows] = useState<TapeRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const limit = 40;

  const latestSeenMsRef = useRef<number>(0);
  const [flashKeys, setFlashKeys] = useState<Set<string>>(new Set());
  const [reportOpen, setReportOpen] = useState(false);
  const [reportCall, setReportCall] = useState<TapeRow | null>(null);
  const [reportReason, setReportReason] = useState("scam");
  const [reportDetails, setReportDetails] = useState("");
  const [reportEvidence, setReportEvidence] = useState("");
  const [reportSubmitting, setReportSubmitting] = useState(false);

  const submitCallReport = useCallback(async () => {
    if (!reportCall?.id) return;
    if (reportSubmitting) return;
    const reason = reportReason.trim();
    if (!reason) return;
    setReportSubmitting(true);
    try {
      const evidenceUrls = reportEvidence
        .split(/\r?\n/)
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 8);
      const res = await fetch("/api/report/call", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          callId: reportCall.id,
          reason,
          details: reportDetails.trim() || null,
          evidenceUrls,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json || json.success !== true) {
        addNotification({
          id: crypto.randomUUID(),
          text:
            typeof (json as any).error === "string"
              ? (json as any).error
              : "Failed to submit report.",
          type: "call",
          createdAt: Date.now(),
          priority: "low",
        });
        return;
      }
      addNotification({
        id: crypto.randomUUID(),
        text: "Report submitted. Thank you.",
        type: "call",
        createdAt: Date.now(),
        priority: "medium",
      });
      setReportOpen(false);
      setReportCall(null);
      setReportDetails("");
      setReportEvidence("");
    } catch {
      addNotification({
        id: crypto.randomUUID(),
        text: "Failed to submit report.",
        type: "call",
        createdAt: Date.now(),
        priority: "low",
      });
    } finally {
      setReportSubmitting(false);
    }
  }, [addNotification, reportCall, reportDetails, reportEvidence, reportReason, reportSubmitting]);

  const query = useMemo(() => {
    const q = new URLSearchParams();
    q.set("window", timeWindow);
    q.set("limit", String(limit));
    q.set("offset", String(offset));
    if (minMultiple > 0) q.set("minMultiple", String(minMultiple));
    if (showExcluded) q.set("includeExcluded", "1");
    return q.toString();
  }, [limit, minMultiple, offset, showExcluded, timeWindow]);

  const load = useCallback(async () => {
    if (status !== "authenticated") return;
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(`/api/bot/call-tape?${query}`, {
        credentials: "same-origin",
      });
      const json = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        rows?: TapeRow[];
        total?: number;
        error?: string;
        code?: string;
      };
      if (!res.ok || !json.success) {
        setRows([]);
        setTotal(0);
        setErr(
          typeof json.error === "string"
            ? json.error
            : res.status === 403
              ? "Bot calls are a Pro/Elite feature."
              : `Request failed (${res.status}).`
        );
        return;
      }

      const nextRows = Array.isArray(json.rows) ? json.rows : [];
      setRows(nextRows);
      setTotal(typeof json.total === "number" ? json.total : nextRows.length);

      if (timeWindow === "24h" && offset === 0) {
        // Flash items that arrived since last successful fetch (best-effort).
        let newestMs = latestSeenMsRef.current;
        const nextFlash = new Set<string>();
        for (const r of nextRows) {
          const iso = callTimeIso(r.callTime);
          const t = iso ? Date.parse(iso) : typeof r.callTime === "number" ? r.callTime : 0;
          if (Number.isFinite(t) && t > newestMs) {
            newestMs = t;
            nextFlash.add(String(r.id || r.callCa + iso));
          }
        }
        if (newestMs > latestSeenMsRef.current) {
          latestSeenMsRef.current = newestMs;
          if (nextFlash.size > 0) {
            setFlashKeys(nextFlash);
            window.setTimeout(() => setFlashKeys(new Set()), 1800);
          }
        }
      }
    } catch {
      setErr("Could not load bot calls.");
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [offset, query, status, timeWindow]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setOffset(0);
  }, [timeWindow, minMultiple, showExcluded]);

  useEffect(() => {
    if (status !== "authenticated") return;
    if (timeWindow !== "24h") return;
    const id = window.setInterval(() => {
      void load();
    }, 10_000);
    return () => window.clearInterval(id);
  }, [load, status, timeWindow]);

  if (status === "loading") {
    return (
      <div className="mx-auto max-w-6xl animate-pulse space-y-4 px-4 py-10">
        <div className="h-10 w-72 rounded-lg bg-zinc-800/60" />
        <div className="h-32 rounded-xl bg-zinc-900/40" />
      </div>
    );
  }

  if (status !== "authenticated") {
    return (
      <div className="mx-auto max-w-lg px-4 py-12">
        <h1 className="text-xl font-semibold tracking-tight text-zinc-50">Bot calls</h1>
        <p className="mt-3 text-sm leading-relaxed text-zinc-500">
          Sign in with Discord to view the live bot call feed.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex text-sm font-semibold text-[color:var(--accent)] hover:underline"
        >
          ← Back to dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 pb-20 pt-4 sm:px-6">
      <header className="border-b border-white/[0.06] pb-8 pt-2" data-tutorial="botCalls.header">
        <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-fuchsia-300/85">
          Scanner feed
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-white sm:text-4xl">
          Bot calls
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-zinc-400">
          Live feed of calls made by <span className="font-medium text-zinc-200">McGBot</span>. By default, excluded
          calls are hidden (they don’t count toward stats).
        </p>
      </header>

      <div className="mt-8 flex flex-wrap items-center justify-between gap-4" data-tutorial="botCalls.filters">
        <div className="flex flex-wrap items-center gap-2">
          {WINDOWS.map((w) => (
            <button
              key={w.id}
              type="button"
              onClick={() => setTimeWindow(w.id)}
              className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                timeWindow === w.id
                  ? "border-fuchsia-500/45 bg-fuchsia-500/10 text-fuchsia-100 shadow-[0_0_14px_-4px_rgba(217,70,239,0.25)]"
                  : "border-zinc-700/80 bg-zinc-950/50 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200"
              }`}
            >
              {w.label}
            </button>
          ))}
          <div className="ml-1 flex items-center gap-2 rounded-lg border border-zinc-800/80 bg-zinc-950/40 px-3 py-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
              Min ×
            </span>
            <input
              type="number"
              inputMode="decimal"
              min={0}
              step={0.5}
              value={minMultiple}
              onChange={(e) => setMinMultiple(Number(e.target.value) || 0)}
              className="w-16 bg-transparent text-xs font-semibold tabular-nums text-zinc-200 outline-none"
              aria-label="Minimum multiple filter"
            />
          </div>
          <button
            type="button"
            onClick={() => setShowExcluded((v) => !v)}
            className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
              showExcluded
                ? "border-rose-500/40 bg-rose-500/10 text-rose-200"
                : "border-zinc-700/80 bg-zinc-950/50 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200"
            }`}
            aria-pressed={showExcluded}
            title="Show calls excluded from stats"
          >
            {showExcluded ? "Showing excluded" : "Hide excluded"}
          </button>
        </div>
        <p className="text-xs tabular-nums text-zinc-500">
          {loading ? "…" : `${total} call${total === 1 ? "" : "s"}`} in window
        </p>
      </div>

      {err ? (
        <div className="mt-6 rounded-xl border border-red-500/30 bg-red-950/20 px-4 py-3 text-sm text-red-200">
          {err}
        </div>
      ) : null}

      <div
        className="mt-6 overflow-hidden rounded-2xl border border-zinc-800/80 bg-zinc-950/40 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)]"
        data-tutorial="botCalls.table"
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-b border-zinc-800/90 bg-black/30 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
              <tr>
                <th className="px-4 py-3">When</th>
                <th className="px-4 py-3 min-w-[240px]">Call</th>
                <th className="px-4 py-3 text-right">Live ×</th>
                <th className="px-4 py-3 text-right">ATH ×</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Links</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {loading && rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-zinc-500">
                    Loading…
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-zinc-500">
                    No bot calls in this window yet.
                  </td>
                </tr>
              ) : (
                rows.map((r) => {
                  const iso = callTimeIso(r.callTime);
                  const dex = r.callCa ? dexscreenerTokenUrl("solana", r.callCa) : null;
                  const k = String(r.id || r.callCa + String(r.callTime));
                  const flash = flashKeys.has(k);
                  return (
                    <tr
                      key={k}
                      className={`hover:bg-zinc-900/40 ${
                        flash
                          ? "bg-fuchsia-500/10 shadow-[inset_0_0_0_1px_rgba(217,70,239,0.35)]"
                          : ""
                      }`}
                    >
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-zinc-400">
                        {iso ? formatRelativeTime(iso) : "—"}
                      </td>
                      <td className="max-w-[min(420px,55vw)] px-4 py-3 text-xs text-zinc-200">
                        <div className="flex min-w-0 gap-2">
                          {r.tokenImageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={r.tokenImageUrl}
                              alt=""
                              className="mt-0.5 h-8 w-8 shrink-0 rounded-md border border-zinc-700/50 object-cover"
                              loading="lazy"
                              referrerPolicy="no-referrer"
                            />
                          ) : null}
                          <div className="min-w-0 flex-1 space-y-0.5">
                            <div className="font-medium leading-snug text-zinc-100">
                              {formatCalledSnapshotLine({
                                tokenName: r.tokenName,
                                tokenTicker: r.tokenTicker,
                                callMarketCapUsd: r.callMarketCapUsd ?? null,
                                callCa: r.callCa,
                              })}
                            </div>
                            <div className="flex flex-wrap items-center gap-2 text-[11px] text-zinc-500">
                              <span className="rounded-md border border-fuchsia-500/20 bg-fuchsia-500/10 px-2 py-0.5 font-semibold uppercase tracking-wide text-fuchsia-100/85">
                                Bot
                              </span>
                              {r.excludedFromStats ? (
                                <span className="rounded-md border border-red-500/30 bg-red-500/10 px-2 py-0.5 font-semibold uppercase tracking-wide text-red-200">
                                  Excluded
                                </span>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold tabular-nums text-emerald-300">
                        {Number.isFinite(r.liveMultiple) ? `${r.liveMultiple.toFixed(2)}×` : "—"}
                      </td>
                      <td className="px-4 py-3 text-right font-medium tabular-nums text-zinc-400">
                        {Number.isFinite(r.athMultiple) && r.athMultiple > 0
                          ? `${r.athMultiple.toFixed(2)}×`
                          : "—"}
                      </td>
                      <td className="px-4 py-3">
                        {r.excludedFromStats ? (
                          <span className="rounded-md border border-red-500/30 bg-red-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-200">
                            Excluded
                          </span>
                        ) : (
                          <span className="rounded-md border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-200/90">
                            Counted
                          </span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setReportCall(r);
                              setReportReason("scam");
                              setReportDetails("");
                              setReportEvidence("");
                              setReportOpen(true);
                            }}
                            className="text-xs font-semibold text-rose-300/90 hover:text-rose-200"
                            title="Report this call"
                          >
                            Report
                          </button>
                          {r.callCa ? (
                            <button
                              type="button"
                              onClick={() =>
                                openTokenChart({
                                  chain: "solana",
                                  contractAddress: r.callCa,
                                  tokenTicker: r.tokenTicker,
                                  tokenName: r.tokenName,
                                  tokenImageUrl: r.tokenImageUrl ?? null,
                                })
                              }
                              className="text-xs font-semibold text-emerald-300/95 hover:text-emerald-200"
                              title="Live chart (TradingView)"
                            >
                              Chart
                            </button>
                          ) : null}
                          {dex ? (
                            <a
                              href={dex}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs font-semibold text-cyan-400/90 hover:text-cyan-300"
                            >
                              Dex
                            </a>
                          ) : null}
                          {r.messageUrl ? (
                            <a
                              href={r.messageUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs font-semibold text-zinc-400 hover:text-zinc-200"
                            >
                              Post
                            </a>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-zinc-500">
          {timeWindow === "24h" ? "Auto-refreshing every 10s." : "Tip: switch to Live for auto-refresh."}
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setOffset((o) => Math.max(0, o - limit))}
            disabled={offset === 0 || loading}
            className="rounded-lg border border-zinc-700/80 bg-zinc-950/50 px-3 py-1.5 text-xs font-semibold text-zinc-300 transition hover:border-zinc-600 hover:text-zinc-100 disabled:opacity-50"
          >
            ← Newer
          </button>
          <button
            type="button"
            onClick={() => setOffset((o) => o + limit)}
            disabled={loading || rows.length < limit}
            className="rounded-lg border border-zinc-700/80 bg-zinc-950/50 px-3 py-1.5 text-xs font-semibold text-zinc-300 transition hover:border-zinc-600 hover:text-zinc-100 disabled:opacity-50"
          >
            Older →
          </button>
        </div>
      </div>

      {reportOpen ? (
        <div
          className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-black/60 px-4 py-10"
          role="dialog"
          aria-modal="true"
          aria-label="Report bot call"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setReportOpen(false);
          }}
        >
          <div className="mt-10 w-full max-w-xl rounded-xl border border-zinc-800/80 bg-zinc-950/90 p-4 shadow-xl shadow-black/50 backdrop-blur">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-zinc-100">Report bot call</h3>
                <p className="mt-1 text-xs text-zinc-500">
                  Flag a call as scam/rug/bundle. Moderators will review and may exclude it from stats.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setReportOpen(false)}
                className="rounded-md border border-zinc-800 bg-zinc-900/60 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-900"
                aria-label="Close"
              >
                Esc
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <div className="rounded-lg border border-zinc-800 bg-black/30 px-3 py-2 text-xs text-zinc-300">
                <span className="font-semibold text-zinc-100">Call:</span>{" "}
                {reportCall
                  ? formatCalledSnapshotLine({
                      tokenName: reportCall.tokenName,
                      tokenTicker: reportCall.tokenTicker,
                      callMarketCapUsd: reportCall.callMarketCapUsd ?? null,
                      callCa: reportCall.callCa,
                    })
                  : "—"}
              </div>

              <div>
                <label className="text-xs font-medium text-zinc-400">Reason</label>
                <select
                  value={reportReason}
                  onChange={(e) => setReportReason(e.target.value)}
                  disabled={reportSubmitting}
                  className="mt-1 w-full rounded-lg border border-zinc-800 bg-black/30 px-3 py-2 text-sm text-zinc-100 outline-none ring-rose-500/20 focus:ring-2 disabled:opacity-60"
                >
                  <option value="scam">Scam / rug</option>
                  <option value="bundle">Bundle / botted</option>
                  <option value="malicious">Malicious / honeypot behavior</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-zinc-400">Details (optional)</label>
                <textarea
                  value={reportDetails}
                  onChange={(e) => setReportDetails(e.target.value)}
                  rows={4}
                  disabled={reportSubmitting}
                  className="mt-1 w-full resize-none rounded-lg border border-zinc-800 bg-black/30 px-3 py-2 text-sm text-zinc-100 outline-none ring-rose-500/20 focus:ring-2 disabled:opacity-60"
                  placeholder="What’s the evidence? Any links/timestamps?"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-zinc-400">
                  Evidence URLs (optional, one per line)
                </label>
                <textarea
                  value={reportEvidence}
                  onChange={(e) => setReportEvidence(e.target.value)}
                  rows={3}
                  disabled={reportSubmitting}
                  className="mt-1 w-full resize-none rounded-lg border border-zinc-800 bg-black/30 px-3 py-2 font-mono text-[12px] text-zinc-100 outline-none ring-rose-500/20 focus:ring-2 disabled:opacity-60"
                  placeholder={"https://dexscreener.com/...\nhttps://discord.com/channels/..."}
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setReportOpen(false)}
                  disabled={reportSubmitting}
                  className="rounded-md border border-zinc-800 bg-zinc-900/60 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-900 disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void submitCallReport()}
                  disabled={reportSubmitting}
                  className="rounded-md bg-gradient-to-r from-rose-500 to-fuchsia-500 px-3 py-1.5 text-xs font-semibold text-white shadow-lg shadow-black/30 transition hover:from-rose-400 hover:to-fuchsia-400 disabled:opacity-60"
                >
                  {reportSubmitting ? "Submitting…" : "Submit report"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

