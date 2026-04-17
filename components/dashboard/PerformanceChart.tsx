"use client";

import { useEffect, useId, useMemo, useState } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Range = "W" | "M" | "3M" | "A";

type RawPoint = {
  name: string;
  multiplier: number;
  winRate: number;
  calls: number;
};

type SliceRow = RawPoint & { originalName: string };

type PerformanceRow = {
  name: string;
  originalName?: string;
  multiplier: number;
  bestMultiplier: number;
};

type WinRateRow = {
  name: string;
  originalName?: string;
  winRate: number;
};

const CHART_HEIGHT_PX = 200;

/** Primary performance line */
const PERF_LINE = "#22c55e";
/** Win rate: dimmer teal vs performance */
const WIN_LINE = "#2dd4bf";
const WIN_LINE_BRIGHT = "#5eead4";

const DATASETS: Record<Range, RawPoint[]> = {
  W: [
    { name: "Mon", multiplier: 2.4, winRate: 52, calls: 12 },
    { name: "Tue", multiplier: 3.1, winRate: 60, calls: 18 },
    { name: "Wed", multiplier: 2.8, winRate: 55, calls: 14 },
    { name: "Thu", multiplier: 3.9, winRate: 66, calls: 22 },
    { name: "Fri", multiplier: 4.6, winRate: 71, calls: 16 },
    { name: "Sat", multiplier: 3.7, winRate: 63, calls: 9 },
    { name: "Sun", multiplier: 4.2, winRate: 68, calls: 19 },
  ],
  M: [
    { name: "W1", multiplier: 2.2, winRate: 48, calls: 9 },
    { name: "W2", multiplier: 2.9, winRate: 54, calls: 15 },
    { name: "W3", multiplier: 3.6, winRate: 58, calls: 12 },
    { name: "W4", multiplier: 3.1, winRate: 52, calls: 20 },
  ],
  "3M": [
    { name: "Jan", multiplier: 2.1, winRate: 44, calls: 11 },
    { name: "Feb", multiplier: 2.8, winRate: 49, calls: 17 },
    { name: "Mar", multiplier: 3.4, winRate: 57, calls: 13 },
    { name: "Apr", multiplier: 3.0, winRate: 53, calls: 21 },
    { name: "May", multiplier: 4.1, winRate: 66, calls: 18 },
    { name: "Jun", multiplier: 3.7, winRate: 61, calls: 24 },
  ],
  A: [
    { name: "2022", multiplier: 2.0, winRate: 41, calls: 8 },
    { name: "2023", multiplier: 2.6, winRate: 46, calls: 14 },
    { name: "2024", multiplier: 3.2, winRate: 55, calls: 19 },
    { name: "2025", multiplier: 3.8, winRate: 62, calls: 23 },
  ],
};

/** Index of the latest included bucket (inclusive). Anchored to calendar "now". */
function getSliceEndIndex(range: Range, now: Date, len: number): number {
  if (len === 0) return 0;
  let end = 0;
  switch (range) {
    case "W": {
      const dow = now.getDay();
      end = dow === 0 ? 6 : dow - 1;
      break;
    }
    case "M": {
      const day = now.getDate();
      end = Math.floor((day - 1) / 7);
      break;
    }
    case "3M": {
      end = now.getMonth();
      break;
    }
    case "A": {
      end = now.getFullYear() - 2022;
      break;
    }
  }
  return Math.max(0, Math.min(end, len - 1));
}

