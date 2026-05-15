"use client";

import { terminalSurface } from "@/lib/terminalDesignTokens";
import { useSession } from "next-auth/react";
import { useCallback, useEffect, useId, useMemo, useState } from "react";
import type { DailyCallBucket } from "@/lib/performanceSeries";
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

const CHART_HEIGHT_PX = 224;
const CHART_HEIGHT_COMPACT_PX = 158;

/** Primary performance line */
const PERF_LINE = "#22c55e";
/** Win rate: dimmer teal vs performance */
const WIN_LINE = "#2dd4bf";
const WIN_LINE_BRIGHT = "#5eead4";

const UTC_DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

const EMPTY_POINT: RawPoint = { name: "—", multiplier: 0, winRate: 0, calls: 0 };

function aggregateBuckets(parts: DailyCallBucket[], label: string): RawPoint {
  const calls = parts.reduce((s, p) => s + p.calls, 0);
  if (!calls) return { name: label, multiplier: 0, winRate: 0, calls: 0 };
  let sumWeighted = 0;
  let wins = 0;
  let best = 0;
  for (const p of parts) {
    sumWeighted += p.avgX * p.calls;
    wins += p.wins;
    if (p.bestX > best) best = p.bestX;
  }
  return {
    name: label,
    multiplier: sumWeighted / calls,
    winRate: (wins / calls) * 100,
    calls,
  };
}

/** Turn `/api/me/performance-lab` `series14d` into chart datasets (14d is all we have server-side). */
function buildDatasetsFromSeries(series: DailyCallBucket[]): Record<Range, RawPoint[]> {
  if (!Array.isArray(series) || series.length === 0) {
    return {
      W: [{ ...EMPTY_POINT }],
      M: [{ ...EMPTY_POINT }],
      "3M": [{ ...EMPTY_POINT }],
      A: [{ ...EMPTY_POINT }],
    };
  }

  const last7 = series.slice(-7).map((b) => {
    const d = new Date(Number(b.dayKey));
    const name = UTC_DOW[d.getUTCDay()] ?? b.label;
    return {
      name,
      multiplier: b.avgX,
      winRate: b.winRate,
      calls: b.calls,
    };
  });

  const last14 = series.slice(-14);
  const mid = Math.max(1, Math.floor(last14.length / 2));
  const monthPts: RawPoint[] = [];
  if (last14.length) {
    monthPts.push(aggregateBuckets(last14.slice(0, mid), "Early"));
    monthPts.push(aggregateBuckets(last14.slice(mid), "Late"));
  }

  const qPts: RawPoint[] = [];
  const chunks = 3;
  const n = last14.length;
  const step = Math.max(1, Math.ceil(n / chunks));
  for (let i = 0; i < chunks; i++) {
    const chunk = last14.slice(i * step, (i + 1) * step);
    if (chunk.length) qPts.push(aggregateBuckets(chunk, `P${i + 1}`));
  }

  const allPt = last14.length ? [aggregateBuckets(last14, "14d")] : [{ ...EMPTY_POINT }];

  return {
    W: last7.length ? last7 : [{ ...EMPTY_POINT }],
    M: monthPts.length ? monthPts : [{ ...EMPTY_POINT }],
    "3M": qPts.length ? qPts : monthPts.length ? monthPts : [{ ...EMPTY_POINT }],
    A: allPt,
  };
}

