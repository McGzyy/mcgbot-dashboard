"use client";

import { formatCalledSnapshotLine } from "@/lib/callDisplayFormat";
import { terminalChrome, terminalSurface } from "@/lib/terminalDesignTokens";
import { useTokenChartModal } from "@/app/contexts/TokenChartModalContext";
import { dexscreenerTokenUrl, formatRelativeTime } from "@/lib/modUiUtils";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useCallback, useEffect, useState } from "react";

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
  const { openTokenChart } = useTokenChartModal();
  const [window, setWindow] = useState<(typeof WINDOWS)[number]["id"]>("30d");
  const [rows, setRows] = useState<TapeRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const limit = 40;

  const load = useCallback(async () => {
    if (status !== "authenticated") return;
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(
        `/api/me/call-tape?window=${encodeURIComponent(window)}&limit=${limit}&offset=${offset}`,
        { credentials: "same-origin" }
      );
      const json = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        rows?: TapeRow[];
        total?: number;
        error?: string;
      };
      if (!res.ok || !json.success) {
        setErr(typeof json.error === "string" ? json.error : "Could not load call log.");
        setRows([]);
        return;
      }
      setRows(Array.isArray(json.rows) ? json.rows : []);
      setTotal(typeof json.total === "number" ? json.total : 0);
    } catch {
      setErr("Could not load call log.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [status, window, offset]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setOffset(0);
  }, [window]);

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
        <h1 className="text-xl font-semibold tracking-tight text-zinc-50">Call Log</h1>
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
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-white sm:text-4xl">Call Log</h1>
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

      <div className="mt-8 flex flex-wrap items-center justify-between gap-4" data-tutorial="calls.filters">
        <div className="flex flex-wrap gap-2">
          {WINDOWS.map((w) => (
            <button
              key={w.id}
              type="button"
              onClick={() => setWindow(w.id)}
              className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                window === w.id
                  ? "border-cyan-500/50 bg-cyan-500/10 text-cyan-100 shadow-[0_0_14px_-4px_rgba(34,211,238,0.35)]"
                  : "border-zinc-700/80 bg-zinc-950/50 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200"
              }`}
            >
              {w.label}
            </button>
          ))}
        </div>
        <p className="text-xs tabular-nums text-zinc-500">
          {loading ? "…" : `${total} call${total === 1 ? "" : "s"}`} in window
        </p>
      </div>

      {err ? (
        <div className="mt-6 rounded-xl border border-red-500/30 bg-red-950/20 px-4 py-3 text-sm text-red-200">{err}</div>
      ) : null}

      <div
        className={`mt-6 overflow-hidden rounded-2xl border border-zinc-800/80 bg-zinc-950/40 ${terminalSurface.insetEdge}`}
      >
        <div className="overflow-x-auto">
          <table className="min-w-[720px] w-full text-left text-sm">
            <thead
              className="border-b border-zinc-800/90 bg-black/30 text-[10px] font-semibold uppercase tracking-wider text-zinc-500"
              data-tutorial="calls.table"
            >
              <tr>
                <th className="px-4 py-3">When</th>
                <th className="px-4 py-3 min-w-[220px]">Call</th>
                <th className="px-4 py-3 text-right">Live ×</th>
                <th className="px-4 py-3 text-right">ATH ×</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Source</th>
                <th className="px-4 py-3 text-right">Links</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {loading && rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-zinc-500">
                    Loading…
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-zinc-500">
                    No calls in this window yet.
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
                  return (
                    <tr key={r.id || r.callCa + String(r.callTime)} className="hover:bg-zinc-900/40">
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-zinc-400">
                        {iso ? formatRelativeTime(iso) : "—"}
                      </td>
                      <td className="max-w-[min(360px,55vw)] px-4 py-3 text-xs text-zinc-200">
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
                          {r.callCa ? (
                            <a
                              href={dex ?? "#"}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-block text-[11px] font-medium text-cyan-400/90 hover:underline"
                              title="Open chart on Dexscreener"
                            >
                              Dex
                            </a>
                          ) : null}
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
                      <td className="px-4 py-3">
                        <span className="rounded-md border border-zinc-700/80 bg-zinc-900/60 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
                          {r.source || "user"}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right">
                        <div className="flex justify-end gap-2">
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
    </div>
  );
}
