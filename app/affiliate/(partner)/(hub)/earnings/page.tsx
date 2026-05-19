"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AffiliateCommissionLedger } from "@/app/affiliate/(partner)/_components/AffiliateCommissionLedger";
import { AffiliateLoyaltyScheduleCallout } from "@/app/affiliate/(partner)/_components/AffiliateLoyaltyScheduleCallout";
import { AFFILIATE_EARNINGS_SUMMARY } from "@/lib/affiliate/affiliateEarningsCopy";

type CommissionSummary = {
  pendingCents: number;
  approvedCents: number;
  paidCents: number;
  rowCount: number;
  revshareCents: number;
  bonusCents: number;
};

type PayoutBalance = {
  approvedCents: number;
  reservedCents: number;
  availableCents: number;
  minRequestCents: number;
};

type PayoutRequest = {
  id: string;
  amountCents: number;
  status: string;
  partnerNote: string | null;
  createdAt: string;
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
  const [balance, setBalance] = useState<PayoutBalance | null>(null);
  const [payouts, setPayouts] = useState<PayoutRequest[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [amountUsd, setAmountUsd] = useState("");
  const [payoutNote, setPayoutNote] = useState("");
  const [payoutTotp, setPayoutTotp] = useState("");
  const [payoutMethodConfigured, setPayoutMethodConfigured] = useState(true);

  const load = useCallback(async () => {
    setErr(null);
    try {
      const [dashRes, payRes] = await Promise.all([
        fetch("/api/affiliate/dashboard", { credentials: "same-origin" }),
        fetch("/api/affiliate/payouts", { credentials: "same-origin" }),
      ]);
      const j = (await dashRes.json().catch(() => ({}))) as {
        success?: boolean;
        error?: string;
        commissionSummary?: CommissionSummary;
      };
      if (!dashRes.ok || !j.success || !j.commissionSummary) {
        setErr(typeof j.error === "string" ? j.error : "Could not load earnings.");
        return;
      }
      setSummary(j.commissionSummary);

      const pj = (await payRes.json().catch(() => ({}))) as {
        success?: boolean;
        balance?: PayoutBalance;
        requests?: PayoutRequest[];
        payoutMethodConfigured?: boolean;
      };
      if (payRes.ok && pj.success) {
        setBalance(pj.balance ?? null);
        setPayouts(Array.isArray(pj.requests) ? pj.requests : []);
        setPayoutMethodConfigured(pj.payoutMethodConfigured !== false);
      }
    } catch {
      setErr("Network error.");
    }
  }, []);

  async function requestPayout(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    setNote(null);
    const dollars = Number(amountUsd);
    const amountCents = Math.round(dollars * 100);
    try {
      const res = await fetch("/api/affiliate/payouts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          amountCents,
          partnerNote: payoutNote.trim() || null,
          totpCode: payoutTotp,
        }),
      });
      const j = (await res.json().catch(() => ({}))) as { success?: boolean; error?: string };
      if (!res.ok || !j.success) {
        setErr(typeof j.error === "string" ? j.error : "Payout request failed.");
        return;
      }
      setAmountUsd("");
      setPayoutNote("");
      setPayoutTotp("");
      setNote("Payout request submitted.");
      await load();
    } catch {
      setErr("Network error.");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-violet-700/90">Earnings</p>
        <h1 className="mt-1 text-2xl font-semibold text-zinc-900">Commission ledger</h1>
        <p className="mt-2 text-sm leading-relaxed text-zinc-600">
          <span className="font-medium text-zinc-800">Recurring commissions</span> use the loyalty schedule below (
          {AFFILIATE_EARNINGS_SUMMARY.recurring}) {AFFILIATE_EARNINGS_SUMMARY.stripeFees}{" "}
          <span className="font-medium text-zinc-800">Extra bonuses</span> are milestone and annual-plan payouts — listed
          separately. {AFFILIATE_EARNINGS_SUMMARY.timingNote}
        </p>
        <Link href="/affiliate/resources#how-you-earn" className="mt-2 inline-block text-xs font-semibold text-violet-700 hover:underline">
          How earnings work →
        </Link>
      </div>

      <AffiliateLoyaltyScheduleCallout />

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
            <p className="text-[10px] uppercase tracking-wider text-violet-800/90">Recurring commissions</p>
            <p className="mt-1 text-xl font-bold tabular-nums text-zinc-900">{fmtUsd(summary.revshareCents)}</p>
          </div>
          <div className="rounded-xl border border-zinc-200/90 bg-white px-4 py-3 shadow-sm sm:col-span-2">
            <p className="text-[10px] uppercase tracking-wider text-zinc-500">Extra bonuses</p>
            <p className="text-[10px] text-zinc-400">Milestones & annual signups</p>
            <p className="mt-1 text-xl font-bold tabular-nums text-zinc-900">{fmtUsd(summary.bonusCents)}</p>
            <p className="mt-2 text-xs text-zinc-500">{summary.rowCount} ledger row(s) total</p>
          </div>
        </div>
      ) : (
        <p className="text-sm text-zinc-500">Loading…</p>
      )}

      <AffiliateCommissionLedger />

      {balance ? (
        <section className="rounded-2xl border border-zinc-200/90 bg-white p-4 shadow-sm space-y-3">
          <h2 className="text-sm font-semibold text-zinc-900">Request payout</h2>
          <p className="text-xs text-zinc-600">
            Available: {fmtUsd(balance.availableCents)} (minimum {fmtUsd(balance.minRequestCents)}). Ops reviews
            requests manually.
          </p>
          {!payoutMethodConfigured ? (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
              Add your payout method in{" "}
              <Link href="/affiliate/settings" className="font-semibold text-amber-900 underline">
                Settings
              </Link>{" "}
              before submitting a withdrawal request.
            </p>
          ) : null}
          <form onSubmit={requestPayout} className="space-y-3">
            <label className="block text-xs">
              <span className="font-semibold text-zinc-600">Amount (USD)</span>
              <input
                type="number"
                min={balance.minRequestCents / 100}
                step="0.01"
                value={amountUsd}
                onChange={(e) => setAmountUsd(e.target.value)}
                className="mt-1 h-9 w-full rounded-lg border border-zinc-200 px-3 text-sm"
                required
              />
            </label>
            <label className="block text-xs">
              <span className="font-semibold text-zinc-600">Note (optional)</span>
              <input
                value={payoutNote}
                onChange={(e) => setPayoutNote(e.target.value)}
                className="mt-1 h-9 w-full rounded-lg border border-zinc-200 px-3 text-sm"
              />
            </label>
            <label className="block text-xs">
              <span className="font-semibold text-zinc-600">Authenticator code</span>
              <input
                value={payoutTotp}
                onChange={(e) => setPayoutTotp(e.target.value)}
                className="mt-1 h-9 w-full rounded-lg border border-zinc-200 px-3 text-sm"
                required
                inputMode="numeric"
              />
            </label>
            <button
              type="submit"
              disabled={busy || !payoutMethodConfigured}
              className="h-9 rounded-lg bg-violet-600 px-4 text-xs font-semibold text-white disabled:opacity-45"
            >
              {busy ? "Submitting…" : "Submit payout request"}
            </button>
          </form>
          {payouts.length > 0 ? (
            <ul className="mt-2 divide-y divide-zinc-100 border-t border-zinc-100 pt-2 text-xs">
              {payouts.map((p) => (
                <li key={p.id} className="flex justify-between gap-2 py-2">
                  <span>
                    {fmtUsd(p.amountCents)} · <span className="capitalize">{p.status}</span>
                  </span>
                  <span className="text-zinc-500">{new Date(p.createdAt).toLocaleDateString()}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}

      {note ? <p className="text-sm text-emerald-800">{note}</p> : null}

      <p className="text-xs text-zinc-500">
        <Link href="/affiliate/dashboard" className="font-semibold text-violet-700 hover:underline">
          Back to dashboard
        </Link>
      </p>
    </div>
  );
}
