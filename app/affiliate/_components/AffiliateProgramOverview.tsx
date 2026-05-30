import {
  AFFILIATE_ANNUAL_BONUS_COPY,
  AFFILIATE_EARNINGS_SUMMARY,
  AFFILIATE_MILESTONE_COPY,
  AFFILIATE_RECURRING_COMMISSION_COPY,
} from "@/lib/affiliate/affiliateEarningsCopy";
import { affiliateCommissionProgramShortLabel } from "@/lib/affiliate/affiliateCommissionSchedule";

const PARTNER_BENEFITS = [
  {
    title: "Tracking & campaigns",
    body: "Personal `/r/` link plus campaign sub-links so you can see which posts convert.",
  },
  {
    title: "Partner dashboard",
    body: "Live clicks, sign-ups, conversion stats, and performance charts after approval.",
  },
  {
    title: "Commission ledger",
    body: "Every rev-share accrual, milestone, and annual bonus — pending, approved, and paid.",
  },
  {
    title: "Payout requests",
    body: "Withdraw approved balance once you hit the minimum; ops reviews in the payouts queue.",
  },
  {
    title: "Brand kit",
    body: "Approved logos, copy snippets, and promotion rules to stay compliant.",
  },
  {
    title: "Secure portal",
    body: "Separate affiliate login with mandatory 2FA — not the member Discord dashboard.",
  },
] as const;