function formatNowAxisLabel(now: Date): string {
  return now.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * Chart datasets are already bounded server-side (e.g. last 7 UTC days, or 2–3
 * aggregate buckets). Do **not** slice by local weekday/month — that assumed
 * array indices lined up with calendar weeks and hid all real points at the end.
 */
function buildVisibleSliceRows(full: RawPoint[], _range: Range, now: Date): SliceRow[] {
  if (full.length === 0) return [];
  const sliced = full.map((r) => ({
    ...r,
    originalName: r.name,
  }));
  const axisLabel = formatNowAxisLabel(now);
  const last = sliced.length - 1;
  sliced[last] = {
    ...sliced[last]!,
    name: axisLabel,
    originalName: sliced[last]!.originalName,
  };
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

const gridStroke = "rgba(63,63,70,0.22)";

export default function PerformanceChart({
  refreshNonce = 0,
  compact = false,
}: {
  /** Bump from parent after submit-call etc. so charts refetch. */
  refreshNonce?: number;
  /** Tighter padding + shorter charts (e.g. home dashboard hero). */
  compact?: boolean;
}) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const { status } = useSession();
  const [range, setRange] = useState<Range>("W");
  const [clock, setClock] = useState(0);
  const [datasets, setDatasets] = useState<Record<Range, RawPoint[]> | null>(null);

  const loadSeries = useCallback(async () => {
    if (status !== "authenticated") {
      setDatasets(null);
      return;
    }
    try {
      const res = await fetch("/api/me/performance-lab", { credentials: "same-origin" });
      const json = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        series14d?: DailyCallBucket[];
      };
      if (!res.ok || json.success !== true || !Array.isArray(json.series14d)) {
        setDatasets(null);
        return;
      }
      setDatasets(buildDatasetsFromSeries(json.series14d));
    } catch {
      setDatasets(null);
    }
  }, [status]);

  useEffect(() => {
    void loadSeries();
  }, [loadSeries, refreshNonce]);

  useEffect(() => {
    const id = window.setInterval(() => setClock((c) => c + 1), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const fullForRange = datasets?.[range] ?? [{ ...EMPTY_POINT }];

  const visibleSlice = useMemo(
    () => buildVisibleSliceRows(fullForRange, range, new Date()),
    [fullForRange, range, clock],
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

  const pulseStats = useMemo(() => {
    const meaningful = visibleSlice.filter(
      (r) => r.calls > 0 || r.multiplier > 0 || r.winRate > 0,
    );
    if (meaningful.length === 0) {
      return {
        hasActivity: false as const,
        totalCalls: 0,
        peakLabel: "",
        peakMult: 0,
        winDelta: 0,
      };
    }
    let peakMult = 0;
    let peakLabel = "";
    for (const r of visibleSlice) {
      if (r.multiplier > peakMult) {
        peakMult = r.multiplier;
        peakLabel = r.originalName;
      }
    }
    const totalCalls = visibleSlice.reduce((s, r) => s + r.calls, 0);
    const firstWin = visibleSlice[0]?.winRate ?? 0;
    const lastWin = visibleSlice[visibleSlice.length - 1]?.winRate ?? 0;
    const winDelta = lastWin - firstWin;
    return {
      hasActivity: true as const,
      totalCalls,
      peakLabel,
      peakMult,
      winDelta,
    };
  }, [visibleSlice]);

  const chartHeightPx = compact ? CHART_HEIGHT_COMPACT_PX : CHART_HEIGHT_PX;
  const axisTickSize = compact ? 10 : 11;
  const axisTickStyle = { fill: "rgba(161,161,170,0.62)", fontSize: axisTickSize };

  const gradPerfAvg = `perfAvgFill-${uid}`;
  const gradPerfBest = `perfBestFill-${uid}`;
  const gradWin = `winFill-${uid}`;

  const chartMargin = compact
    ? { top: 6, right: 6, left: 0, bottom: 0 }
    : { top: 10, right: 10, left: 0, bottom: 2 };

  const outerClass = compact
    ? "relative overflow-hidden rounded-2xl border border-zinc-800/90 bg-zinc-950/40 py-4 shadow-xl shadow-black/35 ring-1 ring-zinc-800/45 sm:py-5"
    : "relative overflow-hidden rounded-2xl border border-zinc-800/90 bg-zinc-950/40 py-7 shadow-2xl shadow-black/40 ring-1 ring-zinc-800/45 sm:py-8";

  const headerGap = compact ? "gap-3 sm:gap-4" : "gap-4 sm:gap-6";
  const titleClass = compact
    ? "mt-1.5 text-base font-semibold tracking-tight text-white sm:text-lg"
    : "mt-2 text-lg font-semibold tracking-tight text-white sm:text-xl";
  const badgeRowClass = compact ? "mt-2 flex flex-wrap items-center gap-2 text-xs" : "mt-3 flex flex-wrap items-center gap-2 text-xs";
  const gridClass = compact
    ? "mt-4 grid min-w-0 grid-cols-1 gap-3 sm:gap-4 lg:grid-cols-2"
    : "mt-6 grid min-w-0 grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-2";
  const innerPad = compact
    ? `p-3 sm:p-4 ${terminalSurface.insetEdgeSoft}`
    : `p-4 sm:p-5 ${terminalSurface.insetEdgeSoft}`;

  const yAxisWidth = compact ? 32 : 38;
  const rangeBtnPad = compact ? "px-1.5 py-0.5" : "px-2 py-1";

  const winDriftLabel =
    !pulseStats.hasActivity
      ? "—"
      : Math.abs(pulseStats.winDelta) < 0.5
        ? "Flat"
        : `${pulseStats.winDelta >= 0 ? "+" : ""}${Math.round(pulseStats.winDelta)} pts`;

  return (
    <div className={outerClass}>
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(34,197,94,0.10),transparent_55%),radial-gradient(circle_at_85%_10%,rgba(45,212,191,0.08),transparent_60%)]"
        aria-hidden
      />
      <div className="relative mx-auto w-full max-w-[1200px] px-5 sm:px-6">
        <div
          className={`flex w-full flex-col pr-0 sm:flex-row sm:items-start sm:justify-between ${headerGap}`}
        >
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-zinc-500">
              {compact ? "Live momentum" : "Terminal performance"}
            </p>
            <h2 className={titleClass}>
              {compact ? "What your calls are doing" : "Your edge, quantified"}
            </h2>
            <div className={badgeRowClass}>
              <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-1 font-semibold text-emerald-200/90">
                Avg&nbsp;<span className="tabular-nums text-emerald-100">{currentPerf.toFixed(1)}×</span>
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-cyan-500/25 bg-cyan-500/10 px-2.5 py-1 font-semibold text-cyan-200/90">
                Win&nbsp;<span className="tabular-nums text-cyan-100">{Math.round(currentWin)}%</span>
              </span>
              <span className="text-zinc-500">
                {range === "W" ? "Week view" : range === "M" ? "Month view" : range === "3M" ? "Quarter view" : "All time"}
              </span>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1 rounded-xl border border-white/10 bg-white/5 p-1">
            {(["W", "M", "3M", "A"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setRange(t)}
                className={`rounded-md text-xs transition-all ${rangeBtnPad} ${
                  range === t
                    ? "border border-emerald-500/25 bg-emerald-500/15 font-semibold text-emerald-200"
                    : "text-zinc-500 hover:bg-white/5 hover:text-zinc-100"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {compact && datasets !== null ? (
          <div
            className="mt-3 grid min-w-0 gap-2 sm:grid-cols-3"
            aria-label="Momentum summary for the selected range"
          >
            {pulseStats.hasActivity ? (
              <>
                <div className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2">
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                    Calls in view
                  </div>
                  <div className="mt-0.5 text-lg font-bold tabular-nums text-white">
                    {pulseStats.totalCalls}
                  </div>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2">
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                    Hottest slice
                  </div>
                  <div className="mt-0.5 truncate text-sm font-semibold text-zinc-100">
                    {pulseStats.peakLabel || "—"}
                  </div>
                  <div className="text-xs tabular-nums text-emerald-300/90">
                    {pulseStats.peakMult > 0 ? `${pulseStats.peakMult.toFixed(1)}× avg` : "—"}
                  </div>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2">
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                    Win drift
                  </div>
                  <div className="mt-0.5 text-lg font-bold tabular-nums text-cyan-200/95">
                    {winDriftLabel}
                  </div>
                  <div className="text-[10px] text-zinc-500">First → last in range</div>
                </div>
              </>
            ) : (
              <div className="sm:col-span-3 rounded-xl border border-dashed border-zinc-700/80 bg-black/20 px-3 py-2.5 text-xs leading-snug text-zinc-400">
                No calls in this window yet. Submit a call to see your tape light up.
              </div>
            )}
          </div>
        ) : null}

        <div className={gridClass}>
        {/* Performance */}
        <div
          className={`flex min-h-0 min-w-0 flex-col gap-2 rounded-2xl border border-zinc-800/55 bg-black/20 ${innerPad}`}
        >
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
            style={{ height: chartHeightPx, minHeight: chartHeightPx }}
          >
            <ResponsiveContainer width="100%" height={chartHeightPx}>
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
                <CartesianGrid stroke={gridStroke} strokeDasharray="2 8" />
                <XAxis
                  dataKey="name"
                  tick={axisTickStyle}
                  tickLine={false}
                  axisLine={false}
                  interval="preserveStartEnd"
                  tickMargin={10}
                />
                <YAxis
                  width={yAxisWidth}
                  tick={axisTickStyle}
                  tickLine={false}
                  axisLine={false}
                  domain={["auto", "auto"]}
                  ticks={performanceTicks}
                  tickFormatter={(v: number) => `${v}x`}
                  tickMargin={8}
                />
                <Tooltip
                  cursor={{ stroke: "rgba(148,163,184,0.18)", strokeWidth: 1 }}
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    const row = payload[0]?.payload as PerformanceRow;
                    const heading = row.originalName
                      ? `${row.originalName} · ${label}`
                      : String(label);
                    return (
                      <div className="rounded-xl border border-zinc-800/80 bg-black/80 px-3 py-2 text-xs shadow-2xl shadow-black/60 backdrop-blur">
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
                  isAnimationActive={false}
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
                          style={{ filter: "blur(6px)" }}
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
                  isAnimationActive={false}
                  style={{
                    filter: "drop-shadow(0 0 8px rgba(34,197,94,0.45))",
                  }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Win rate */}
        <div
          className={`flex min-h-0 min-w-0 flex-col gap-2 rounded-2xl border border-zinc-800/55 bg-black/20 ${innerPad}`}
        >
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
            style={{ height: chartHeightPx, minHeight: chartHeightPx }}
          >
            <ResponsiveContainer width="100%" height={chartHeightPx}>
              <ComposedChart data={winRateData} margin={chartMargin}>
                <defs>
                  <linearGradient id={gradWin} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={WIN_LINE} stopOpacity={0.22} />
                    <stop offset="70%" stopColor={WIN_LINE} stopOpacity={0.05} />
                    <stop offset="100%" stopColor={WIN_LINE} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke={gridStroke} strokeDasharray="2 8" />
                <XAxis
                  dataKey="name"
                  tick={axisTickStyle}
                  tickLine={false}
                  axisLine={false}
                  interval="preserveStartEnd"
                  tickMargin={10}
                />
                <YAxis
                  width={yAxisWidth}
                  tick={axisTickStyle}
                  tickLine={false}
                  axisLine={false}
                  domain={[0, 100]}
                  ticks={[0, 50, 100]}
                  tickFormatter={(v: number) => `${v}%`}
                  tickMargin={8}
                />
                <Tooltip
                  cursor={{ stroke: "rgba(148,163,184,0.18)", strokeWidth: 1 }}
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    const row = payload[0]?.payload as WinRateRow;
                    const heading = row.originalName
                      ? `${row.originalName} · ${label}`
                      : String(label);
                    return (
                      <div className="rounded-xl border border-zinc-800/80 bg-black/80 px-3 py-2 text-xs shadow-2xl shadow-black/60 backdrop-blur">
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
                          style={{ filter: "blur(6px)" }}
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
                  isAnimationActive={false}
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
