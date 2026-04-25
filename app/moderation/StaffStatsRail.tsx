"use client";

import { AdminPanel } from "@/app/admin/_components/adminUi";
import type { ModStatBuckets, ModStatsPayload } from "@/lib/modStats";
import { useCallback, useEffect, useState } from "react";

function fmt(n: number) {
  return new Intl.NumberFormat().format(n);
}

function BucketChips({ b }: { b: ModStatBuckets }) {
  return (
    <div className="mt-3 flex flex-wrap gap-1.5">
      <span className="rounded-md border border-white/[0.06] bg-black/25 px-2 py-1 text-[10px] font-semibold tabular-nums text-zinc-500">
        OK <span className="text-emerald-400/90">{fmt(b.approvals)}</span>
      </span>
      <span className="rounded-md border border-white/[0.06] bg-black/25 px-2 py-1 text-[10px] font-semibold tabular-nums text-zinc-500">
        Deny <span className="text-red-300/90">{fmt(b.denies)}</span>
      </span>
      <span className="rounded-md border border-white/[0.06] bg-black/25 px-2 py-1 text-[10px] font-semibold tabular-nums text-zinc-500">
        Excl <span className="text-zinc-300">{fmt(b.excludes)}</span>
      </span>
      {b.other > 0 ? (
        <span className="rounded-md border border-white/[0.06] bg-black/25 px-2 py-1 text-[10px] font-semibold tabular-nums text-zinc-500">
          + <span className="text-violet-300/90">{fmt(b.other)}</span>
        </span>
      ) : null}
    </div>
  );
}

function LedgerStatCard({
  title,
  rangeLabel,
  total,
  buckets,
  loading,
  loadingReady,
  size = "lg",
}: {
  title: string;
  rangeLabel: string;
  total: number;
  buckets: ModStatBuckets;
  loading: boolean;
  loadingReady: boolean;
  size?: "lg" | "md";
}) {
  const numClass = size === "lg" ? "text-2xl" : "text-xl";
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-black/20 p-4">
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-semibold text-zinc-100">{title}</h3>
        <span className="shrink-0 text-xs tabular-nums text-zinc-500">{rangeLabel}</span>
      </div>
      {loading && !loadingReady ? (
        <div className={`mt-3 h-9 animate-pulse rounded-md bg-zinc-800/50 ${size === "lg" ? "w-20" : "w-16"}`} />
      ) : (
        <>
          <p className={`mt-2 font-bold tabular-nums tracking-tight text-white ${numClass}`}>{fmt(total)}</p>
          <BucketChips b={buckets} />
        </>
      )}
    </div>
  );
}

export function StaffStatsRail() {
  const [data, setData] = useState<ModStatsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

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
    site.month.total === 0 &&
    site.allTime.total === 0 &&
    (yours == null || (yours.month.total === 0 && yours.allTime.total === 0));

  return (
    <aside className="lg:sticky lg:top-20 lg:self-start">
      <AdminPanel className="p-5 sm:p-6">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3 border-b border-white/[0.06] pb-4">
          <div className="min-w-0">
            <h2 className="text-base font-semibold tracking-tight text-white">Action ledger</h2>
            <p className="mt-1 text-xs leading-relaxed text-zinc-500">
              {ledgerQuiet
                ? "Counts stay at zero until the bot records approvals, denies, or excludes in modActions.json."
                : "From modActions.json on the bot host — approvals, denies, and excludes (30-day window = rolling last 30 days)."}
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
          <p
            className="mb-4 rounded-xl border border-amber-500/25 bg-amber-950/20 px-3 py-2 text-xs leading-relaxed text-amber-100/90"
            role="alert"
          >
            {err}
          </p>
        ) : null}

        <div className="space-y-4">
          <LedgerStatCard
            title="All staff"
            rangeLabel="Last 30 days"
            total={site?.month.total ?? 0}
            buckets={site?.month ?? { approvals: 0, denies: 0, excludes: 0, other: 0, total: 0 }}
            loading={loading}
            loadingReady={!!site}
            size="lg"
          />
          <LedgerStatCard
            title="All staff"
            rangeLabel="All time"
            total={site?.allTime.total ?? 0}
            buckets={site?.allTime ?? { approvals: 0, denies: 0, excludes: 0, other: 0, total: 0 }}
            loading={loading}
            loadingReady={!!site}
            size="lg"
          />

          {yours ? (
            <>
              <div className="border-t border-white/[0.06] pt-1">
                <p className="px-0.5 pt-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                  Your account
                </p>
              </div>
              <LedgerStatCard
                title="You"
                rangeLabel="Last 30 days"
                total={yours.month.total}
                buckets={yours.month}
                loading={loading}
                loadingReady={!!site}
                size="md"
              />
              <LedgerStatCard
                title="You"
                rangeLabel="All time"
                total={yours.allTime.total}
                buckets={yours.allTime}
                loading={loading}
                loadingReady={!!site}
                size="md"
              />
            </>
          ) : null}
        </div>

        {data?.actionCount != null ? (
          <p className="mt-4 border-t border-white/[0.06] pt-3 text-[10px] leading-relaxed text-zinc-600">
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
