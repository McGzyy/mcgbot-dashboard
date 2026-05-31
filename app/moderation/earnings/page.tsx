"use client";

import { ModStaffSubpageShell } from "@/app/moderation/_components/ModStaffSubpageShell";
import { modChrome } from "@/lib/roleTierStyles";
import { terminalSurface } from "@/lib/terminalDesignTokens";
import { useCallback, useEffect, useState } from "react";

type PayoutRow = {
  id: string;
  amountCents: number;
  periodLabel: string | null;
  status: string;
  txReference: string | null;
  paidAt: string | null;
  notes: string | null;
  createdAt: string;
};

function fmtUsd(cents: number | null): string {
  if (cents == null) return "Not set";
  return (cents / 100).toLocaleString(undefined, { style: "currency", currency: "USD" });
}

export default function ModStaffEarningsPage() {
  const [stipendCents, setStipendCents] = useState<number | null>(null);
  const [payoutNotes, setPayoutNotes] = useState<string | null>(null);
  const [paidTotalCents, setPaidTotalCents] = useState(0);
  const [pendingTotalCents, setPendingTotalCents] = useState(0);
  const [payouts, setPayouts] = useState<PayoutRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch("/api/mod/earnings", { credentials: "same-origin" });
      const j = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        error?: string;
        stipendCents?: number | null;
        payoutNotes?: string | null;
        paidTotalCents?: number;
        pendingTotalCents?: number;
        payouts?: PayoutRow[];
      };
      if (!res.ok || !j.success) {
        setErr(typeof j.error === "string" ? j.error : "Could not load earnings.");
        return;
      }
      setStipendCents(j.stipendCents ?? null);
      setPayoutNotes(j.payoutNotes ?? null);
      setPaidTotalCents(j.paidTotalCents ?? 0);
      setPendingTotalCents(j.pendingTotalCents ?? 0);
      setPayouts(Array.isArray(j.payouts) ? j.payouts : []);
    } catch {
      setErr("Network error.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <ModStaffSubpageShell
      title="Earnings"
      description="Your stipend terms and payout history. Compensation is set by admins on your roster entry — independent contractor terms apply per the staff agreement."
    >
      {err ? (
        <p className="mb-4 text-sm text-red-400" role="alert">
          {err}
        </p>
      ) : null}

      <div className="grid gap-5 sm:grid-cols-3">
        <div className={`${terminalSurface.panelCard} ${modChrome.card} rounded-2xl border px-4 py-5`}>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Monthly stipend</p>
          <p className="mt-2 text-2xl font-bold tabular-nums text-emerald-200">
            {loading ? "…" : fmtUsd(stipendCents)}
          </p>
          {payoutNotes ? <p className="mt-2 text-xs leading-relaxed text-zinc-500">{payoutNotes}</p> : null}
        </div>
        <div className={`${terminalSurface.panelCard} ${modChrome.card} rounded-2xl border px-4 py-5`}>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Paid to date</p>
          <p className="mt-2 text-2xl font-bold tabular-nums text-zinc-100">
            {loading ? "…" : fmtUsd(paidTotalCents)}
          </p>
        </div>
        <div className={`${terminalSurface.panelCard} ${modChrome.card} rounded-2xl border px-4 py-5`}>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Pending</p>
          <p className="mt-2 text-2xl font-bold tabular-nums text-amber-100/90">
            {loading ? "…" : fmtUsd(pendingTotalCents)}
          </p>
        </div>
      </div>

      <div className={`mt-6 ${terminalSurface.panelCard} ${modChrome.card} overflow-hidden rounded-2xl border`}>
        <div className="border-b border-zinc-800/60 px-4 py-4 sm:px-5">
          <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-zinc-500">Payout history</h2>
          <p className="mt-1 text-xs text-zinc-600">Recorded by admins. Run migration 20260531130000_mod_staff_payouts.sql if this section is empty.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-800/80 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                <th className="px-4 py-3">Period</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Reference</th>
                <th className="px-4 py-3">Date</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-zinc-500">
                    Loading…
                  </td>
                </tr>
              ) : payouts.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-zinc-500">
                    No payouts recorded yet. Your admin can add rows in Supabase or via a future admin payout UI.
                  </td>
                </tr>
              ) : (
                payouts.map((p) => (
                  <tr key={p.id} className="border-b border-zinc-800/40">
                    <td className="px-4 py-3 text-zinc-300">{p.periodLabel ?? "—"}</td>
                    <td className="px-4 py-3 tabular-nums text-zinc-200">{fmtUsd(p.amountCents)}</td>
                    <td className="px-4 py-3 capitalize text-zinc-400">{p.status}</td>
                    <td className="px-4 py-3 font-mono text-xs text-zinc-500">{p.txReference ?? "—"}</td>
                    <td className="px-4 py-3 text-xs text-zinc-500">
                      {p.paidAt ? new Date(p.paidAt).toLocaleDateString() : new Date(p.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </ModStaffSubpageShell>
  );
}
