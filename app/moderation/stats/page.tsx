"use client";

import { ModStaffSubpageShell } from "@/app/moderation/_components/ModStaffSubpageShell";
import { StaffStatsRail } from "@/app/moderation/StaffStatsRail";
import type { ModAuditStatBuckets } from "@/lib/mod/modAudit";
import { emptyModAuditBuckets } from "@/lib/mod/modAudit";
import { modChrome } from "@/lib/roleTierStyles";
import { terminalSurface } from "@/lib/terminalDesignTokens";
import { useCallback, useEffect, useState } from "react";

function fmt(n: number) {
  return new Intl.NumberFormat().format(n);
}

function AuditBucketCard({ title, buckets }: { title: string; buckets: ModAuditStatBuckets }) {
  return (
    <div className={`rounded-xl border px-4 py-4 ${modChrome.card}`}>
      <h3 className="text-sm font-semibold text-zinc-100">{title}</h3>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="rounded-lg bg-black/25 px-2 py-2 text-center">
          <div className="text-[10px] uppercase text-zinc-500">Approved</div>
          <div className="mt-1 text-lg font-bold tabular-nums text-emerald-400">{fmt(buckets.approvals)}</div>
        </div>
        <div className="rounded-lg bg-black/25 px-2 py-2 text-center">
          <div className="text-[10px] uppercase text-zinc-500">Denied</div>
          <div className="mt-1 text-lg font-bold tabular-nums text-red-400/90">{fmt(buckets.denies)}</div>
        </div>
        <div className="rounded-lg bg-black/25 px-2 py-2 text-center">
          <div className="text-[10px] uppercase text-zinc-500">Excluded</div>
          <div className="mt-1 text-lg font-bold tabular-nums text-zinc-200">{fmt(buckets.excludes)}</div>
        </div>
        <div className="rounded-lg bg-black/25 px-2 py-2 text-center">
          <div className="text-[10px] uppercase text-zinc-500">Total</div>
          <div className="mt-1 text-lg font-bold tabular-nums text-zinc-300">{fmt(buckets.total)}</div>
        </div>
      </div>
    </div>
  );
}

export default function ModStaffStatsPage() {
  const [month, setMonth] = useState<ModAuditStatBuckets>(emptyModAuditBuckets());
  const [allTime, setAllTime] = useState<ModAuditStatBuckets>(emptyModAuditBuckets());
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/mod/earnings", { credentials: "same-origin" });
      const j = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        auditMonth?: ModAuditStatBuckets;
        auditAllTime?: ModAuditStatBuckets;
      };
      if (res.ok && j.success) {
        setMonth(j.auditMonth ?? emptyModAuditBuckets());
        setAllTime(j.auditAllTime ?? emptyModAuditBuckets());
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <ModStaffSubpageShell
      title="Staff stats"
      description="Your moderation performance from the server audit trail, plus the bot action ledger used on the queue page."
    >
      <div className="grid gap-8 xl:grid-cols-[1fr_22rem]">
        <div className="space-y-5">
          <div className={`${terminalSurface.panelCard} space-y-4 rounded-2xl border px-4 py-4 sm:px-5`}>
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-zinc-500">
                Your server audit
              </h2>
              <button
                type="button"
                onClick={() => void load()}
                disabled={loading}
                className="text-xs font-semibold text-emerald-300/90 hover:underline disabled:opacity-40"
              >
                Refresh
              </button>
            </div>
            {loading ? (
              <div className="h-28 animate-pulse rounded-xl bg-zinc-900/50" />
            ) : (
              <>
                <AuditBucketCard title="Last 30 days" buckets={month} />
                <AuditBucketCard title="All time" buckets={allTime} />
              </>
            )}
          </div>
        </div>
        <StaffStatsRail />
      </div>
    </ModStaffSubpageShell>
  );
}
