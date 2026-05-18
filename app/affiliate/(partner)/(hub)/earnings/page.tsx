"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type CommissionSummary = {
  pendingCents: number;
  approvedCents: number;
  paidCents: number;
  rowCount: number;
  revshareCents: number;
  bonusCents: number;
};

function fmtUsd(cents: number): string {
  return (Math.max(0, cents) / 100).toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  });
}

export default function AffiliateEarningsPage() {
  const [summary, setSummary] = useState<CommissionSummary | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setErr(null);
    try {
      const res = await fetch("/api/affiliate/dashboard", { credentials: "same-origin" });
      const j = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        error?: string;
        commissionSummary?: CommissionSummary;
      };
      if (!res.ok || !j.success || !j.commissionSummary) {
        setErr(typeof j.error === "string" ? j.error : "Could not load earnings.");
        return;
      }
      setSummary(j.commissionSummary);
    } catch {
      setErr("Network error.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-8 sm:py-10">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-violet-700/90">Earnings</p>
        <h1 className="mt-1 text-2xl font-semibold text-zinc-900">Commission ledger</h1>
        <p className="mt-2 text-sm text-zinc-600">
          Rev share follows the payment-index schedule per referred member. Milestone and annual bonuses appear separately.
        </p>
      </div>

      {err ? <p className="text-sm text-red-700">{err}</p> : null}

      {summary ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-amber-200/90 bg-amber-50/80 px-4 py-3 shadow-sm">
            <p className="text-[10px] uppercase tracking-wider text-amber-900/80">Pending</p>
            <p className="mt-1 text-xl font-bold tabular-nums text-zinc-900">{fmtUsd(summary.pendingCents)}</p>
          </div>
          <div className="rounded-xl border border-emerald-200/90 bg-emerald-50/80 px-4 py-3 shadow-sm">
            <p className="text-[10px] uppercase tracking-wider text-emerald-900/80">Approved</p>
            <p className="mt-1 text-xl font-bold tabular-nums text-zinc-900">{fmtUsd(summary.approvedCents)}</p>
          </div>
          <div className="rounded-xl border border-zinc-200/90 bg-white px-4 py-3 shadow-sm">
            <p className="text-[10px] uppercase tracking-wider text-zinc-500">Paid out</p>
            <p className="mt-1 text-xl font-bold tabular-nums text-zinc-900">{fmtUsd(summary.paidCents)}</p>
          </div>
          <div className="rounded-xl border border-violet-200/90 bg-violet-50/80 px-4 py-3 shadow-sm">
            <p className="text-[10px] uppercase tracking-wider text-violet-800/90">Rev share (all)</p>
            <p className="mt-1 text-xl font-bold tabular-nums text-zinc-900">{fmtUsd(summary.revshareCents)}</p>
          </div>
          <div className="rounded-xl border border-zinc-200/90 bg-white px-4 py-3 shadow-sm sm:col-span-2">
            <p className="text-[10px] uppercase tracking-wider text-zinc-500">Bonuses (milestones + annual)</p>
            <p className="mt-1 text-xl font-bold tabular-nums text-zinc-900">{fmtUsd(summary.bonusCents)}</p>
            <p className="mt-2 text-xs text-zinc-500">{summary.rowCount} ledger row(s) total</p>
          </div>
        </div>
      ) : (
        <p className="text-sm text-zinc-500">Loading…</p>
      )}

      <p className="text-xs text-zinc-500">
        Payout requests and per-invoice export are coming soon.{" "}
        <Link href="/affiliate/dashboard" className="font-semibold text-violet-700 hover:underline">
          Back to dashboard
        </Link>
      </p>
    </div>
  );
}
