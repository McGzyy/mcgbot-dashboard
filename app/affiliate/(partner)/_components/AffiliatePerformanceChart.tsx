"use client";

import type { AffiliateDailySeriesPoint } from "@/lib/affiliate/affiliatePartnerAnalytics";

function shortDate(isoDate: string): string {
  const d = new Date(`${isoDate}T12:00:00Z`);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function AffiliatePerformanceChart({
  series,
  metric,
}: {
  series: AffiliateDailySeriesPoint[];
  metric: "clicks" | "commissionCents";
}) {
  const values = series.map((p) => (metric === "clicks" ? p.clicks : p.commissionCents / 100));
  const max = Math.max(1, ...values);

  return (
    <div className="mt-4 flex h-36 items-end gap-0.5 sm:gap-1">
      {series.map((p, i) => {
        const v = values[i] ?? 0;
        const h = Math.max(v > 0 ? 8 : 2, Math.round((v / max) * 100));
        return (
          <div key={p.date} className="group flex min-w-0 flex-1 flex-col items-center gap-1">
            <div
              className="relative w-full max-w-[14px] rounded-t bg-violet-500/90 transition-colors group-hover:bg-violet-600 sm:max-w-[18px]"
              style={{ height: `${h}%` }}
              title={
                metric === "clicks"
                  ? `${shortDate(p.date)}: ${p.clicks} clicks`
                  : `${shortDate(p.date)}: $${(p.commissionCents / 100).toFixed(2)}`
              }
            />
            {(series.length <= 14 || i % Math.ceil(series.length / 7) === 0) && (
              <span className="hidden text-[9px] text-zinc-400 sm:block">{shortDate(p.date)}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
