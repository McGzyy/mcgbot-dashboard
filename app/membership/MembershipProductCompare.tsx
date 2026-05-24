"use client";

import {
  TIER_COMPARE_HIGHLIGHTS,
  TIER_MARKETING,
  type ProductTier,
} from "@/lib/subscription/planTiers";
import { formatUsd } from "@/lib/subscription/planDisplay";

type MembershipProductCompareProps = {
  productLine: ProductTier;
  onProductLineChange: (line: ProductTier) => void;
  monthlyFromUsd?: Partial<Record<ProductTier, number>>;
  embedded?: boolean;
};

const SECTION_LABEL = "text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500";

function TierCard({
  tier,
  selected,
  onSelect,
  fromUsd,
}: {
  tier: ProductTier;
  selected: boolean;
  onSelect: () => void;
  fromUsd?: number;
}) {
  const meta = TIER_MARKETING[tier];
  const isPro = tier === "pro";
  const highlights = TIER_COMPARE_HIGHLIGHTS[tier].slice(0, isPro ? 4 : 3);

  const shell = isPro
    ? selected
      ? "border-sky-400/45 bg-[linear-gradient(168deg,rgba(14,116,144,0.22)_0%,rgba(9,9,11,0.97)_52%)] shadow-[0_0_0_1px_rgba(56,189,248,0.22)]"
      : "border-zinc-800/65 bg-zinc-950/35 hover:border-sky-500/28 hover:bg-zinc-900/40"
    : selected
      ? "border-emerald-400/40 bg-[linear-gradient(168deg,rgba(16,185,129,0.14)_0%,rgba(9,9,11,0.97)_52%)] shadow-[0_0_0_1px_rgba(52,211,153,0.18)]"
      : "border-zinc-800/65 bg-zinc-950/35 hover:border-zinc-600/55 hover:bg-zinc-900/40";

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`flex h-full flex-col rounded-2xl border p-5 text-left transition duration-200 sm:p-6 ${shell}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p
              className={`text-[10px] font-bold uppercase tracking-[0.2em] ${
                isPro ? "text-sky-400" : "text-zinc-500"
              }`}
            >
              {meta.title}
            </p>
            {isPro ? (
              <span className="rounded-full border border-sky-400/25 bg-sky-500/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-sky-200/90">
                Full desk
              </span>
            ) : null}
          </div>
          {fromUsd != null ? (
            <p className="mt-3 text-[1.65rem] font-bold tabular-nums leading-none tracking-tight text-zinc-50 sm:text-3xl">
              {formatUsd(fromUsd)}
              <span className="ml-1.5 text-sm font-medium text-zinc-500">/mo</span>
            </p>
          ) : null}
          <p className="mt-2.5 text-[13px] leading-snug text-zinc-400">{meta.tagline}</p>
        </div>
        <span
          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${
            selected
              ? isPro
                ? "border-sky-300/70 bg-sky-500/25 text-sky-50"
                : "border-emerald-300/70 bg-emerald-500/25 text-emerald-50"
              : "border-zinc-700 bg-zinc-900 text-transparent"
          }`}
          aria-hidden
        >
          <span className="text-[11px] font-bold">✓</span>
        </span>
      </div>

      <ul className="mt-5 space-y-2.5 border-t border-zinc-800/55 pt-5">
        {highlights.map((line) => (
          <li key={line} className="flex items-start gap-2.5 text-[13px] leading-snug text-zinc-400">
            <span
              className={`mt-0.5 shrink-0 text-[11px] ${isPro ? "text-sky-400/90" : "text-emerald-400/90"}`}
              aria-hidden
            >
              ✓
            </span>
            <span>{line}</span>
          </li>
        ))}
      </ul>
    </button>
  );
}

export function MembershipProductCompare({
  productLine,
  onProductLineChange,
  monthlyFromUsd,
  embedded = false,
}: MembershipProductCompareProps) {
  return (
    <section className="w-full" aria-labelledby="membership-compare-heading">
      <h2 id="membership-compare-heading" className={embedded ? SECTION_LABEL : "text-lg font-semibold tracking-tight text-zinc-50 sm:text-xl"}>
        {embedded ? "Tier" : "Basic or Pro"}
      </h2>
      {!embedded ? (
        <p className="mt-1 text-sm text-zinc-500">Same Discord login — upgrade anytime.</p>
      ) : null}

      <div className={`grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 ${embedded ? "mt-4" : "mt-5"}`}>
        <TierCard
          tier="basic"
          selected={productLine === "basic"}
          onSelect={() => onProductLineChange("basic")}
          fromUsd={monthlyFromUsd?.basic}
        />
        <TierCard
          tier="pro"
          selected={productLine === "pro"}
          onSelect={() => onProductLineChange("pro")}
          fromUsd={monthlyFromUsd?.pro}
        />
      </div>
    </section>
  );
}
