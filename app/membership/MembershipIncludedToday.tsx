"use client";

import {
  BASIC_DAILY_CALLS_LIMIT,
  MEMBERSHIP_TIER_FEATURES,
  type ProductTier,
  type TierFeatureValue,
} from "@/lib/subscription/planTiers";

function cellLabel(value: TierFeatureValue, tier: ProductTier): string {
  if (value === true) return "Included";
  if (value === false) return "—";
  if (value === "10_per_day") {
    return tier === "basic" ? `${BASIC_DAILY_CALLS_LIMIT}/day` : "Unlimited";
  }
  if (value === "limited") {
    return tier === "basic" ? "Limited" : "Full";
  }
  return "—";
}

function cellIncluded(value: TierFeatureValue, tier: ProductTier): boolean {
  if (tier === "pro") return value !== false;
  return value === true || value === "limited" || value === "10_per_day";
}

function FeatureMatrix() {
  return (
    <>
      <div className="mt-4 overflow-x-auto sm:mt-5">
        <table className="w-full min-w-[280px] border-collapse text-left text-xs sm:text-sm">
          <thead>
            <tr className="border-b border-zinc-800/80 text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-500">
              <th className="py-2 pr-3 font-semibold">Feature</th>
              <th className="px-2 py-2 text-center font-semibold text-emerald-400/90">Basic</th>
              <th className="py-2 pl-2 text-center font-semibold text-sky-400/90">Pro</th>
            </tr>
          </thead>
          <tbody>
            {MEMBERSHIP_TIER_FEATURES.map((row) => (
              <tr key={row.label} className="border-b border-zinc-800/50 last:border-0">
                <td className="py-2.5 pr-3 text-zinc-300">{row.label}</td>
                <td className="px-2 py-2.5 text-center">
                  <span
                    className={
                      cellIncluded(row.basic, "basic")
                        ? "font-medium text-emerald-200/90"
                        : "text-zinc-600"
                    }
                  >
                    {cellLabel(row.basic, "basic")}
                  </span>
                </td>
                <td className="py-2.5 pl-2 text-center">
                  <span
                    className={
                      cellIncluded(row.pro, "pro")
                        ? "font-medium text-sky-200/90"
                        : "text-zinc-600"
                    }
                  >
                    {cellLabel(row.pro, "pro")}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 rounded-xl border border-emerald-500/25 bg-emerald-500/8 px-3 py-2.5 text-xs leading-relaxed text-emerald-100/90 sm:mt-5 sm:px-4 sm:py-3 sm:text-sm">
        <p className="font-semibold text-emerald-50">Personal alerts — inbox on Basic, DMs on Pro</p>
        <p className="mt-1 text-emerald-100/85">
          Rules for followed callers, price moves, and thresholds land in your bell inbox. Pro mirrors the
          same hit to Discord DMs (toggle when you create an alert).
        </p>
      </div>
    </>
  );
}

export function MembershipIncludedToday() {
  return (
    <>
      {/* Mobile: collapsed by default */}
      <details className="group mx-auto w-full max-w-3xl rounded-xl border border-zinc-800/80 bg-zinc-950/50 p-3 ring-1 ring-white/[0.03] md:hidden">
        <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p
                id="membership-included-heading-mobile"
                className="text-xs font-semibold tracking-tight text-zinc-100"
              >
                Compare all features
              </p>
              <p className="mt-1 text-[11px] leading-relaxed text-zinc-500">
                Full Basic vs Pro matrix — same as checkout.
              </p>
            </div>
            <span
              className="shrink-0 text-[10px] font-medium uppercase tracking-wider text-zinc-500 group-open:hidden"
              aria-hidden
            >
              Expand
            </span>
            <span
              className="hidden shrink-0 text-[10px] font-medium uppercase tracking-wider text-zinc-500 group-open:inline"
              aria-hidden
            >
              Collapse
            </span>
          </div>
        </summary>
        <FeatureMatrix />
      </details>

      {/* Desktop: always expanded */}
      <section
        className="mx-auto hidden w-full max-w-3xl rounded-2xl border border-zinc-800/80 bg-zinc-950/50 p-5 ring-1 ring-white/[0.03] sm:p-6 md:block"
        aria-labelledby="membership-included-heading"
      >
        <h2
          id="membership-included-heading"
          className="text-center text-sm font-semibold tracking-tight text-zinc-100 sm:text-base"
        >
          What&apos;s included today
        </h2>
        <p className="mx-auto mt-2 max-w-lg text-center text-xs leading-relaxed text-zinc-500 sm:text-sm">
          Live on the terminal now. No mockups — this is the real feature matrix from checkout.
        </p>
        <FeatureMatrix />
      </section>
    </>
  );
}
