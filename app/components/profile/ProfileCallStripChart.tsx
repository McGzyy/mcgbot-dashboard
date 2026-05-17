"use client";

import type { ProfileCallStripPoint } from "@/lib/profileChartData";
import { terminalPage, terminalSurface } from "@/lib/terminalDesignTokens";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const GRID_STROKE = "rgba(63,63,70,0.22)";
const CHART_HEIGHT = 168;

function StripTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload?: ProfileCallStripPoint }[];
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  if (!row) return null;
  return (
    <div className="rounded-xl border border-zinc-800/80 bg-black/85 px-3 py-2 text-xs shadow-2xl shadow-black/60 backdrop-blur">
      <p className="font-medium text-zinc-200">{row.summary}</p>
      <div className="mt-1.5 flex justify-between gap-6 tabular-nums">
        <span className="text-zinc-500">Multiple</span>
        <span className="font-semibold text-emerald-300">{row.multiple.toFixed(1)}×</span>
      </div>
      <div className="mt-1 flex justify-between gap-6 tabular-nums text-zinc-500">
        <span>Called</span>
        <span>{row.timeLabel}</span>
      </div>
    </div>
  );
}

export function ProfileCallStripChart({
  data,
  loading,
}: {
  data: ProfileCallStripPoint[];
  loading?: boolean;
}) {
  if (loading) {
    return (
      <div
        className={`${terminalPage.statTile} flex h-[168px] items-end gap-1.5 p-4`}
        aria-busy
        aria-label="Loading call chart"
      >
        {Array.from({ length: 12 }, (_, i) => (
          <div
            key={i}
            className="flex-1 animate-pulse rounded-t bg-zinc-800/80"
            style={{ height: `${28 + (i % 5) * 14}%` }}
          />
        ))}
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div
        className={`${terminalPage.statTile} flex h-[168px] flex-col items-center justify-center gap-1.5 px-4 text-center`}
      >
        <p className="text-sm font-medium text-zinc-400">No chartable calls yet</p>
        <p className="max-w-xs text-xs text-zinc-600">
          Logged calls with valid multiples appear here as a strip.
        </p>
      </div>
    );
  }

  const maxMultiple = data.reduce((m, r) => Math.max(m, r.multiple), 0);
  const yMax = Math.max(2, Math.ceil(maxMultiple * 1.15));

  return (
    <div className={`${terminalSurface.insetPanel} ${terminalSurface.insetEdgeSoft} p-3 sm:p-4`}>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
        <span>Call # (oldest → newest)</span>
        <span className="inline-flex items-center gap-3 normal-case tracking-normal">
          <span className="inline-flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" aria-hidden />
            ≥2×
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-zinc-400" aria-hidden />
            1–2×
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-red-400" aria-hidden />
            &lt;1×
          </span>
        </span>
      </div>
      <div className="w-full min-w-0" style={{ height: CHART_HEIGHT }}>
        <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
          <BarChart data={data} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
            <CartesianGrid stroke={GRID_STROKE} strokeDasharray="2 8" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fill: "rgba(161,161,170,0.62)", fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              width={34}
              domain={[0, yMax]}
              tick={{ fill: "rgba(161,161,170,0.62)", fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v: number) => `${v}x`}
            />
            <Tooltip
              cursor={{ fill: "rgba(34,211,238,0.06)" }}
              content={<StripTooltip />}
            />
            <ReferenceLine
              y={1}
              stroke="rgba(161,161,170,0.35)"
              strokeDasharray="4 4"
            />
            <ReferenceLine
              y={2}
              stroke="rgba(52,211,153,0.35)"
              strokeDasharray="4 4"
            />
            <Bar dataKey="multiple" radius={[4, 4, 0, 0]} maxBarSize={28}>
              {data.map((entry) => (
                <Cell key={entry.key} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
