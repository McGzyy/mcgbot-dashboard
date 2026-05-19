import type { AffiliateAdminPartnerDetail } from "@/lib/affiliate/affiliateAdminPartnerDetail";
import { fmtAffiliateUsd } from "@/lib/affiliate/affiliateFormatUsd";

function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-zinc-200/90 bg-zinc-50/80 p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums text-zinc-900">{value}</p>
      {hint ? <p className="mt-0.5 text-[11px] text-zinc-500">{hint}</p> : null}
    </div>
  );
}

export function AffiliatePartnerStatsGrid({ detail }: { detail: AffiliateAdminPartnerDetail }) {
  const { commissionSummary: c, payoutBalance: p, attributionStats: a } = detail;
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard label="Referred members" value={String(a.total)} hint={`${a.withPayment} with paid invoice`} />
      <StatCard label="Lifetime commission" value={fmtAffiliateUsd(c.lifetimeCents)} />
      <StatCard label="Pending" value={fmtAffiliateUsd(c.pendingCents)} />
      <StatCard label="Approved (payable)" value={fmtAffiliateUsd(p.approvedCents)} />
      <StatCard label="Paid out" value={fmtAffiliateUsd(c.paidCents)} />
      <StatCard label="Available to withdraw" value={fmtAffiliateUsd(p.availableCents)} />
      <StatCard label="Commission rows" value={String(c.rowCount)} hint={`Rev ${fmtAffiliateUsd(c.revshareCents)} · bonus ${fmtAffiliateUsd(c.bonusCents)}`} />
      <StatCard label="Rate (bps)" value={String(detail.account.commissionRateBps)} hint={`${(detail.account.commissionRateBps / 100).toFixed(1)}%`} />
    </div>
  );
}
