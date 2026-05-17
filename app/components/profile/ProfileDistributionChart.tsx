"use client";

import {
  buildProfileDistributionSegments,
  type ProfileDistributionSegment,
} from "@/lib/profileChartData";
import { terminalPage } from "@/lib/terminalDesignTokens";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

function DistributionTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload?: ProfileDistributionSegment & { pct: number } }[];
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  if (!row) return null;
  return (
    <div className="rounded-xl border border-zinc-800/80 bg-black/85 px-3 py-2 text-xs shadow-2xl shadow-black/60 backdrop-blur">
      <p className="font-semibold text-zinc-200">{row.label}</p>
      <p className="mt-1 tabular-nums text-zinc-400">
        {row.count.toLocaleString()} calls · {row.pct}%
      </p>
    </div>
  );
}

export function ProfileDistributionChart({
  distribution,
  loading,
}: {
  distribution?: {
    under1: number;
    oneToTwo: number;
    twoToFive: number;
    fivePlus: number;
    total: number;
  } | null;
  loading?: boolean;
}) {
  const total = distribution?.total ?? 0;
  const segments = distribution
    ? buildProfileDistributionSegments(distribution)
    : buildProfileDistributionSegments({
        under1: 0,
        oneToTwo: 0,
        twoToFive: 0,
        fivePlus: 0,
        total: 0,
      });

  const chartData = segments
    .map((s) => ({
      ...s,
      pct: total > 0 ? Math.round((s.count / total) * 100) : 0,
    }))
    .filter((s) => s.count > 0);

  if (loading) {
    return (
      <div
        className={`mt-3 ${terminalPage.statTile} grid gap-4 p-4 sm:grid-cols-[9.5rem_minmax(0,1fr)]`}
        aria-busy
      >
        <div className="mx-auto h-36 w-36 animate-pulse rounded-full bg-zinc-800/70" />
        <div className="space-y-3">
          {segments.map((s) => (
            <div key={s.key} className="flex items-center gap-3">
              <div className="h-3 w-10 animate-pulse rounded bg-zinc-800/80" />
              <div className="h-2 flex-1 animate-pulse rounded bg-zinc-800/70" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (total <= 0) {
    return (
      <div
        className={`mt-3 ${terminalPage.statTile} flex min-h-[10rem] flex-col items-center justify-center gap-1.5 px-4 py-8 text-center`}
      >
        <p className="text-sm font-medium text-zinc-400">No distribution yet</p>
        <p className="max-w-xs text-xs text-zinc-600">
          Bucket breakdown appears once calls are recorded on this desk.
        </p>
      </div>
    );
  }

  return (
    <div className={`mt-3 ${terminalPage.statTile} p-4`}>
      <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
        {total.toLocaleString()} calls in distribution
      </p>
      <div className="grid gap-5 sm:grid-cols-[minmax(0,10.5rem)_minmax(0,1fr)] sm:items-center">
        <div className="relative mx-auto h-[9.75rem] w-full max-w-[10.5rem]">
          <ResponsiveContainer width="100%" height={156}>
            <PieChart>
              <Pie
                data={chartData.length > 0 ? chartData : [{ ...segments[0], count: 1, pct: 100 }]}
                dataKey="count"
                nameKey="label"
                cx="50%"
                cy="50%"
                innerRadius={46}
                outerRadius={68}
                paddingAngle={2}
                stroke="rgba(9,9,11,0.9)"
                strokeWidth={2}
              >
                {(chartData.length > 0 ? chartData : segments).map((entry) => (
                  <Cell key={entry.key} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip content={<DistributionTooltip />} />
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
              Total
            </p>
            <p className="text-2xl font-bold tabular-nums tracking-tight text-zinc-100">
              {total.toLocaleString()}
            </p>
          </div>
        </div>

        <div className="space-y-2.5">
          {segments.map((s) => {
            const pct = total > 0 ? Math.round((s.count / total) * 100) : 0;
            return (
              <div key={s.key} className="flex items-center gap-3">
                <span
                  className="w-[3.25rem] shrink-0 font-mono text-[11px] font-medium tabular-nums text-zinc-500"
                >
                  {s.label}
                </span>
                <div className="h-2.5 min-w-0 flex-1 overflow-hidden rounded-full bg-black/40 ring-1 ring-zinc-700/35">
                  <div
                    className="h-full rounded-full transition-[width] duration-500 ease-out"
                    style={{
                      width: `${pct}%`,
                      backgroundColor: s.fill,
                      boxShadow: `0 0 16px -4px ${s.fill}55`,
                    }}
                  />
                </div>
                <span className="w-[4.5rem] shrink-0 text-right text-[11px] tabular-nums text-zinc-400">
                  <span className="font-semibold text-zinc-300">{s.count}</span>
                  <span className="text-zinc-600"> · {pct}%</span>
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