function formatNowAxisLabel(now: Date): string {
  return now.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

function buildVisibleSliceRows(
  full: RawPoint[],
  range: Range,
  now: Date,
): SliceRow[] {
  const end = getSliceEndIndex(range, now, full.length);
  const sliced = full.slice(0, end + 1).map((r) => ({
    ...r,
    originalName: r.name,
  }));
  if (sliced.length === 0) return sliced;
  const axisLabel = formatNowAxisLabel(now);
  const last = sliced.length - 1;
  sliced[last] = { ...sliced[last]!, name: axisLabel, originalName: sliced[last]!.originalName };
  return sliced;
}

function buildPerformanceRows(raw: SliceRow[]): PerformanceRow[] {
  let best = 0;
  return raw.map((r) => {
    best = Math.max(best, r.multiplier);
    return {
      name: r.name,
      originalName: r.originalName,
      multiplier: r.multiplier,
      bestMultiplier: best,
    };
  });
}

function buildWinRateRows(raw: SliceRow[]): WinRateRow[] {
  return raw.map((r) => ({
    name: r.name,
    originalName: r.originalName,
    winRate: r.winRate,
  }));
}

const gridStroke = "rgba(39,39,42,0.32)";
const axisTick = { fill: "rgba(161,161,170,0.55)", fontSize: 10 };

export default function PerformanceChart() {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const [range, setRange] = useState<Range>("W");
  const [clock, setClock] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => setClock((c) => c + 1), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const visibleSlice = useMemo(
    () => buildVisibleSliceRows(DATASETS[range], range, new Date()),
    [range, clock],
  );

  const performanceData = useMemo(
    () => buildPerformanceRows(visibleSlice),
    [visibleSlice],
  );
  const winRateData = useMemo(() => buildWinRateRows(visibleSlice), [visibleSlice]);

  const lastIdx = Math.max(0, performanceData.length - 1);

  const performanceTicks = useMemo(() => {
    if (performanceData.length === 0) return undefined;
    const maxVal = performanceData.reduce(
      (m, r) => Math.max(m, r.multiplier, r.bestMultiplier),
      0,
    );
    const minVal = performanceData.reduce(
      (m, r) => Math.min(m, r.multiplier, r.bestMultiplier),
      Number.POSITIVE_INFINITY,
    );

    const min = Number.isFinite(minVal) ? Math.max(0, Math.floor(minVal)) : 0;
    const max = Number.isFinite(maxVal) ? Math.ceil(maxVal) : 1;
    const mid = Math.round((min + max) / 2);

    const uniq = Array.from(new Set([min, mid, max])).sort((a, b) => a - b);
    return uniq.length >= 2 ? uniq : [min, max];
  }, [performanceData]);

  const currentPerf = performanceData[lastIdx]?.multiplier ?? 0;
  const currentWin = winRateData[lastIdx]?.winRate ?? 0;

  const gradPerfAvg = `perfAvgFill-${uid}`;
  const gradPerfBest = `perfBestFill-${uid}`;
  const gradWin = `winFill-${uid}`;

  const chartMargin = { top: 8, right: 4, left: 0, bottom: 4 };

  return (
    <div className="rounded-xl border border-[#1a1a1a] bg-[#0a0a0a] py-8">
      <div className="mx-auto w-full max-w-[1200px] px-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 pl-3">
            <h2 className="text-lg font-semibold tracking-tight text-white">
              Performance Overview
            </h2>
            <p className="mt-1 text-xs leading-snug text-zinc-500">
              Track your trading performance over time
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1 rounded-lg border border-white/10 bg-white/5 p-1">
            {(["W", "M", "3M", "A"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setRange(t)}
                className={`rounded-md px-2 py-1 text-xs transition-all ${
                  range === t
                    ? "border border-green-500/20 bg-green-500/10 font-semibold text-green-400"
                    : "text-zinc-500 hover:bg-white/5 hover:text-white"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-6 grid min-w-0 grid-cols-2 gap-6">
        {/* Performance */}
        <div className="flex min-h-0 min-w-0 flex-col gap-2 p-4">
          <div className="flex min-h-[2rem] items-center justify-between gap-3">
            <h3 className="shrink-0 text-xs font-semibold tracking-tight text-zinc-400">
              Performance
            </h3>
            <div className="flex min-w-0 flex-wrap items-center justify-end gap-3 text-xs text-zinc-500">
              <span className="inline-flex items-center gap-2">
                <span className="h-2 w-2 shrink-0 rounded-full bg-[#22c55e]" aria-hidden />
                Avg
              </span>
              <span className="inline-flex items-center gap-2">
                <span className="h-2 w-2 shrink-0 rounded-full bg-[rgba(34,197,94,0.35)]" aria-hidden />
                Best
              </span>
              <span className="inline-flex items-center gap-2 tabular-nums font-medium text-white">
                Current {currentPerf.toFixed(1)}x
              </span>
            </div>
          </div>

          <div
            className="w-full min-w-0 shrink-0"
            style={{ height: CHART_HEIGHT_PX, minHeight: CHART_HEIGHT_PX }}
          >
            <ResponsiveContainer width="100%" height={CHART_HEIGHT_PX}>
              <ComposedChart data={performanceData} margin={chartMargin}>
                <defs>
                  <linearGradient id={gradPerfBest} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="rgb(34,197,94)" stopOpacity={0.12} />
                    <stop offset="100%" stopColor="rgb(34,197,94)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id={gradPerfAvg} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={PERF_LINE} stopOpacity={0.28} />
                    <stop offset="70%" stopColor={PERF_LINE} stopOpacity={0.06} />
                    <stop offset="100%" stopColor={PERF_LINE} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke={gridStroke} strokeDasharray="3 3" />
                <XAxis
                  dataKey="name"
                  tick={axisTick}
                  tickLine={false}
                  axisLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  width={34}
                  tick={axisTick}
                  tickLine={false}
                  axisLine={false}
                  domain={["auto", "auto"]}
                  ticks={performanceTicks}
                  tickFormatter={(v: number) => `${v}x`}
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    const row = payload[0]?.payload as PerformanceRow;
                    const heading = row.originalName
                      ? `${row.originalName} · ${label}`
                      : String(label);
                    return (
                      <div className="rounded-lg border border-zinc-800 bg-[#09090b] px-3 py-2 text-xs shadow-xl">
                        <div className="mb-1.5 text-zinc-500">{heading}</div>
                        <div className="flex justify-between gap-6 tabular-nums">
                          <span className="text-zinc-500">Avg</span>
                          <span className="font-semibold text-[#22c55e]">
                            {row.multiplier.toFixed(1)}x
                          </span>
                        </div>
                        <div className="mt-1 flex justify-between gap-6 tabular-nums">
                          <span className="text-zinc-500">Best</span>
                          <span className="font-medium text-zinc-400">
                            {row.bestMultiplier.toFixed(1)}x
                          </span>
                        </div>
                      </div>
                    );
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="bestMultiplier"
                  stroke="none"
                  fill={`url(#${gradPerfBest})`}
                  isAnimationActive={false}
                />
                <Area
                  type="monotone"
                  dataKey="multiplier"
                  stroke="none"
                  fill={`url(#${gradPerfAvg})`}
                  isAnimationActive={false}
                />
                <Line
                  type="monotone"
                  dataKey="bestMultiplier"
                  stroke="rgba(34,197,94,0.28)"
                  strokeWidth={1.25}
                  dot={false}
                  isAnimationActive
                />
                <Line
                  type="monotone"
                  dataKey="multiplier"
                  stroke={PERF_LINE}
                  strokeWidth={2.85}
                  dot={(props) => {
                    const { cx, cy, index, payload } = props as {
                      cx?: number;
                      cy?: number;
                      index?: number;
                      payload?: PerformanceRow;
                    };
                    if (
                      cx == null ||
                      cy == null ||
                      index == null ||
                      index !== lastIdx ||
                      performanceData.length === 0
                    ) {
                      return null;
                    }
                    return (
                      <g key={`current-${payload?.originalName ?? index}`}>
                        <circle
                          cx={cx}
                          cy={cy}
                          r={12}
                          fill={PERF_LINE}
                          fillOpacity={0.22}
                          style={{ filter: "blur(4px)" }}
                        />
                        <circle
                          cx={cx}
                          cy={cy}
                          r={7}
                          fill="#4ade80"
                          stroke="#ecfccb"
                          strokeWidth={2}
                          style={{
                            filter: "drop-shadow(0 0 10px rgba(74,222,128,0.95))",
                          }}
                        />
                        <circle
                          cx={cx}
                          cy={cy}
                          r={13}
                          fill="none"
                          stroke="rgba(34,197,94,0.35)"
                          strokeWidth={1}
                        />
                      </g>
                    );
                  }}
                  isAnimationActive
                  style={{
                    filter: "drop-shadow(0 0 8px rgba(34,197,94,0.45))",
                  }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Win rate */}
        <div className="flex min-h-0 min-w-0 flex-col gap-2 border-l border-white/5 p-4 pl-6">
          <div className="flex min-h-[2rem] items-center justify-between gap-3">
            <h3 className="shrink-0 text-xs font-semibold tracking-tight text-zinc-400">
              Win Rate
            </h3>
            <div className="flex shrink-0 flex-wrap items-center justify-end gap-3 text-xs text-zinc-500">
              <span className="inline-flex items-center gap-2 tabular-nums font-medium text-white">
                Current {Math.round(currentWin)}%
              </span>
            </div>
          </div>

          <div
            className="w-full min-w-0 shrink-0"
            style={{ height: CHART_HEIGHT_PX, minHeight: CHART_HEIGHT_PX }}
          >
            <ResponsiveContainer width="100%" height={CHART_HEIGHT_PX}>
              <ComposedChart data={winRateData} margin={chartMargin}>
                <defs>
                  <linearGradient id={gradWin} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={WIN_LINE} stopOpacity={0.22} />
                    <stop offset="70%" stopColor={WIN_LINE} stopOpacity={0.05} />
                    <stop offset="100%" stopColor={WIN_LINE} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke={gridStroke} strokeDasharray="3 3" />
                <XAxis
                  dataKey="name"
                  tick={axisTick}
                  tickLine={false}
                  axisLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  width={34}
                  tick={axisTick}
                  tickLine={false}
                  axisLine={false}
                  domain={[0, 100]}
                  ticks={[0, 50, 100]}
                  tickFormatter={(v: number) => `${v}%`}
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    const row = payload[0]?.payload as WinRateRow;
                    const heading = row.originalName
                      ? `${row.originalName} · ${label}`
                      : String(label);
                    return (
                      <div className="rounded-lg border border-zinc-800 bg-[#09090b] px-3 py-2 text-xs shadow-xl">
                        <div className="mb-1 text-zinc-500">{heading}</div>
                        <div className="flex justify-between gap-6 tabular-nums">
                          <span className="text-zinc-500">Win rate</span>
                          <span className="font-semibold" style={{ color: WIN_LINE }}>
                            {Math.round(row.winRate)}%
                          </span>
                        </div>
                      </div>
                    );
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="winRate"
                  stroke="none"
                  fill={`url(#${gradWin})`}
                  isAnimationActive={false}
                />
                <Line
                  type="monotone"
                  dataKey="winRate"
                  stroke={WIN_LINE}
                  strokeWidth={2.25}
                  dot={(props) => {
                    const { cx, cy, index, payload } = props as {
                      cx?: number;
                      cy?: number;
                      index?: number;
                      payload?: WinRateRow;
                    };
                    if (
                      cx == null ||
                      cy == null ||
                      index == null ||
                      index !== lastIdx ||
                      winRateData.length === 0
                    ) {
                      return null;
                    }
                    return (
                      <g key={`w-current-${payload?.originalName ?? index}`}>
                        <circle
                          cx={cx}
                          cy={cy}
                          r={12}
                          fill={WIN_LINE}
                          fillOpacity={0.28}
                          style={{ filter: "blur(4px)" }}
                        />
                        <circle
                          cx={cx}
                          cy={cy}
                          r={7}
                          fill={WIN_LINE_BRIGHT}
                          stroke="#ccfbf1"
                          strokeWidth={2}
                          style={{
                            filter: "drop-shadow(0 0 10px rgba(94,234,212,0.85))",
                          }}
                        />
                        <circle
                          cx={cx}
                          cy={cy}
                          r={13}
                          fill="none"
                          stroke="rgba(45,212,191,0.35)"
                          strokeWidth={1}
                        />
                      </g>
                    );
                  }}
                  isAnimationActive
                  style={{
                    filter: "drop-shadow(0 0 5px rgba(45,212,191,0.35))",
                  }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}
