"use client";

import { useCallback, useEffect, useState } from "react";

type Row = {
  id: string;
  affiliateId: string;
  affiliateEmail: string | null;
  referredUserId: string | null;
  paymentAmountCents: number | null;
  commissionCents: number;
  status: string;
  source: string | null;
  stripeInvoiceId: string | null;
  createdAt: string;
};

function fmtUsd(cents: number | null): string {
  if (cents == null || !Number.isFinite(cents)) return "—";
  return (Math.max(0, cents) / 100).toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  });
}

export default function AffiliateAdminCommissionsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch("/api/affiliate/admin/commissions", { credentials: "same-origin" });
      const j = (await res.json().catch(() => ({}))) as { success?: boolean; commissions?: Row[]; error?: string };
      if (!res.ok || !j.success) {
        setErr(typeof j.error === "string" ? j.error : "Could not load commissions.");
        setRows([]);
        return;
      }
      setRows(Array.isArray(j.commissions) ? j.commissions : []);
    } catch {
      setErr("Could not load commissions.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function voidRow(id: string) {
    setBusy(id);
    setErr(null);
    try {
      const res = await fetch(`/api/affiliate/admin/commissions/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ action: "void" }),
      });
      const j = (await res.json().catch(() => ({}))) as { success?: boolean; error?: string };
      if (!res.ok || !j.success) {
        setErr(typeof j.error === "string" ? j.error : "Void failed.");
        return;
      }
      await load();
    } catch {
      setErr("Void failed.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-zinc-200/90 bg-white p-4 shadow-sm sm:p-5">
        <h2 className="text-sm font-semibold text-zinc-900">Commission ledger</h2>
        <p className="mt-1 text-xs text-zinc-600">
          Cash commissions (separate from member referral credit). Void pending or approved rows if a payment was
          reversed in error.
        </p>
      </div>

      {err ? <p className="text-sm text-red-700">{err}</p> : null}

      <div className="overflow-hidden rounded-2xl border border-zinc-200/90 bg-white shadow-sm">
        <div className="max-h-[32rem] overflow-auto">
          <table className="w-full min-w-[900px] text-left text-xs">
            <thead className="sticky top-0 border-b border-zinc-200 bg-zinc-50 text-[10px] uppercase tracking-wider text-zinc-500">
              <tr>
                <th className="px-3 py-2">Created</th>
                <th className="px-3 py-2">Affiliate</th>
                <th className="px-3 py-2">Referee</th>
                <th className="px-3 py-2">Payment</th>
                <th className="px-3 py-2">Commission</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Source</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-3 py-8 text-center text-zinc-500">
                    Loading…
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-3 py-8 text-center text-zinc-500">
                    No commission rows yet.
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id} className="text-zinc-800">
                    <td className="whitespace-nowrap px-3 py-2 font-mono text-[10px] text-zinc-500">
                      {r.createdAt ? new Date(r.createdAt).toLocaleString() : "—"}
                    </td>
                    <td className="px-3 py-2">
                      <span className="block text-sm font-medium text-zinc-900">{r.affiliateEmail ?? "—"}</span>
                      <span className="font-mono text-[10px] text-zinc-400">{r.affiliateId.slice(0, 8)}…</span>
                    </td>
                    <td className="px-3 py-2 font-mono text-[10px] text-zinc-600">{r.referredUserId ?? "—"}</td>
                    <td className="px-3 py-2 tabular-nums">{fmtUsd(r.paymentAmountCents)}</td>
                    <td className="px-3 py-2 tabular-nums font-medium">{fmtUsd(r.commissionCents)}</td>
                    <td className="px-3 py-2 capitalize text-zinc-700">{r.status}</td>
                    <td className="max-w-[140px] truncate px-3 py-2 text-zinc-500">{r.source ?? "—"}</td>
                    <td className="px-3 py-2 text-right">
                      {r.status === "pending" || r.status === "approved" ? (
                        <button
                          type="button"
                          disabled={busy !== null}
                          onClick={() => void voidRow(r.id)}
                          className="rounded border border-red-300 bg-red-50 px-2 py-1 text-[10px] font-semibold text-red-800 disabled:opacity-45"
                        >
                          {busy === r.id ? "…" : "Void"}
                        </button>
                      ) : (
                        <span className="text-zinc-400">—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
