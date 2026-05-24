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
};

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
      ? "border-sky-400/55 ring-1 ring-sky-400/30"
      : "border-zinc-800/80 hover:border-sky-500/35"
    : selected
      ? "border-emerald-400/50 ring-1 ring-emerald-400/25"
      : "border-zinc-800/80 hover:border-zinc-600/70";

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`flex h-full flex-col rounded-2xl border bg-zinc-950/60 p-5 text-left transition duration-200 ${shell}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p
            className={`text-[10px] font-bold uppercase tracking-[0.2em] ${
              isPro ? "text-sky-400" : "text-zinc-500"
            }`}
          >
            {meta.title}
          </p>
          {fromUsd != null ? (
            <p className="mt-2 text-2xl font-bold tabular-nums tracking-tight text-zinc-50">
              {formatUsd(fromUsd)}
              <span className="ml-1 text-sm font-medium text-zinc-500">/mo</span>
            </p>
          ) : null}
          <p className="mt-2 text-sm text-zinc-400">{meta.tagline}</p>
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

      <ul className="mt-4 space-y-2 border-t border-zinc-800/60 pt-4">
        {highlights.map((line) => (
          <li key={line} className="flex items-start gap-2 text-sm text-zinc-400">
            <span className={`shrink-0 ${isPro ? "text-sky-400" : "text-emerald-400"}`} aria-hidden>
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
}: MembershipProductCompareProps) {
  return (
    <section className="w-full" aria-labelledby="membership-compare-heading">
      <h2
        id="membership-compare-heading"
        className="text-lg font-semibold tracking-tight text-zinc-50 sm:text-xl"
      >
        1. Choose Basic or Pro
      </h2>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
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
