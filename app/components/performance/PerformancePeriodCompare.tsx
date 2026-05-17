"use client";

import type { PeriodCompare } from "@/lib/performanceLabInsights";
import { performanceLabWindowDays } from "@/lib/performanceLabInsights";

function DeltaPill({ label, value, format }: { label: string; value: number; format: "calls" | "x" | "pct" }) {
  const neutral = !Number.isFinite(value) || Math.abs(value) < (format === "calls" ? 0.5 : 0.05);
  const up = value > 0;
  const text =
    format === "calls"
      ? `${value > 0 ? "+" : ""}${Math.round(value)}`
      : format === "pct"
        ? `${value > 0 ? "+" : ""}${value.toFixed(0)}%`
        : `${value > 0 ? "+" : ""}${value.toFixed(2)}×`;

  return (
    <div className="rounded-xl border border-zinc-800/90 bg-zinc-950/50 px-3 py-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">{label}</p>
      <p
        className={`mt-1 text-lg font-bold tabular-nums ${
          neutral ? "text-zinc-300" : up ? "text-emerald-300" : "text-red-300/90"
        }`}
      >
        {neutral ? "—" : text}
      </p>
      <p className="mt-0.5 text-[10px] text-zinc-600">vs prior period</p>
    </div>
  );
}

export function PerformancePeriodCompare({
  compare,
  loading,
}: {
  compare: PeriodCompare | null;
  loading: boolean;
}) {
  const days = compare ? performanceLabWindowDays(compare.window) : 14;

  if (loading && !compare) {
    return (
      <div className="mt-6 grid gap-2.5 sm:grid-cols-3" aria-busy data-tutorial="performance.compare">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-[72px] animate-pulse rounded-xl bg-zinc-900/50" />
        ))}
      </div>
    );
  }

  if (!compare || compare.current.calls === 0) {
    return (
      <div
        className="mt-6 rounded-xl border border-zinc-800/80 bg-zinc-950/40 px-4 py-3 text-sm text-zinc-500"
        data-tutorial="performance.compare"
      >
        Period compare unlocks after you log calls in the last {days} UTC days — your home chart is a quick
        pulse; this block shows whether you&apos;re improving vs the prior {days} days.
      </div>
    );
  }

  return (
    <section className="mt-6" data-tutorial="performance.compare">
      <h2 className="text-sm font-semibold tracking-tight text-white">
        Last {days}d vs prior {days}d
      </h2>
      <p className="mt-1 text-xs text-zinc-500">
        Rolling UTC windows — not the same as the home performance chart ranges.
      </p>
      <div className="mt-3 grid gap-2.5 sm:grid-cols-3">
        <DeltaPill label="Calls" value={compare.delta.calls} format="calls" />
        <DeltaPill label="Avg ×" value={compare.delta.avgX} format="x" />
        <DeltaPill label="Win rate" value={compare.delta.winRate} format="pct" />
      </div>
    </section>
  );
}
