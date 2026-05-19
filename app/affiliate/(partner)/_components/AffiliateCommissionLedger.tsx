"use client";

import { useCallback, useEffect, useState } from "react";
import { AFFILIATE_EARNINGS_SUMMARY } from "@/lib/affiliate/affiliateEarningsCopy";
import { fmtAffiliateUsd } from "@/lib/affiliate/affiliateFormatUsd";
import type { AffiliateCommissionPartnerRow } from "@/lib/affiliate/affiliateCommissions";

type StatusFilter = "all" | "pending" | "approved" | "paid" | "voided";

const FILTERS: { id: StatusFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "pending", label: "Pending" },
  { id: "approved", label: "Approved" },
  { id: "paid", label: "Paid" },
  { id: "voided", label: "Voided" },
];

function statusBadgeClass(status: string): string {
  if (status === "pending") return "bg-amber-100 text-amber-950";
  if (status === "approved") return "bg-emerald-100 text-emerald-950";
  if (status === "paid") return "bg-zinc-200 text-zinc-800";
  if (status === "voided") return "bg-red-100 text-red-900";
  return "bg-zinc-100 text-zinc-700";
}

function formatEligibleNote(row: AffiliateCommissionPartnerRow): string | null {
  if (row.status !== "pending" || !row.eligibleAt) return null;
  const at = new Date(row.eligibleAt);
  if (Number.isNaN(at.getTime())) return null;
  const now = Date.now();
  if (at.getTime() <= now) return "Eligible for approval";
  return `Hold until ${at.toLocaleDateString()}`;
}

export function AffiliateCommissionLedger() {
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [rows, setRows] = useState<AffiliateCommissionPartnerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async (status: StatusFilter) => {
    setLoading(true);
    setErr(null);
    try {
      const qs = status === "all" ? "" : `?status=${encodeURIComponent(status)}`;
      const res = await fetch(`/api/affiliate/commissions${qs}`, { credentials: "same-origin" });
      const j = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        commissions?: AffiliateCommissionPartnerRow[];
        error?: string;
      };
      if (!res.ok || !j.success) {
        setErr(typeof j.error === "string" ? j.error : "Could not load ledger.");
        setRows([]);
        return;
      }
      setRows(Array.isArray(j.commissions) ? j.commissions : []);
    } catch {
      setErr("Could not load ledger.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(filter);
  }, [filter, load]);

  return (
    <section className="rounded-2xl border border-zinc-200/90 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-zinc-900">Transaction history</h2>
          <p className="mt-1 text-xs leading-relaxed text-zinc-600">
            {AFFILIATE_EARNINGS_SUMMARY.hold}
          </p>
        </div>
        <a
          href={`/api/affiliate/commissions/export?status=${filter === "all" ? "all" : filter}`}
          className="shrink-0 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-800 shadow-sm hover:bg-zinc-50"
        >
          Export CSV
        </a>
      </div>

      <div className="mt-4 flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className={[
              "rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-colors",
              filter === f.id
                ? "bg-violet-600 text-white shadow-sm"
                : "border border-zinc-200 bg-zinc-50 text-zinc-700 hover:bg-zinc-100",
            ].join(" ")}
          >
            {f.label}
          </button>
        ))}
      </div>

      {err ? <p className="mt-3 text-sm text-red-700">{err}</p> : null}

      {loading ? (
        <p className="mt-4 text-sm text-zinc-500">Loading ledger…</p>
      ) : rows.length === 0 ? (
        <p className="mt-4 text-sm text-zinc-500">
          {filter === "all" ? "No commissions recorded yet." : `No ${filter} commissions.`}
        </p>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-xl border border-zinc-200">
          <table className="w-full min-w-[28rem] text-left text-xs">
            <thead className="border-b border-zinc-200 bg-zinc-50 text-[10px] uppercase tracking-wider text-zinc-500">
              <tr>
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2">Description</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {rows.map((r) => {
                const eligibleNote = formatEligibleNote(r);
                return (
                  <tr key={r.id} className="text-zinc-800">
                    <td className="whitespace-nowrap px-3 py-2.5 align-top text-zinc-600">
                      <span className="block">{new Date(r.createdAt).toLocaleDateString()}</span>
                      <span className="text-[10px] text-zinc-400">
                        {new Date(r.createdAt).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 align-top">
                      <p className="font-medium text-zinc-900">{r.description}</p>
                      {eligibleNote ? (
                        <p className="mt-0.5 text-[10px] text-amber-800">{eligibleNote}</p>
                      ) : null}
                    </td>
                    <td className="px-3 py-2.5 align-top">
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${statusBadgeClass(r.status)}`}
                      >
                        {r.status || "—"}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 align-top text-right font-semibold tabular-nums text-zinc-900">
                      {fmtAffiliateUsd(r.commissionCents)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {!loading && rows.length > 0 ? (
        <p className="mt-3 text-[11px] text-zinc-500">
          Showing up to {rows.length} most recent row{rows.length === 1 ? "" : "s"}
          {filter !== "all" ? ` (${filter})` : ""}. Approved balance is available for payout once not reserved.
        </p>
      ) : null}
    </section>
  );
}
