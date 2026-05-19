import {
  AFFILIATE_ANNUAL_BONUS_COPY,
  AFFILIATE_EARNINGS_SUMMARY,
  AFFILIATE_MILESTONE_COPY,
  AFFILIATE_RECURRING_COMMISSION_COPY,
} from "@/lib/affiliate/affiliateEarningsCopy";

type Variant = "compact" | "full";

function RateTable({
  title,
  rows,
}: {
  title: string;
  rows: readonly { payment: string; rate: string }[];
}) {
  return (
    <div className="mt-3">
      <p className="text-xs font-semibold text-zinc-800">{title}</p>
      <div className="mt-2 overflow-hidden rounded-xl border border-zinc-200">
        <table className="w-full text-left text-sm">
          <thead className="bg-zinc-50 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
            <tr>
              <th className="px-3 py-2">Their payment</th>
              <th className="px-3 py-2 text-right">You earn</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {rows.map((row) => (
              <tr key={row.payment}>
                <td className="px-3 py-2.5 text-zinc-700">{row.payment}</td>
                <td className="px-3 py-2.5 text-right font-semibold tabular-nums text-zinc-900">{row.rate}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function AffiliateEarningsGuide({ variant = "full" }: { variant?: Variant }) {
  if (variant === "compact") {
    return (
      <div className="mt-4 space-y-3 border-t border-violet-200/60 pt-4">
        <p className="text-xs font-semibold text-zinc-900">How you earn</p>
        <ul className="space-y-2.5 text-xs leading-relaxed text-zinc-700">
          <li>
            <span className="font-semibold text-zinc-900">Recurring — </span>
            {AFFILIATE_EARNINGS_SUMMARY.recurring}
          </li>
          <li>
            <span className="font-semibold text-zinc-900">Milestones — </span>
            {AFFILIATE_EARNINGS_SUMMARY.milestones}
          </li>
          <li>
            <span className="font-semibold text-zinc-900">Annual plans — </span>
            {AFFILIATE_EARNINGS_SUMMARY.annual}
          </li>
          <li>
            <span className="font-semibold text-zinc-900">Hold — </span>
            {AFFILIATE_EARNINGS_SUMMARY.hold}
          </li>
        </ul>
        <p className="text-[11px] leading-relaxed text-zinc-500">{AFFILIATE_EARNINGS_SUMMARY.timingNote}</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <section>
        <h3 className="text-sm font-semibold text-zinc-900">{AFFILIATE_RECURRING_COMMISSION_COPY.title}</h3>
        <p className="mt-1.5 text-sm leading-relaxed text-zinc-600">{AFFILIATE_RECURRING_COMMISSION_COPY.lead}</p>
        <RateTable title="Monthly subscriber track" rows={AFFILIATE_RECURRING_COMMISSION_COPY.monthlyRows} />
        <RateTable title="Annual subscriber track" rows={AFFILIATE_RECURRING_COMMISSION_COPY.annualRows} />
        <p className="mt-2 text-xs leading-relaxed text-zinc-500">{AFFILIATE_RECURRING_COMMISSION_COPY.billingNote}</p>
        <p className="mt-2 text-xs leading-relaxed text-zinc-500">{AFFILIATE_EARNINGS_SUMMARY.stripeFees}</p>
        <p className="mt-2 text-xs leading-relaxed text-zinc-500">{AFFILIATE_RECURRING_COMMISSION_COPY.holdNote}</p>
        <p className="mt-2 text-xs leading-relaxed text-zinc-500">{AFFILIATE_EARNINGS_SUMMARY.timingNote}</p>
      </section>

      <section>
        <h3 className="text-sm font-semibold text-zinc-900">{AFFILIATE_MILESTONE_COPY.title}</h3>
        <p className="mt-1.5 text-sm leading-relaxed text-zinc-600">{AFFILIATE_MILESTONE_COPY.lead}</p>
        <ul className="mt-3 space-y-2">
          {AFFILIATE_MILESTONE_COPY.tiers.map((t) => (
            <li
              key={t.tier}
              className="rounded-xl border border-zinc-200/90 bg-zinc-50/80 px-3 py-2.5 text-sm"
            >
              <p className="font-semibold text-zinc-900">
                {t.tier} qualified actives · {t.amountLabel}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-zinc-600">{t.qualifier}</p>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h3 className="text-sm font-semibold text-zinc-900">{AFFILIATE_ANNUAL_BONUS_COPY.title}</h3>
        <p className="mt-1.5 text-sm leading-relaxed text-zinc-600">{AFFILIATE_ANNUAL_BONUS_COPY.body}</p>
      </section>
    </div>
  );
}
