"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

type MilestoneProgress = {
  tier: number;
  threshold: number;
  activeCount: number;
  bonusCents: number;
  grantStatus: string | null;
  requiresSecondPayment: boolean;
};

type DashboardPayload = {
  account: {
    email: string;
    displayName: string | null;
    status: string;
    commissionRateBps: number;
    affiliateSlug: string | null;
  };
  trackingLink: string | null;
  referralCount: number;
  commissionSummary: {
    pendingCents: number;
    approvedCents: number;
    paidCents: number;
    rowCount: number;
    revshareCents: number;
    bonusCents: number;
  };
  milestones: MilestoneProgress[];
};

function fmtUsd(cents: number): string {
  return (Math.max(0, cents) / 100).toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  });
}

function milestoneStatusLabel(status: string | null): string {
  if (!status) return "Not reached";
  if (status === "auto_paid" || status === "paid") return "Paid";
  if (status === "approved") return "Approved";
  if (status === "pending_approval") return "Pending ops review";
  if (status === "rejected") return "Rejected";
  return status;
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
        trackingLink?: string | null;
        milestones?: MilestoneProgress[];
        referralCount?: number;
      };
      if (!res.ok || !j.success || !j.account || !j.commissionSummary) {
        setErr(typeof j.error === "string" ? j.error : "Could not load dashboard.");
        return;
      }
      setData({
        account: j.account,
        commissionSummary: j.commissionSummary,
        trackingLink: typeof j.trackingLink === "string" ? j.trackingLink : null,
        milestones: Array.isArray(j.milestones) ? j.milestones : [],
        referralCount: Math.floor(Number(j.referralCount)) || 0,
      });
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
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-10 sm:py-14">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-violet-700/90">Partner dashboard</p>
          <h1 className="mt-1 text-2xl font-semibold text-zinc-900">
            {data?.account.displayName ?? data?.account.email ?? "Partner"}
          </h1>
          <p className="mt-1 text-sm text-zinc-600">{data?.account.email}</p>
        </div>
        <button
          type="button"
          onClick={() => void logout()}
          className="shrink-0 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 shadow-sm hover:bg-zinc-50"
        >
          Sign out
        </button>
      </div>

      {err ? <p className="text-sm text-red-700">{err}</p> : null}

      {data?.trackingLink ? (
        <div className="rounded-xl border border-violet-200 bg-violet-50/80 px-4 py-3 shadow-sm">
          <p className="text-[10px] uppercase tracking-wider text-violet-800/90">Your tracking link</p>
          <p className="mt-2 break-all font-mono text-sm text-zinc-900">{data.trackingLink}</p>
          <p className="mt-2 text-xs text-zinc-600">
            Rev share: 15% on month 1, 25% on month 2, 15% on months 3–12 (per referred member). Annual signups
            include a one-time bonus ($5 Basic / $10 Pro).
          </p>
        </div>
      ) : null}

      {data ? (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-zinc-200/90 bg-white px-4 py-3 shadow-sm">
              <p className="text-[10px] uppercase tracking-wider text-zinc-500">Referrals</p>
              <p className="mt-1 text-xl font-bold tabular-nums text-zinc-900">{data.referralCount}</p>
            </div>
            <div className="rounded-xl border border-amber-200/90 bg-amber-50/80 px-4 py-3 shadow-sm">
              <p className="text-[10px] uppercase tracking-wider text-amber-900/80">Pending</p>
              <p className="mt-1 text-xl font-bold tabular-nums text-zinc-900">
                {fmtUsd(data.commissionSummary.pendingCents)}
              </p>
            </div>
            <div className="rounded-xl border border-emerald-200/90 bg-emerald-50/80 px-4 py-3 shadow-sm">
              <p className="text-[10px] uppercase tracking-wider text-emerald-900/80">Bonuses (all)</p>
              <p className="mt-1 text-xl font-bold tabular-nums text-zinc-900">
                {fmtUsd(data.commissionSummary.bonusCents)}
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-zinc-200/90 bg-white p-4 shadow-sm">
            <p className="text-sm font-semibold text-zinc-900">Milestone bonuses</p>
            <p className="mt-1 text-xs text-zinc-600">
              Tier 1 (10): first payment + 7 days, still subscribed. Tiers 25 & 50: second payment cleared, still
              subscribed.
            </p>
            <ul className="mt-4 space-y-3">
              {data.milestones.map((m) => (
                <li key={m.tier} className="rounded-lg border border-zinc-100 bg-zinc-50/80 px-3 py-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-zinc-900">
                      {m.tier} actives · {fmtUsd(m.bonusCents)}
                    </span>
                    <span className="text-xs font-medium text-violet-800">{milestoneStatusLabel(m.grantStatus)}</span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-zinc-200">
                    <div
                      className="h-full rounded-full bg-violet-600 transition-all"
                      style={{ width: `${Math.min(100, (m.activeCount / m.threshold) * 100)}%` }}
                    />
                  </div>
                  <p className="mt-1 text-xs text-zinc-500">
                    {m.activeCount} / {m.threshold} toward tier
                    {m.requiresSecondPayment ? " (2nd payment required)" : " (7 days after 1st payment)"}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </>
      ) : (
        <p className="text-sm text-zinc-500">Loading…</p>
      )}

      <p className="text-xs text-zinc-500">
        Campaigns, branding packs, and agreement signing are coming next. Payout requests will follow once ops approves
        pending balances.
      </p>
    </div>
  );
}
