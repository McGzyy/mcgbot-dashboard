"use client";

import { AdminPanel } from "@/app/admin/_components/adminUi";
import type { ModStatBuckets, ModStatsPayload } from "@/lib/modStats";
import { useCallback, useEffect, useState } from "react";

function fmt(n: number) {
  return new Intl.NumberFormat().format(n);
}

function ActionLedgerBreakdown({
  buckets,
  loading,
  loadingReady,
}: {
  buckets: ModStatBuckets;
  loading: boolean;
  loadingReady: boolean;
}) {
  if (loading && !loadingReady) {
    return <div className="mt-3 h-[5.5rem] animate-pulse rounded-lg bg-zinc-800/50" />;
  }
  return (
    <>
      <div className="mt-3 grid grid-cols-3 gap-2">
        <div className="rounded-lg border border-zinc-800/70 bg-black/25 px-2 py-2.5 text-center">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Approvals</div>
          <div className="mt-1 text-lg font-bold tabular-nums text-emerald-400/95">{fmt(buckets.approvals)}</div>
        </div>
        <div className="rounded-lg border border-zinc-800/70 bg-black/25 px-2 py-2.5 text-center">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Denials</div>
          <div className="mt-1 text-lg font-bold tabular-nums text-red-400/95">{fmt(buckets.denies)}</div>
        </div>
        <div className="rounded-lg border border-zinc-800/70 bg-black/25 px-2 py-2.5 text-center">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Excludes</div>
          <div className="mt-1 text-lg font-bold tabular-nums text-zinc-200">{fmt(buckets.excludes)}</div>
        </div>
      </div>
      {buckets.other > 0 ? (
        <p className="mt-2 text-center text-[10px] text-zinc-500">
          Other recorded types:{" "}
          <span className="font-semibold tabular-nums text-violet-300/90">{fmt(buckets.other)}</span>
        </p>
      ) : null}
      <p className="mt-2 text-center text-[10px] tabular-nums text-zinc-600">
        Total actions <span className="font-medium text-zinc-400">{fmt(buckets.total)}</span>
      </p>
    </>
  );
}

function LedgerStatCard({
  title,
  rangeLabel,
  buckets,
  loading,
  loadingReady,
}: {
  title: string;
  rangeLabel: string;
  buckets: ModStatBuckets;
  loading: boolean;
  loadingReady: boolean;
}) {
  return (
    <div className="rounded-2xl border border-zinc-800/70 bg-black/20 p-4">
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-semibold text-zinc-100">{title}</h3>
        <span className="shrink-0 text-xs tabular-nums text-zinc-500">{rangeLabel}</span>
      </div>
      <ActionLedgerBreakdown buckets={buckets} loading={loading} loadingReady={loadingReady} />
    </div>
  );
}

export function StaffStatsRail() {
  const [data, setData] = useState<ModStatsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [errHint, setErrHint] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch("/api/mod/stats", { credentials: "same-origin" });
      const json = (await res.json().catch(() => ({}))) as ModStatsPayload;
      if (!res.ok || json.success !== true) {
        setData(null);
        setErr(typeof json.error === "string" ? json.error : `HTTP ${res.status}`);
        return;
      }
      setData(json);
    } catch {
      setData(null);
      setErr("Could not load mod stats.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const site = data?.site;
  const yours = data?.yours;
  const ledgerQuiet =
    site != null &&
    site.month.approvals === 0 &&
    site.month.denies === 0 &&
    site.month.excludes === 0 &&
    site.month.other === 0 &&
    site.allTime.approvals === 0 &&
    site.allTime.denies === 0 &&
    site.allTime.excludes === 0 &&
    site.allTime.other === 0 &&
    (yours == null ||
      (yours.month.approvals === 0 &&
        yours.month.denies === 0 &&
        yours.month.excludes === 0 &&
        yours.month.other === 0 &&
        yours.allTime.approvals === 0 &&
        yours.allTime.denies === 0 &&
        yours.allTime.excludes === 0 &&
        yours.allTime.other === 0));

  return (
    <aside className="lg:sticky lg:top-20 lg:self-start">
      <AdminPanel className="p-6 sm:p-7">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-4 border-b border-zinc-800/70 pb-5">
          <div className="min-w-0">
            <h2 className="text-base font-semibold tracking-tight text-white">Action ledger</h2>
            <p className="mt-1 text-xs leading-relaxed text-zinc-500">
              {ledgerQuiet
                ? "Per-action counts stay at zero until the bot appends rows to modActions.json."
                : "Approvals, denials, and excludes recorded in modActions.json (30d = rolling window)."}
            </p>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="shrink-0 rounded-lg border border-zinc-700/80 bg-zinc-950/40 px-3 py-1.5 text-xs font-semibold text-zinc-200 transition hover:border-zinc-600 disabled:opacity-50"
          >
            {loading ? "…" : "Sync"}
          </button>
        </div>

        {err ? (
          <div
            className="mb-5 space-y-2 rounded-xl border border-amber-500/25 bg-amber-950/20 px-4 py-3 text-xs leading-relaxed text-amber-100/90"
            role="alert"
          >
            <p className="font-semibold text-amber-50/95">{err}</p>
            {errHint ? <p className="text-amber-100/80">{errHint}</p> : null}
          </div>
        ) : null}

        <div className="space-y-5">
          <LedgerStatCard
            title="All staff"
            rangeLabel="Last 30 days"
            buckets={site?.month ?? { approvals: 0, denies: 0, excludes: 0, other: 0, total: 0 }}
            loading={loading}
            loadingReady={!!site}
          />
          <LedgerStatCard
            title="All staff"
            rangeLabel="All time"
            buckets={site?.allTime ?? { approvals: 0, denies: 0, excludes: 0, other: 0, total: 0 }}
            loading={loading}
            loadingReady={!!site}
          />

          {yours ? (
            <>
              <div className="border-t border-zinc-800/70 pt-1">
                <p className="px-0.5 pt-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                  Your account
                </p>
              </div>
              <LedgerStatCard
                title="You"
                rangeLabel="Last 30 days"
                buckets={yours.month}
                loading={loading}
                loadingReady={!!site}
              />
              <LedgerStatCard
                title="You"
                rangeLabel="All time"
                buckets={yours.allTime}
                loading={loading}
                loadingReady={!!site}
              />
            </>
          ) : null}
        </div>

        {data?.actionCount != null ? (
          <p className="mt-4 border-t border-zinc-800/70 pt-3 text-[10px] leading-relaxed text-zinc-600">
            <span className="tabular-nums text-zinc-500">{fmt(data.actionCount)}</span> rows in ledger
            {data.generatedAt ? (
              <>
                {" "}
                · synced{" "}
                <span className="text-zinc-500">
                  {new Date(data.generatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
              </>
            ) : null}
          </p>
        ) : null}
      </AdminPanel>
    </aside>
  );
}
