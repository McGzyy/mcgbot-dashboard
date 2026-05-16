"use client";

import {
  MEMBERSHIP_TIER_FEATURES,
  TIER_MARKETING,
  type ProductTier,
} from "@/lib/subscription/planTiers";

function FeatureCell({ value }: { value: boolean | "limited" }) {
  if (value === true) {
    return (
      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-300">
        ✓
      </span>
    );
  }
  if (value === "limited") {
    return <span className="text-[11px] font-medium text-amber-200/90">Limited</span>;
  }
  return <span className="text-zinc-600">—</span>;
}

function TierCard({ tier }: { tier: ProductTier }) {
  const meta = TIER_MARKETING[tier];
  const border =
    tier === "pro"
      ? "border-sky-500/35 bg-[linear-gradient(165deg,rgba(14,116,144,0.18)_0%,rgba(0,0,0,0.45)_100%)]"
      : "border-zinc-800/90 bg-[linear-gradient(165deg,rgba(39,39,42,0.55)_0%,rgba(0,0,0,0.42)_100%)]";

  return (
    <div className={`rounded-2xl border p-5 sm:p-6 ${border}`}>
      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">{meta.title}</p>
      <p className="mt-2 text-sm leading-relaxed text-zinc-300">{meta.tagline}</p>
      <ul className="mt-5 space-y-2.5">
        {MEMBERSHIP_TIER_FEATURES.map((row) => (
          <li key={`${tier}-${row.label}`} className="flex items-start gap-3 text-sm">
            <span className="mt-0.5 shrink-0">
              <FeatureCell value={row[tier]} />
            </span>
            <span className="text-zinc-400">{row.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Product-first Basic vs Pro comparison — billing cadence is chosen below. */
export function MembershipProductCompare() {
  return (
    <section className="mx-auto w-full max-w-5xl">
      <div className="text-center">
        <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-zinc-500">
          What you get
        </p>
        <h2 className="mt-2 text-xl font-semibold tracking-tight text-zinc-50 sm:text-2xl">
          Basic vs Pro
        </h2>
        <p className="mx-auto mt-2 max-w-2xl text-sm leading-relaxed text-zinc-400">
          Basic is full desk membership. Pro adds features that use ongoing API and credit spend.
          Choose your billing period in the next step — annual and multi-month plans show savings there.
        </p>
      </div>
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <TierCard tier="basic" />
        <TierCard tier="pro" />
      </div>
    </section>
  );
}
