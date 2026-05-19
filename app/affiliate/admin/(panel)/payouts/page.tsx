"use client";

import { useCallback, useEffect, useState } from "react";

type PayoutRow = {
  id: string;
  affiliateId: string;
  affiliateEmail: string;
  amountCents: number;
  status: string;
  partnerNote: string | null;
  adminNote: string | null;
  createdAt: string;
};

function fmtUsd(cents: number): string {
  return (Math.max(0, cents) / 100).toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  });
}

export default function AffiliateAdminPayoutsPage() {
  const [rows, setRows] = useState<PayoutRow[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setErr(null);
    try {
      const res = await fetch("/api/affiliate/admin/payouts", { credentials: "same-origin" });
      const j = (await res.json().catch(() => ({}))) as { success?: boolean; requests?: PayoutRow[]; error?: string };
      if (!res.ok || !j.success) {
        setErr(typeof j.error === "string" ? j.error : "Could not load payouts.");
        setRows([]);
        return;
      }
      setRows(Array.isArray(j.requests) ? j.requests : []);
    } catch {
      setErr("Could not load payouts.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function setStatus(id: string, status: "approved" | "paid" | "rejected") {
    setBusy(id);
    setErr(null);
    try {
      const res = await fetch(`/api/affiliate/admin/payouts/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ status }),
      });
      const j = (await res.json().catch(() => ({}))) as { success?: boolean; error?: string };
      if (!res.ok || !j.success) {
        setErr(typeof j.error === "string" ? j.error : "Update failed.");
        return;
      }
      await load();
    } catch {
      setErr("Update failed.");
    } finally {
      setBusy(null);
    }
  }

  const pending = rows.filter((r) => r.status === "pending");

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-zinc-900">Payout requests</h2>
        <p className="mt-1 text-sm text-zinc-600">
          Review affiliate withdrawal requests against approved commission balance.
        </p>
      </div>

      {pending.length > 0 ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          {pending.length} pending request{pending.length === 1 ? "" : "s"}.
        </p>
      ) : null}

      {err ? <p className="text-sm text-red-700">{err}</p> : null}

      <section className="overflow-hidden rounded-2xl border border-zinc-200/90 bg-white shadow-sm">
        <div className="max-h-[32rem] overflow-auto">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 border-b border-zinc-200 bg-zinc-50 text-[10px] uppercase tracking-wider text-zinc-500">
              <tr>
                <th className="px-3 py-2">Affiliate</th>
                <th className="px-3 py-2">Amount</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Note</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-8 text-center text-zinc-500">
                    No payout requests yet.
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id}>
                    <td className="px-3 py-2">
                      <span className="block font-medium text-zinc-900">{r.affiliateEmail || r.affiliateId}</span>
                      <span className="text-zinc-500">{new Date(r.createdAt).toLocaleString()}</span>
                    </td>
                    <td className="px-3 py-2 font-semibold tabular-nums text-zinc-900">{fmtUsd(r.amountCents)}</td>
                    <td className="px-3 py-2 capitalize text-zinc-700">{r.status}</td>
                    <td className="px-3 py-2 max-w-[12rem] truncate text-zinc-600">{r.partnerNote ?? "—"}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-right">
                      <div className="flex flex-wrap justify-end gap-1">
                        {r.status === "pending" ? (
                          <>
                            <button
                              type="button"
                              disabled={busy !== null}
                              onClick={() => void setStatus(r.id, "approved")}
                              className="rounded border border-emerald-300 bg-emerald-50 px-2 py-1 text-[10px] font-semibold text-emerald-900"
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              disabled={busy !== null}
                              onClick={() => void setStatus(r.id, "rejected")}
                              className="rounded border border-red-300 bg-red-50 px-2 py-1 text-[10px] font-semibold text-red-900"
                            >
                              Reject
                            </button>
                          </>
                        ) : null}
                        {r.status === "approved" ? (
                          <button
                            type="button"
                            disabled={busy !== null}
                            onClick={() => void setStatus(r.id, "paid")}
                            className="rounded border border-violet-300 bg-violet-50 px-2 py-1 text-[10px] font-semibold text-violet-900"
                          >
                            Mark paid
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
