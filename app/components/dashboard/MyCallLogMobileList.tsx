"use client";

import { DashboardWidgetEmpty } from "@/app/components/dashboard/DashboardWidgetEmpty";
import { CallTapeTableSkeleton } from "@/app/components/dashboard/dashboardRouteSkeletons";
import { formatCalledSnapshotLine } from "@/lib/callDisplayFormat";
import { dexscreenerTokenUrl, formatRelativeTime } from "@/lib/modUiUtils";
import Link from "next/link";
import type { RefObject } from "react";

export type MyCallLogRow = {
  id: string;
  callCa: string;
  liveMultiple: number;
  athMultiple: number;
  callTime: unknown;
  excludedFromStats?: boolean;
  tokenName?: string | null;
  tokenTicker?: string | null;
  callMarketCapUsd?: number | null;
  tokenImageUrl?: string | null;
};

function multipleCellClass(multiple: number): string {
  if (!Number.isFinite(multiple) || multiple <= 0) return "text-zinc-500";
  if (multiple >= 2) return "font-semibold text-emerald-300";
  if (multiple >= 1) return "font-medium text-zinc-200";
  return "font-medium text-amber-200/85";
}

export function MyCallLogMobileList({
  rows,
  loading,
  tapeWindow,
  highlightMint,
  bestAthRowKey,
  rowRefs,
  onOpenSubmitCall,
  onShowAllTime,
  onOpenTokenChart,
}: {
  rows: MyCallLogRow[];
  loading: boolean;
  tapeWindow: string;
  highlightMint: string | null;
  bestAthRowKey: string | null;
  rowRefs: RefObject<Record<string, HTMLTableRowElement | null>>;
  onOpenSubmitCall: () => void;
  onShowAllTime: () => void;
  onOpenTokenChart: (args: {
    chain: "solana";
    contractAddress: string;
    tokenTicker?: string | null;
    tokenName?: string | null;
    tokenImageUrl?: string | null;
  }) => void;
}) {
  if (loading && rows.length === 0) {
    return (
      <div className="px-4 py-10">
        <CallTapeTableSkeleton />
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="p-0">
        <DashboardWidgetEmpty
          badge="Call log"
          title={tapeWindow === "all" ? "No calls logged yet" : "No calls in this window"}
          description={
            tapeWindow === "all"
              ? "Log a verified call from the terminal — it lands here, on the live feed, and in Performance Lab."
              : `Nothing credited to you in the last ${tapeWindow === "7d" ? "7 days" : "30 days"}. Try All time or log a new call.`
          }
          actionLabel="Submit call"
          onAction={onOpenSubmitCall}
          secondaryActionLabel="Performance Lab"
          secondaryActionHref="/performance"
        />
        {tapeWindow !== "all" ? (
          <div className="-mt-8 flex justify-center pb-8">
            <button
              type="button"
              onClick={onShowAllTime}
              className="text-xs font-semibold text-cyan-300/90 underline-offset-2 hover:underline"
            >
              Show all time
            </button>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <ul className="max-h-[min(70vh,52rem)] divide-y divide-zinc-800/60 overflow-y-auto overscroll-contain">
      {rows.map((r) => {
        const iso =
          typeof r.callTime === "string"
            ? r.callTime
            : typeof r.callTime === "number"
              ? new Date(r.callTime).toISOString()
              : null;
        const dex = r.callCa ? dexscreenerTokenUrl("solana", r.callCa) : null;
        const rowKey = r.id || r.callCa + String(r.callTime);
        const isHighlighted = highlightMint != null && r.callCa === highlightMint;
        const isBestAth = bestAthRowKey != null && rowKey === bestAthRowKey;
        return (
          <li
            key={rowKey}
            ref={(el) => {
              rowRefs.current[rowKey] = el as unknown as HTMLTableRowElement | null;
            }}
            className={`px-4 py-3 ${
              isHighlighted
                ? "bg-[color:var(--accent)]/[0.08] ring-1 ring-inset ring-[color:var(--accent)]/40"
                : isBestAth
                  ? "bg-emerald-500/[0.04] ring-1 ring-inset ring-emerald-500/20"
                  : ""
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 gap-2">
                  {r.tokenImageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={r.tokenImageUrl}
                      alt=""
                      className="mt-0.5 h-8 w-8 shrink-0 rounded-lg border border-zinc-700/50 object-cover"
                      loading="lazy"
                      referrerPolicy="no-referrer"
                    />
                  ) : null}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold leading-snug text-zinc-100">
                      {formatCalledSnapshotLine({
                        tokenName: r.tokenName,
                        tokenTicker: r.tokenTicker,
                        callMarketCapUsd: r.callMarketCapUsd ?? null,
                        callCa: r.callCa,
                      })}
                    </p>
                    <p className="mt-1 text-[11px] text-zinc-500">
                      {iso ? formatRelativeTime(iso) : "—"}
                      {r.excludedFromStats ? (
                        <span className="ml-2 rounded border border-red-500/30 bg-red-500/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-200">
                          Excluded
                        </span>
                      ) : (
                        <span className="ml-2 rounded border border-emerald-500/25 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-200/90">
                          Counted
                        </span>
                      )}
                    </p>
                  </div>
                </div>
              </div>
              <div className="shrink-0 text-right">
                <p className={`text-sm font-semibold tabular-nums ${multipleCellClass(r.liveMultiple)}`}>
                  {Number.isFinite(r.liveMultiple) ? `${r.liveMultiple.toFixed(2)}×` : "—"}
                </p>
                <p className="mt-0.5 text-xs tabular-nums text-zinc-400">
                  ATH{" "}
                  {Number.isFinite(r.athMultiple) && r.athMultiple > 0
                    ? `${r.athMultiple.toFixed(2)}×`
                    : "—"}
                </p>
              </div>
            </div>
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {r.callCa ? (
                <button
                  type="button"
                  onClick={() =>
                    onOpenTokenChart({
                      chain: "solana",
                      contractAddress: r.callCa,
                      tokenTicker: r.tokenTicker,
                      tokenName: r.tokenName,
                      tokenImageUrl: r.tokenImageUrl ?? null,
                    })
                  }
                  className="rounded-md border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-100/90"
                >
                  Chart
                </button>
              ) : null}
              {dex ? (
                <a
                  href={dex}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-md border border-cyan-500/20 bg-cyan-500/10 px-2.5 py-1 text-[11px] font-semibold text-cyan-100/90"
                >
                  Dex
                </a>
              ) : null}
              <Link
                href="/performance"
                className="rounded-md border border-violet-500/20 bg-violet-500/10 px-2.5 py-1 text-[11px] font-semibold text-violet-100/90"
              >
                Stats
              </Link>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
