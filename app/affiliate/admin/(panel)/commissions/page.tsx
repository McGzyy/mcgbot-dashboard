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

function fmtCreated(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function shortId(id: string | null, head = 8): string {
  if (!id) return "—";
  const t = id.trim();
  if (t.length <= head + 2) return t;
  return `${t.slice(0, head)}…`;
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
        {loading ? (
          <p className="px-4 py-10 text-center text-sm text-zinc-500">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-zinc-500">No commission rows yet.</p>
        ) : (
          <ul className="max-h-[min(32rem,70dvh)] divide-y divide-zinc-100 overflow-y-auto overscroll-contain">
            {rows.map((r) => (
              <li key={r.id} className="px-4 py-3 sm:px-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                      <p className="truncate text-sm font-semibold text-zinc-900" title={r.affiliateEmail ?? undefined}>
                        {r.affiliateEmail ?? "—"}
                      </p>
                      <span className="font-mono text-[10px] text-zinc-400" title={r.affiliateId}>
                        {shortId(r.affiliateId)}
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-500">
                      <span className="font-medium text-zinc-600">Referee</span>{" "}
                      <span className="font-mono" title={r.referredUserId ?? undefined}>
                        {shortId(r.referredUserId, 12)}
                      </span>
                      {r.source ? (
                        <>
                          {" "}
                          · <span title={r.source}>{r.source}</span>
                        </>
                      ) : null}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1 text-right">
                    <p className="text-sm font-semibold tabular-nums text-zinc-900">{fmtUsd(r.commissionCents)}</p>
                    <p className="text-[10px] tabular-nums text-zinc-500">on {fmtUsd(r.paymentAmountCents)}</p>
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-zinc-500">
                  <span title={r.createdAt}>{fmtCreated(r.createdAt)}</span>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-zinc-100 px-2 py-0.5 font-medium capitalize text-zinc-700">
                      {r.status}
                    </span>
                    {r.status === "pending" || r.status === "approved" ? (
                      <button
                        type="button"
                        disabled={busy !== null}
                        onClick={() => void voidRow(r.id)}
                        className="rounded border border-red-300 bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-800 disabled:opacity-45"
                      >
                        {busy === r.id ? "…" : "Void"}
                      </button>
                    ) : null}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
