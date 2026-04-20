"use client";

import type { ModStatBuckets, ModStatsPayload } from "@/lib/modStats";
import { modChrome } from "@/lib/roleTierStyles";
import { useCallback, useEffect, useState } from "react";

function fmt(n: number) {
  return new Intl.NumberFormat().format(n);
}

function BucketChips({ b }: { b: ModStatBuckets }) {
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      <span className="rounded-md border border-emerald-600/25 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold tabular-nums text-emerald-200/95">
        OK {fmt(b.approvals)}
      </span>
      <span className="rounded-md border border-red-600/25 bg-red-950/40 px-2 py-0.5 text-[10px] font-semibold tabular-nums text-red-200/90">
        Deny {fmt(b.denies)}
      </span>
      <span className="rounded-md border border-zinc-600/40 bg-zinc-900/60 px-2 py-0.5 text-[10px] font-semibold tabular-nums text-zinc-300">
        Excl {fmt(b.excludes)}
      </span>
      {b.other > 0 ? (
        <span className="rounded-md border border-violet-600/25 bg-violet-950/35 px-2 py-0.5 text-[10px] font-semibold tabular-nums text-violet-200/90">
          + {fmt(b.other)}
        </span>
      ) : null}
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
    <aside className={`lg:sticky lg:top-20 lg:self-start ${modChrome.railPanel}`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className={modChrome.railKicker}>Action ledger</p>
          <h2 className="mt-1 text-sm font-semibold tracking-tight text-white">Staff throughput</h2>
          {ledgerQuiet ? (
            <p className="mt-1.5 text-[11px] leading-relaxed text-zinc-500">
              Ledger is live — counts stay at zero until the bot records approvals, denies, or excludes.
            </p>
          ) : (
            <p className="mt-1.5 text-[11px] leading-relaxed text-zinc-500">
              From <span className="font-medium text-zinc-400">modActions.json</span> on the bot host — coin approvals,
              denies, excludes (30-day window = rolling last 30 days).
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="shrink-0 rounded-lg border border-emerald-800/50 bg-emerald-950/30 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-emerald-100/90 transition hover:border-emerald-500/50 hover:bg-emerald-900/40 disabled:opacity-40"
        >
          {loading ? "…" : "Sync"}
        </button>
      </div>

      {err ? (
        <p className="mt-3 rounded-lg border border-amber-500/25 bg-amber-950/20 px-2 py-2 text-[11px] leading-relaxed text-amber-100/90">{err}</p>
      ) : null}

      <div className="mt-4 space-y-3">
        <div className={modChrome.railMetric}>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-500/80">All staff · last 30 days</p>
          {loading && !site ? (
            <div className="mt-2 h-8 animate-pulse rounded bg-emerald-950/30" />
          ) : site ? (
            <>
              <p className="mt-1 text-2xl font-bold tabular-nums tracking-tight text-white">{fmt(site.month.total)}</p>
              <BucketChips b={site.month} />
            </>
          ) : null}
        </div>

        <div className={modChrome.railMetric}>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-500/80">All staff · all time</p>
          {loading && !site ? (
            <div className="mt-2 h-8 animate-pulse rounded bg-emerald-950/30" />
          ) : site ? (
            <>
              <p className="mt-1 text-2xl font-bold tabular-nums tracking-tight text-white">{fmt(site.allTime.total)}</p>
              <BucketChips b={site.allTime} />
            </>
          ) : null}
        </div>

        {yours ? (
          <>
            <div className="my-2 border-t border-emerald-900/25" />
            <p className={modChrome.railKicker}>Your account</p>
            <div className={modChrome.railMetric}>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-sky-500/75">You · 30 days</p>
              <p className="mt-1 text-xl font-bold tabular-nums text-sky-100/95">{fmt(yours.month.total)}</p>
              <BucketChips b={yours.month} />
            </div>
            <div className={modChrome.railMetric}>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-sky-500/75">You · all time</p>
              <p className="mt-1 text-xl font-bold tabular-nums text-sky-100/95">{fmt(yours.allTime.total)}</p>
              <BucketChips b={yours.allTime} />
            </div>
          </>
        ) : null}
      </div>

      {data?.actionCount != null ? (
        <p className="mt-3 text-[10px] leading-relaxed text-zinc-600">
          <span className="tabular-nums text-zinc-500">{fmt(data.actionCount)}</span> rows in ledger
          {data.generatedAt ? (
            <>
              {" "}
              · synced{" "}
              <span className="text-zinc-500">{new Date(data.generatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
            </>
          ) : null}
        </p>
      ) : null}
    </aside>
  );
}
