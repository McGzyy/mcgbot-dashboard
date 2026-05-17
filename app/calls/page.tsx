"use client";

import { formatCalledSnapshotLine } from "@/lib/callDisplayFormat";
import { DashboardRefreshBar } from "@/app/components/dashboard/DashboardRefreshBar";
import { DashboardWidgetEmpty } from "@/app/components/dashboard/DashboardWidgetEmpty";
import { DeskCallQuotaChip } from "@/app/components/dashboard/DeskCallQuotaChip";
import { CallTapeTableSkeleton } from "@/app/components/dashboard/dashboardRouteSkeletons";
import { SubmitDeskCallModal } from "@/app/components/dashboard/SubmitDeskCallModal";
import { terminalChrome, terminalSurface } from "@/lib/terminalDesignTokens";
import { useTokenChartModal } from "@/app/contexts/TokenChartModalContext";
import { deskCallQuotaFromApi, type DeskCallQuotaUi } from "@/lib/deskCallQuotaDisplay";
import { dexscreenerTokenUrl, formatRelativeTime } from "@/lib/modUiUtils";
import { normalizeDexscreenerMint } from "@/lib/dexscreenerMintMeta";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

type TapeRow = {
  id: string;
  callCa: string;
  /** Current MC ÷ call MC (from `spot_multiple`, bot-synced). */
  liveMultiple: number;
  /** Peak ATH ÷ call MC. */
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
  { id: "7d", label: "7 days" },
  { id: "30d", label: "30 days" },
  { id: "all", label: "All time" },
] as const;

