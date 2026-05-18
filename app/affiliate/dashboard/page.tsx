"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

type DashboardPayload = {
  account: {
    email: string;
    displayName: string | null;
    status: string;
    commissionRateBps: number;
  };
  commissionSummary: {
    pendingCents: number;
    approvedCents: number;
    paidCents: number;
    rowCount: number;
  };
};

function fmtUsd(cents: number): string {
  return (Math.max(0, cents) / 100).toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  });
}

export default function AffiliateDashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setErr(null);
    try {
      const res = await fetch("/api/affiliate/dashboard", { credentials: "same-origin" });
      const j = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        error?: string;
        account?: DashboardPayload["account"];
        commissionSummary?: DashboardPayload["commissionSummary"];
      };
      if (!res.ok || !j.success || !j.account || !j.commissionSummary) {
        setErr(typeof j.error === "string" ? j.error : "Could not load dashboard.");
        return;
      }
      setData({ account: j.account, commissionSummary: j.commissionSummary });
    } catch {
      setErr("Network error.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function logout() {
    await fetch("/api/affiliate/auth/logout", { method: "POST", credentials: "same-origin" });
    router.replace("/affiliate/login");
  }

  return (
    <div className="mx-auto max-w-lg space-y-6 px-4 py-10 sm:py-14">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-violet-300/80">Affiliate dashboard</p>
          <h1 className="mt-1 text-2xl font-semibold text-zinc-50">
            {data?.account.displayName ?? data?.account.email ?? "Partner"}
          </h1>
          <p className="mt-1 text-sm text-zinc-500">{data?.account.email}</p>
        </div>
        <button
          type="button"
          onClick={() => void logout()}
          className="shrink-0 rounded-lg border border-zinc-700/80 px-3 py-1.5 text-xs font-semibold text-zinc-300 hover:bg-zinc-800/60"
        >
          Sign out
        </button>
      </div>

      {data?.account.status === "pending" ? (
        <p className="rounded-lg border border-amber-500/30 bg-amber-950/20 px-3 py-2 text-sm text-amber-100">
          Your account is pending approval. Commission tracking will appear once an admin activates it.
        </p>
      ) : null}

      {err ? <p className="text-sm text-red-300">{err}</p> : null}

      {data ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-zinc-800/80 bg-zinc-900/40 px-4 py-3">
            <p className="text-[10px] uppercase tracking-wider text-zinc-500">Commission rate</p>
            <p className="mt-1 text-xl font-bold tabular-nums text-zinc-50">
              {(data.account.commissionRateBps / 100).toFixed(2)}%
            </p>
          </div>
          <div className="rounded-lg border border-amber-500/25 bg-amber-950/15 px-4 py-3">
            <p className="text-[10px] uppercase tracking-wider text-amber-200/80">Pending</p>
            <p className="mt-1 text-xl font-bold tabular-nums text-zinc-50">
              {fmtUsd(data.commissionSummary.pendingCents)}
            </p>
          </div>
          <div className="rounded-lg border border-emerald-500/25 bg-emerald-950/20 px-4 py-3">
            <p className="text-[10px] uppercase tracking-wider text-emerald-300/80">Approved</p>
            <p className="mt-1 text-xl font-bold tabular-nums text-zinc-50">
              {fmtUsd(data.commissionSummary.approvedCents)}
            </p>
          </div>
          <div className="rounded-lg border border-zinc-800/80 bg-zinc-950/50 px-4 py-3">
            <p className="text-[10px] uppercase tracking-wider text-zinc-500">Paid</p>
            <p className="mt-1 text-xl font-bold tabular-nums text-zinc-50">
              {fmtUsd(data.commissionSummary.paidCents)}
            </p>
          </div>
        </div>
      ) : (
        <p className="text-sm text-zinc-500">Loading…</p>
      )}

      <p className="text-xs text-zinc-600">
        Payout requests and referral link tracking for affiliates will ship in the next milestone.
      </p>
    </div>
  );
}