function RateTable({
  title,
  rows,
  compact,
}: {
  title: string;
  rows: readonly { payment: string; rate: string }[];
  compact?: boolean;
}) {
  return (
    <div className={compact ? "mt-2" : "mt-3"}>
      <p className={`font-semibold text-zinc-800 ${compact ? "text-[11px]" : "text-xs"}`}>{title}</p>
      <div className={`overflow-hidden rounded-xl border border-zinc-200 ${compact ? "mt-1.5" : "mt-2"}`}>
        <table className="w-full text-left">
          <thead className="bg-zinc-50 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
            <tr>
              <th className="px-3 py-2">Referred member payment</th>
              <th className="px-3 py-2 text-right">Affiliate earns</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 text-sm">
            {rows.map((row) => (
              <tr key={row.payment}>
                <td className={`px-3 text-zinc-700 ${compact ? "py-2 text-xs" : "py-2.5"}`}>{row.payment}</td>
                <td
                  className={`px-3 text-right font-semibold tabular-nums text-zinc-900 ${compact ? "py-2 text-xs" : "py-2.5"}`}
                >
                  {row.rate}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

type Variant = "marketing" | "admin" | "adminCheatsheet" | "compact";

export function AffiliateProgramOverview({ variant = "marketing" }: { variant?: Variant }) {
  const isAdmin = variant === "admin";
  const isAdminCheatsheet = variant === "adminCheatsheet";
  const isCompact = variant === "compact";
  const programLabel = affiliateCommissionProgramShortLabel();

  if (isCompact) {
    return (
      <div className="space-y-3">
        <p className="text-xs font-semibold text-zinc-900">Standard program · {programLabel}</p>
        <RateTable title="Monthly track" rows={AFFILIATE_RECURRING_COMMISSION_COPY.monthlyRows} compact />
        <p className="text-[11px] leading-relaxed text-zinc-500">{AFFILIATE_EARNINGS_SUMMARY.timingNote}</p>
      </div>
    );
  }

  if (isAdminCheatsheet) {
    return (
      <div className="space-y-3">
        <p className="text-xs leading-relaxed text-zinc-600">{AFFILIATE_RECURRING_COMMISSION_COPY.lead}</p>
        <div className="grid gap-4 lg:grid-cols-2">
          <RateTable title="Monthly track" rows={AFFILIATE_RECURRING_COMMISSION_COPY.monthlyRows} compact />
          <RateTable title="Annual track" rows={AFFILIATE_RECURRING_COMMISSION_COPY.annualRows} compact />
        </div>
        <div className="space-y-1.5 rounded-xl border border-zinc-200/80 bg-zinc-50/80 px-3 py-2.5 text-[11px] leading-relaxed text-zinc-600">
          <p>
            <span className="font-semibold text-zinc-800">Milestones — </span>
            {AFFILIATE_EARNINGS_SUMMARY.milestones}
          </p>
          <p>
            <span className="font-semibold text-zinc-800">Annual bonus — </span>
            {AFFILIATE_ANNUAL_BONUS_COPY.body}
          </p>
          <p>
            <span className="font-semibold text-zinc-800">Hold — </span>
            {AFFILIATE_EARNINGS_SUMMARY.hold}
          </p>
          <p className="text-zinc-500">{AFFILIATE_EARNINGS_SUMMARY.timingNote}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`grid gap-6 ${isAdmin ? "lg:grid-cols-2" : "lg:grid-cols-[1fr_1.1fr]"}`}>
      <div className="space-y-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-violet-700/90">
            {isAdmin ? "Partner package" : "What approved affiliates get"}
          </p>
          <h3 className={`mt-1 font-semibold text-zinc-900 ${isAdmin ? "text-sm" : "text-lg"}`}>
            Tools to promote, track, and get paid
          </h3>
          {!isAdmin ? (
            <p className="mt-2 text-sm leading-relaxed text-zinc-600">
              McGBot Terminal is the paid member product (scanner, desk calls, leaderboards). Affiliates send qualified
              subscribers — not access to this ops portal.
            </p>
          ) : (
            <p className="mt-2 text-xs leading-relaxed text-zinc-600">
              Every approved partner gets the same stack. Commission % is per referred member and unlocks with their
              payment count — not a custom rate on the account row.
            </p>
          )}
        </div>
        <ul className={`grid gap-2 ${isAdmin ? "sm:grid-cols-2" : "sm:grid-cols-2"}`}>
          {PARTNER_BENEFITS.map((b) => (
            <li
              key={b.title}
              className={`rounded-xl border border-zinc-200/90 bg-white px-3 py-2.5 ${isAdmin ? "text-xs" : "text-sm"}`}
            >
              <p className="font-semibold text-zinc-900">{b.title}</p>
              <p className={`mt-1 leading-relaxed text-zinc-600 ${isAdmin ? "text-[11px]" : "text-xs"}`}>
                {b.body}
              </p>
            </li>
          ))}
        </ul>
      </div>

      <div className={`rounded-2xl border border-violet-200/70 bg-gradient-to-br from-violet-50/80 to-white p-4 shadow-sm ${isAdmin ? "sm:p-4" : "sm:p-5"}`}>
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-violet-800/90">
          Payout structure
        </p>
        <h3 className={`mt-1 font-semibold text-zinc-900 ${isAdmin ? "text-sm" : "text-lg"}`}>
          Loyalty rev-share · {programLabel}
        </h3>
        <p className={`mt-2 leading-relaxed text-zinc-600 ${isAdmin ? "text-xs" : "text-sm"}`}>
          {AFFILIATE_RECURRING_COMMISSION_COPY.lead}
        </p>
        <RateTable title="Monthly subscriber track" rows={AFFILIATE_RECURRING_COMMISSION_COPY.monthlyRows} compact={isAdmin} />
        <RateTable title="Annual subscriber track" rows={AFFILIATE_RECURRING_COMMISSION_COPY.annualRows} compact={isAdmin} />
        <div className={`mt-4 space-y-2 rounded-xl border border-zinc-200/80 bg-white/80 px-3 py-2.5 ${isAdmin ? "text-[11px]" : "text-xs"} text-zinc-600`}>
          <p>
            <span className="font-semibold text-zinc-800">Milestones — </span>
            {AFFILIATE_EARNINGS_SUMMARY.milestones}
          </p>
          <p>
            <span className="font-semibold text-zinc-800">Annual signup bonus — </span>
            {AFFILIATE_ANNUAL_BONUS_COPY.body}
          </p>
          <p>
            <span className="font-semibold text-zinc-800">Hold period — </span>
            {AFFILIATE_EARNINGS_SUMMARY.hold}
          </p>
          <p className="text-zinc-500">{AFFILIATE_EARNINGS_SUMMARY.timingNote}</p>
        </div>
        {!isAdmin ? (
          <ul className="mt-4 space-y-2">
            {AFFILIATE_MILESTONE_COPY.tiers.map((t) => (
              <li key={t.tier} className="flex items-start justify-between gap-3 text-xs">
                <span className="text-zinc-700">
                  <span className="font-semibold text-zinc-900">{t.tier} actives</span> — {t.qualifier}
                </span>
                <span className="shrink-0 font-semibold tabular-nums text-violet-800">{t.amountLabel}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}
