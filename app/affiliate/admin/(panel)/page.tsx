import { getAffiliateAdminOverviewStats } from "@/lib/affiliate/affiliateAdminOverview";

function fmtUsd(cents: number): string {
  return (Math.max(0, cents) / 100).toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  });
}

function MetricCard({
  label,
  value,
  hint,
  tone = "neutral",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "ok" | "warn" | "neutral";
}) {
  const dot =
    tone === "ok" ? "bg-emerald-500" : tone === "warn" ? "bg-amber-500" : "bg-zinc-400";
  return (
    <div className="rounded-xl border border-zinc-200/90 bg-white p-4 shadow-sm">
      <div className="flex items-start gap-2">
        <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${dot}`} aria-hidden />
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">{label}</p>
          <p className="mt-1 text-lg font-semibold tabular-nums text-zinc-900">{value}</p>
          {hint ? <p className="mt-1 text-[11px] text-zinc-500">{hint}</p> : null}
        </div>
      </div>
    </div>
  );
}

export default async function AffiliateAdminOverviewPage() {
  const stats = await getAffiliateAdminOverviewStats();

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-zinc-200/90 bg-gradient-to-b from-white to-zinc-50/90 p-5 shadow-sm sm:p-6">
        <h2 className="text-sm font-semibold text-zinc-900">Pulse</h2>
        <p className="mt-1 text-xs text-zinc-600">
          High-level counts for affiliate operations. Use Affiliates for approvals, suspensions, and manual accounts.
        </p>
        {stats ? (
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <MetricCard
              label="Pending applications"
              value={String(stats.pendingApplications)}
              tone={stats.pendingApplications > 0 ? "warn" : "neutral"}
            />
            <MetricCard
              label="Awaiting outreach"
              value={String(stats.needsContactApplications)}
              tone={stats.needsContactApplications > 0 ? "warn" : "neutral"}
              hint="Contact requested before approve/deny"
            />
            <MetricCard label="Active affiliates" value={String(stats.activePartners)} tone="ok" />
            <MetricCard
              label="Open contact messages"
              value={String(stats.openContactInquiries)}
              tone={stats.openContactInquiries > 0 ? "warn" : "neutral"}
              hint="Public /affiliate/support form"
            />
            <MetricCard label="Suspended" value={String(stats.suspendedPartners)} />
            <MetricCard
              label="Pending commission (ledger)"
              value={fmtUsd(stats.commissionsPendingCents)}
              hint="Sum of rows in pending status"
            />
            <MetricCard
              label="Commission volume (30d)"
              value={fmtUsd(stats.commissionsLast30dCents)}
              hint="Non-voided rows created in the last 30 days"
            />
            <MetricCard
              label="Attributed Discord members"
              value={String(stats.attributionRows)}
              hint="Rows in affiliate_attributions"
            />
          </div>
        ) : (
          <p className="mt-4 text-sm text-amber-800">Could not load stats (database unavailable).</p>
        )}
      </div>
    </div>
  );
}