export default function CallTapePage() {
  const { status } = useSession();
  const searchParams = useSearchParams();
  const { openTokenChart } = useTokenChartModal();
  const highlightMint = useMemo(
    () => normalizeDexscreenerMint(searchParams.get("mint")),
    [searchParams]
  );
  const rowRefs = useRef<Record<string, HTMLTableRowElement | null>>({});
  const [tapeWindow, setTapeWindow] = useState<(typeof WINDOWS)[number]["id"]>("30d");
  const [rows, setRows] = useState<TapeRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [submitCallOpen, setSubmitCallOpen] = useState(false);
  const [deskCallQuota, setDeskCallQuota] = useState<DeskCallQuotaUi | null>(null);
  const [deskCallQuotaLoading, setDeskCallQuotaLoading] = useState(false);
  const limit = 40;

  const openSubmitCall = useCallback(() => {
    setSubmitCallOpen(true);
  }, []);

  const closeSubmitCall = useCallback(() => {
    setSubmitCallOpen(false);
  }, []);

  const load = useCallback(async () => {
    if (status !== "authenticated") return;
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(
        `/api/me/call-tape?window=${encodeURIComponent(tapeWindow)}&limit=${limit}&offset=${offset}`,
        { credentials: "same-origin" }
      );
      const json = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        rows?: TapeRow[];
        total?: number;
        error?: string;
      };
      if (!res.ok || !json.success) {
        setErr(typeof json.error === "string" ? json.error : "Could not load My Call Log.");
        setRows([]);
        return;
      }
      setRows(Array.isArray(json.rows) ? json.rows : []);
      setTotal(typeof json.total === "number" ? json.total : 0);
    } catch {
      setErr("Could not load My Call Log.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [status, tapeWindow, offset]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setOffset(0);
  }, [tapeWindow]);

  useEffect(() => {
    if (status !== "authenticated") {
      setDeskCallQuota(null);
      setDeskCallQuotaLoading(false);
      return;
    }
    let cancelled = false;
    setDeskCallQuotaLoading(true);
    void (async () => {
      try {
        const res = await fetch("/api/me/product-tier", { credentials: "same-origin", cache: "no-store" });
        const j = (await res.json().catch(() => ({}))) as { deskCallQuota?: Record<string, unknown> };
        if (cancelled || !res.ok) return;
        const q = deskCallQuotaFromApi(j.deskCallQuota);
        if (q) setDeskCallQuota(q);
      } catch {
        /* optional */
      } finally {
        if (!cancelled) setDeskCallQuotaLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [status]);

  useEffect(() => {
    if (status !== "authenticated" || typeof window === "undefined") return;
    const wantsSubmit =
      searchParams.get("submitCall") === "1" || searchParams.get("desk") === "submit";
    if (!wantsSubmit) return;
    openSubmitCall();
    const url = new URL(window.location.href);
    url.searchParams.delete("submitCall");
    url.searchParams.delete("desk");
    const qs = url.searchParams.toString();
    window.history.replaceState({}, "", `${url.pathname}${qs ? `?${qs}` : ""}`);
  }, [status, searchParams, openSubmitCall]);

  const highlightRow = useMemo(
    () => (highlightMint ? rows.find((r) => r.callCa === highlightMint) : undefined),
    [highlightMint, rows]
  );

  useLayoutEffect(() => {
    if (!highlightMint || loading) return;
    const key = highlightRow?.id || highlightRow?.callCa || highlightMint;
    const el = rowRefs.current[key];
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [highlightMint, highlightRow, loading]);

  if (status === "loading") {
    return (
      <div className="mx-auto max-w-6xl animate-pulse space-y-4 px-4 py-10">
        <div className="h-10 w-64 rounded-lg bg-zinc-800/60" />
        <div className="h-32 rounded-xl bg-zinc-900/40" />
      </div>
    );
  }

  if (status !== "authenticated") {
    return (
      <div className="mx-auto max-w-lg px-4 py-12">
        <h1 className="text-xl font-semibold tracking-tight text-zinc-50">My Call Log</h1>
        <p className="mt-3 text-sm leading-relaxed text-zinc-500">Sign in with Discord to see your verified calls.</p>
        <Link href="/" className="mt-6 inline-flex text-sm font-semibold text-[color:var(--accent)] hover:underline">
          ← Back to dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 pb-20 pt-4 sm:px-6">
      <header className={`${terminalChrome.headerRule} pb-8 pt-2`} data-tutorial="calls.header">
        <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-cyan-300/80">Your terminal</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-white sm:text-4xl">My Call Log</h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-zinc-400">
          <span className="font-medium text-zinc-200">Your calls only</span> — not the whole server, not other
          people’s history. Each row is one call credited to <span className="font-medium text-zinc-200">your</span>{" "}
          account (the <span className="font-medium text-zinc-300">Source</span> column just says how it was logged,
          e.g. you vs McGBot). Use <span className="font-medium text-zinc-300">Dex</span> or{" "}
          <span className="font-medium text-zinc-300">Chart</span> when you want to jump out. For charts and totals from the same data, open{" "}
          <Link href="/performance" className="font-medium text-cyan-300/90 underline-offset-2 hover:underline">
            Performance
          </Link>
          ; for everyone’s rankings, open{" "}
          <Link href="/leaderboard" className="font-medium text-cyan-300/90 underline-offset-2 hover:underline">
            Leaderboards
          </Link>
          .
        </p>
      </header>

      <div className="mt-8 flex flex-wrap items-center justify-between gap-3" data-tutorial="calls.filters">
        <div className="flex flex-wrap gap-2">
          {WINDOWS.map((w) => (
            <button
              key={w.id}
              type="button"
              onClick={() => setTapeWindow(w.id)}
              className={`rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition ${
                tapeWindow === w.id
                  ? "border-cyan-500/50 bg-cyan-500/10 text-cyan-100 shadow-[0_0_14px_-4px_rgba(34,211,238,0.35)]"
                  : "border-zinc-700/80 bg-zinc-950/50 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200"
              }`}
            >
              {w.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <DeskCallQuotaChip
            quota={deskCallQuota}
            loading={deskCallQuotaLoading}
            onSubmitCall={() => openSubmitCall()}
          />
          <button
            type="button"
            onClick={() => openSubmitCall()}
            className="rounded-lg bg-[color:var(--accent)] px-3 py-1.5 text-xs font-semibold text-black shadow-md shadow-black/30 transition hover:bg-green-500"
          >
            Submit call
          </button>
          <p className="text-xs tabular-nums text-zinc-500">
            {loading ? "…" : total.toLocaleString("en-US")} in window
          </p>
        </div>
      </div>

      {highlightMint && !loading && !highlightRow ? (
        <div className="mt-6 rounded-xl border border-[color:var(--accent)]/30 bg-[color:var(--accent)]/[0.06] px-4 py-3 text-sm text-zinc-200">
          Your latest call may still be syncing, or it falls outside this time window. Try{" "}
          <button
            type="button"
            onClick={() =>
              openTokenChart({
                chain: "solana",
                contractAddress: highlightMint,
              })
            }
            className="font-semibold text-[color:var(--accent)] underline-offset-2 hover:underline"
          >
            opening the chart
          </button>{" "}
          for <span className="font-mono text-zinc-400">{highlightMint.slice(0, 8)}…</span>.
        </div>
      ) : null}

      {err ? (
        <div className="mt-6 rounded-xl border border-red-500/30 bg-red-950/20 px-4 py-3 text-sm text-red-200">{err}</div>
      ) : null}

      <div className={`relative mt-6 overflow-hidden rounded-2xl border border-zinc-800/80 bg-zinc-950/40 ${terminalSurface.insetEdge}`}>
        <DashboardRefreshBar active={loading && rows.length > 0} />
        <div className="overflow-x-auto">
          <table className="min-w-[720px] w-full text-left text-sm">
            <thead
              className="border-b border-zinc-800/90 bg-black/30 text-[10px] font-semibold uppercase tracking-wider text-zinc-500"
              data-tutorial="calls.table"
            >
              <tr>
                <th className="px-4 py-2.5">When</th>
                <th className="px-4 py-2.5 min-w-[220px]">Call</th>
                <th className="px-4 py-2.5 text-right">Live ×</th>
                <th className="px-4 py-2.5 text-right">ATH ×</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5">Source</th>
                <th className="px-4 py-2.5 text-right">Links</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {loading && rows.length === 0 ? (
                <CallTapeTableSkeleton />
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-0">
                    <DashboardWidgetEmpty
                      badge="Call log"
                      title={tapeWindow === "all" ? "No calls logged yet" : "No calls in this window"}
                      description={
                        tapeWindow === "all"
                          ? "Submit a verified desk call from the terminal — it lands here, on the live feed, and in Performance Lab."
                          : `Nothing credited to you in the last ${tapeWindow === "7d" ? "7 days" : "30 days"}. Try All time or log a new call.`
                      }
                      actionLabel="Submit call"
                      onAction={() => openSubmitCall()}
                      secondaryActionLabel="Performance Lab"
                      secondaryActionHref="/performance"
                    />
                    {tapeWindow !== "all" ? (
                      <div className="-mt-8 flex justify-center pb-8">
                        <button
                          type="button"
                          onClick={() => setTapeWindow("all")}
                          className="text-xs font-semibold text-cyan-300/90 underline-offset-2 hover:underline"
                        >
                          Show all time
                        </button>
                      </div>
                    ) : null}
                  </td>
                </tr>
              ) : (
                rows.map((r) => {
                  const iso =
                    typeof r.callTime === "string"
                      ? r.callTime
                      : typeof r.callTime === "number"
                        ? new Date(r.callTime).toISOString()
                        : null;
                  const dex = r.callCa ? dexscreenerTokenUrl("solana", r.callCa) : null;
                  const rowKey = r.id || r.callCa + String(r.callTime);
                  const isHighlighted = highlightMint != null && r.callCa === highlightMint;
                  return (
                    <tr
                      key={rowKey}
                      ref={(el) => {
                        rowRefs.current[rowKey] = el;
                      }}
                      className={
                        isHighlighted
                          ? "bg-[color:var(--accent)]/[0.08] ring-1 ring-inset ring-[color:var(--accent)]/40"
                          : "hover:bg-zinc-900/35"
                      }
                    >
                      <td className="whitespace-nowrap px-4 py-2.5 text-xs text-zinc-400">
                        {iso ? formatRelativeTime(iso) : "—"}
                      </td>
                      <td className="max-w-[min(420px,55vw)] px-4 py-2.5 text-xs text-zinc-200">
                        <div className="flex min-w-0 gap-2">
                          {r.tokenImageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={r.tokenImageUrl}
                              alt=""
                              className="mt-0.5 h-8 w-8 shrink-0 rounded-lg border border-zinc-700/50 object-cover shadow-sm shadow-black/40 ring-1 ring-white/[0.03]"
                              loading="lazy"
                              referrerPolicy="no-referrer"
                            />
                          ) : null}
                          <div className="min-w-0 flex-1">
                          <div className="font-medium leading-snug text-zinc-100">
                            {formatCalledSnapshotLine({
                              tokenName: r.tokenName,
                              tokenTicker: r.tokenTicker,
                              callMarketCapUsd: r.callMarketCapUsd ?? null,
                              callCa: r.callCa,
                            })}
                          </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-right font-semibold tabular-nums text-emerald-300">
                        {Number.isFinite(r.liveMultiple) ? `${r.liveMultiple.toFixed(2)}×` : "—"}
                      </td>
                      <td className="px-4 py-2.5 text-right font-medium tabular-nums text-zinc-400">
                        {Number.isFinite(r.athMultiple) && r.athMultiple > 0
                          ? `${r.athMultiple.toFixed(2)}×`
                          : "—"}
                      </td>
                      <td className="px-4 py-2.5">
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
                      <td className="px-4 py-2.5">
                        <span className="rounded-md border border-zinc-700/80 bg-zinc-900/60 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
                          {r.source || "user"}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-right">
                        <div className="flex flex-wrap justify-end gap-1.5">
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
                              className="rounded-md border border-emerald-500/25 bg-emerald-500/10 px-2 py-1 text-[11px] font-semibold text-emerald-100/90 transition hover:border-emerald-400/40 hover:bg-emerald-500/15"
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
                              className="rounded-md border border-cyan-500/20 bg-cyan-500/10 px-2 py-1 text-[11px] font-semibold text-cyan-100/90 transition hover:border-cyan-400/35 hover:bg-cyan-500/15"
                            >
                              Dex
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

      {total > limit ? (
        <div className="mt-4 flex justify-center gap-2">
          <button
            type="button"
            disabled={offset === 0 || loading}
            onClick={() => setOffset((o) => Math.max(0, o - limit))}
            className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs font-semibold text-zinc-300 transition hover:bg-zinc-900 disabled:opacity-40"
          >
            Previous
          </button>
          <button
            type="button"
            disabled={offset + limit >= total || loading}
            onClick={() => setOffset((o) => o + limit)}
            className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs font-semibold text-zinc-300 transition hover:bg-zinc-900 disabled:opacity-40"
          >
            Next
          </button>
        </div>
      ) : null}

      <SubmitDeskCallModal
        open={submitCallOpen}
        onClose={closeSubmitCall}
        quota={deskCallQuota}
        onQuotaChange={setDeskCallQuota}
        onSubmitted={() => {
          void load();
        }}
      />
    </div>
  );
}
