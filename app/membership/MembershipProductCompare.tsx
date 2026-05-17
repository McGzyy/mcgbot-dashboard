"use client";

import {
  BASIC_DAILY_CALLS_LIMIT,
  MEMBERSHIP_TIER_FEATURES,
  TIER_MARKETING,
  type ProductTier,
  type TierFeatureValue,
} from "@/lib/subscription/planTiers";

type MembershipProductCompareProps = {
  productLine: ProductTier;
  onProductLineChange: (line: ProductTier) => void;
};

function FeatureCell({ value }: { value: TierFeatureValue }) {
  if (value === true) {
    return (
      <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/20 text-[11px] font-bold text-emerald-300">
        ✓
      </span>
    );
  }
  if (value === "10_per_day") {
    return (
      <span className="text-[10px] font-semibold uppercase tracking-wide text-amber-200/90">
        {BASIC_DAILY_CALLS_LIMIT}/day
      </span>
    );
  }
  if (value === "limited") {
    return <span className="text-[10px] font-semibold uppercase tracking-wide text-amber-200/90">Limited</span>;
  }
  return <span className="text-zinc-600">—</span>;
}

function TierCard({
  tier,
  selected,
  onSelect,
}: {
  tier: ProductTier;
  selected: boolean;
  onSelect: () => void;
}) {
  const meta = TIER_MARKETING[tier];
  const isPro = tier === "pro";

  const shell = isPro
    ? selected
      ? "border-sky-400/50 bg-[linear-gradient(165deg,rgba(14,116,144,0.28)_0%,rgba(9,9,11,0.92)_55%)] shadow-[0_0_0_1px_rgba(56,189,248,0.35),0_24px_80px_-24px_rgba(14,165,233,0.35)]"
      : "border-sky-500/25 bg-[linear-gradient(165deg,rgba(14,116,144,0.14)_0%,rgba(9,9,11,0.88)_55%)] hover:border-sky-400/35"
    : selected
      ? "border-emerald-400/45 bg-[linear-gradient(165deg,rgba(16,185,129,0.12)_0%,rgba(9,9,11,0.92)_55%)] shadow-[0_0_0_1px_rgba(52,211,153,0.28)]"
      : "border-zinc-800/80 bg-[linear-gradient(165deg,rgba(39,39,42,0.35)_0%,rgba(9,9,11,0.88)_55%)] hover:border-zinc-600/70";

  const checkRing = isPro
    ? "border-sky-300/70 bg-sky-400/25 text-sky-50"
    : "border-emerald-300/70 bg-emerald-400/25 text-emerald-50";

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`group relative flex h-full flex-col rounded-2xl border p-5 text-left transition duration-200 sm:p-6 ${shell}`}
    >
      {isPro ? (
        <span className="absolute -top-px left-1/2 -translate-x-1/2 rounded-b-lg border border-sky-400/30 border-t-0 bg-sky-500/20 px-3 py-0.5 text-[9px] font-bold uppercase tracking-[0.18em] text-sky-100">
          Full stack
        </span>
      ) : null}

      <div className="flex items-start justify-between gap-3">
        <div>
          <p
            className={`text-[10px] font-bold uppercase tracking-[0.22em] ${
              isPro ? "text-sky-400/90" : "text-zinc-500"
            }`}
          >
            {meta.title}
          </p>
          <p className="mt-2 text-sm leading-relaxed text-zinc-200">{meta.tagline}</p>
        </div>
        <span
          className={`mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition ${
            selected ? checkRing : "border-zinc-700/80 bg-zinc-950/60 text-transparent group-hover:border-zinc-500"
          }`}
          aria-hidden
        >
          <span className="text-[11px] font-bold">✓</span>
        </span>
      </div>

      <ul className="mt-5 flex-1 space-y-2 border-t border-white/[0.06] pt-5">
        {MEMBERSHIP_TIER_FEATURES.map((row) => (
          <li key={`${tier}-${row.label}`} className="flex items-center gap-2.5 text-[13px]">
            <span className="shrink-0">
              <FeatureCell value={row[tier]} />
            </span>
            <span className={row[tier] === false ? "text-zinc-600" : "text-zinc-400"}>{row.label}</span>
          </li>
        ))}
      </ul>
    </button>
  );
}

/** Step 1 — interactive Basic vs Pro comparison; billing cadence is step 2 below. */
export function MembershipProductCompare({
  productLine,
  onProductLineChange,
}: MembershipProductCompareProps) {
  return (
    <section className="mx-auto w-full max-w-4xl" aria-labelledby="membership-compare-heading">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-zinc-500">Step 1</p>
          <h2
            id="membership-compare-heading"
            className="mt-1.5 text-xl font-semibold tracking-tight text-zinc-50 sm:text-2xl"
          >
            Choose your tier
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-zinc-500">
            Basic is the full desk. Pro unlocks Outside Calls, social feed, and unlimited desk submissions.
          </p>
        </div>
        <p className="text-xs text-zinc-600 sm:pb-1">Then pick monthly or annual below</p>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <TierCard
          tier="basic"
          selected={productLine === "basic"}
          onSelect={() => onProductLineChange("basic")}
        />
        <TierCard
          tier="pro"
          selected={productLine === "pro"}
          onSelect={() => onProductLineChange("pro")}
        />
      </div>
    </section>
  );
}
