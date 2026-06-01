"use client";

import { DashboardRefreshBar } from "@/app/components/dashboard/DashboardRefreshBar";
import { DashboardWidgetEmpty } from "@/app/components/dashboard/DashboardWidgetEmpty";
import { PerformancePeriodCompare } from "@/app/components/performance/PerformancePeriodCompare";
import { PerformanceWeeklyCard } from "@/app/components/performance/PerformanceWeeklyCard";
import Link from "next/link";
import {
  buildWeeklySummary,
  pickSeriesForWindow,
  type PerformanceLabWindow,
  type PeriodCompare,
} from "@/lib/performanceLabInsights";
import type { DailyCallBucket } from "@/lib/performanceSeries";
import { terminalListRefreshOpacity, terminalListRowBorder } from "@/lib/terminalListRow";
import { terminalChrome, terminalSurface } from "@/lib/terminalDesignTokens";
import { downloadCsv, rowsToCsv } from "@/lib/downloadCsv";
import { useSession } from "next-auth/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type DailyBucket = DailyCallBucket;
type Distribution = { under2: number; twoToFive: number; fivePlus: number; total: number };

type LabPayload = {
  success?: boolean;
  stats?: {
    avgX: number;
    medianX: number;
    winRate: number;
    totalCalls: number;
    callsToday: number;
    callsPriorRollingDay: number;
    activeDaysStreak: number;
    bestX30d: number;
    hitRate2x30d: number;
  };
  series7d?: DailyBucket[];
  series14d?: DailyBucket[];
  series30d?: DailyBucket[];
  periodCompare?: Record<PerformanceLabWindow, PeriodCompare>;
  distribution?: Distribution;
  rank7d?: number | null;
  totalRanked7d?: number;
  error?: string;
};

const LAB_WINDOWS: { id: PerformanceLabWindow; label: string }[] = [
  { id: "7d", label: "7d" },
  { id: "14d", label: "14d" },
  { id: "30d", label: "30d" },
];

const CHART_MARGIN_COMPOSED = { top: 10, right: 10, left: 4, bottom: 6 } as const;
const CHART_MARGIN_DIST = { top: 8, right: 14, left: 6, bottom: 8 } as const;

function ChartSkeleton() {
  return (
    <div className="flex h-full flex-col justify-center gap-3 px-4 py-4" aria-busy>
      <div className="h-3 w-40 animate-pulse rounded bg-zinc-800/70" />
      <div className="h-32 w-full animate-pulse rounded-lg bg-zinc-800/40" />
      <div className="flex justify-between gap-2">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="h-2 flex-1 animate-pulse rounded bg-zinc-800/50" />
        ))}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div
      className={`rounded-2xl p-3 sm:p-3.5 ${terminalSurface.panelCardElevated} ${terminalSurface.insetEdge}`}
    >
      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">{label}</p>
      <p className="mt-1.5 text-[22px] font-bold tabular-nums tracking-tight text-white">{value}</p>
      {hint ? <p className="mt-1 text-[10px] leading-snug text-zinc-500">{hint}</p> : null}
    </div>
  );
}

export default function PerformanceLabPage() {
  const { status } = useSession();
  const [data, setData] = useState<LabPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [window, setWindow] = useState<PerformanceLabWindow>("14d");

  const load = useCallback(async (opts?: { background?: boolean }) => {
    if (status !== "authenticated") return;
    const background = opts?.background === true;
    if (background) setRefreshing(true);
    else {
      setLoading(true);
      setErr(null);
    }
    try {
      const res = await fetch("/api/me/performance-lab", { credentials: "same-origin", cache: "no-store" });
      const json = (await res.json().catch(() => ({}))) as LabPayload;
      if (!res.ok || json.success !== true) {
        setErr(typeof json.error === "string" ? json.error : "Could not load performance.");
        if (!background) setData(null);
        return;
      }
      setData(json);
      setErr(null);
    } catch {
      setErr("Could not load performance.");
      if (!background) setData(null);
    } finally {
      if (background) setRefreshing(false);
      else setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    void load();
  }, [load]);

  const weeklySummary = useMemo(() => {
    const s = data?.stats;
    const periodCompare = data?.periodCompare?.[window] ?? null;
    const dist = data?.distribution;
    if (!s || !periodCompare) return null;
    return buildWeeklySummary({
      stats: s,
      compare: periodCompare,
      rank7d: data?.rank7d ?? null,
      totalRanked7d: data?.totalRanked7d ?? 0,
      distribution: dist,
    });
  }, [data, window]);

  const exportCsv = useCallback(() => {
    if (!data?.stats) return;
    const s = data.stats;
    const compare = data.periodCompare?.[window] ?? null;
    const series = pickSeriesForWindow(data, window);
    const lines: string[] = [];
    lines.push(rowsToCsv(["Metric", "Value"], [
      ["Avg × (all)", s.avgX.toFixed(4)],
      ["Median ×", s.medianX.toFixed(4)],
      ["Win rate (%)", s.winRate.toFixed(2)],
      ["Total calls", s.totalCalls],
      ["Calls (24h)", s.callsToday],
      ["Best × (30d)", s.bestX30d.toFixed(4)],
      ["Hit ≥2× (30d) (%)", s.hitRate2x30d.toFixed(2)],
      ["UTC day streak", s.activeDaysStreak],
      ["7d rank", data.rank7d != null ? String(data.rank7d) : ""],
      ["Total ranked (7d)", data.totalRanked7d ?? 0],
    ]));
    if (compare) {
      lines.push("");
      lines.push(rowsToCsv(
        ["Window", "Period", "Calls", "Avg ×", "Win rate (%)"],
        [
          [window, "Current", compare.current.calls, compare.current.avgX.toFixed(4), compare.current.winRate.toFixed(2)],
          [window, "Prior", compare.prior.calls, compare.prior.avgX.toFixed(4), compare.prior.winRate.toFixed(2)],
          [window, "Delta", compare.delta.calls, compare.delta.avgX.toFixed(4), compare.delta.winRate.toFixed(2)],
        ]
      ));
    }
    if (data.distribution) {
      const d = data.distribution;
      lines.push("");
      lines.push(rowsToCsv(
        ["Distribution bucket", "Count"],
        [
          ["<2×", d.under2],
          ["2–5×", d.twoToFive],
          ["5×+", d.fivePlus],
          ["Total", d.total],
        ]
      ));
    }
    if (series.length > 0) {
      lines.push("");
      lines.push(rowsToCsv(
        ["UTC day", "Calls", "Avg ×", "Best ×", "Wins", "Win rate (%)"],
        series.map((b) => [b.label, b.calls, b.avgX.toFixed(4), b.bestX.toFixed(4), b.wins, b.winRate.toFixed(2)])
      ));
    }
    downloadCsv(
      `performance-lab-${window}-${new Date().toISOString().slice(0, 10)}.csv`,
      lines.join("\r\n")
    );
  }, [data, window]);

  if (status === "loading") {
    return (
      <div className="mx-auto max-w-6xl animate-pulse space-y-4 px-4 py-10">
        <div className="h-10 w-72 rounded-lg bg-zinc-800/60" />
        <div className="grid gap-4 sm:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-28 rounded-2xl bg-zinc-900/40" />
          ))}
        </div>
      </div>
    );
  }

  if (status !== "authenticated") {
    return (
      <div className="mx-auto max-w-lg px-4 py-12">
        <h1 className="text-xl font-semibold tracking-tight text-zinc-50">Performance lab</h1>
        <p className="mt-3 text-sm leading-relaxed text-zinc-500">Sign in with Discord to open your analytics.</p>
        <Link href="/" className="mt-6 inline-flex text-sm font-semibold text-[color:var(--accent)] hover:underline">
          ← Back to dashboard
        </Link>
      </div>
    );
  }

  const s = data?.stats;
  const series = pickSeriesForWindow(data ?? {}, window);
  const dist = data?.distribution;
  const periodCompare = data?.periodCompare?.[window] ?? null;

  const distChart =
    dist && dist.total > 0
      ? [
          { name: "<2×", value: dist.under2, fill: "rgba(239,68,68,0.55)" },
          { name: "2–5×", value: dist.twoToFive, fill: "rgba(251,191,36,0.65)" },
          { name: "5×+", value: dist.fivePlus, fill: "rgba(52,211,153,0.75)" },
        ]
      : [];

  return (
    <div className="mx-auto max-w-6xl px-4 pb-20 pt-4 sm:px-6">
      <header className={`${terminalChrome.headerRule} pb-8 pt-2`} data-tutorial="performance.header">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-emerald-300/80">
              Your terminal
            </p>
            <h1 className="mt-2 bg-gradient-to-r from-white via-emerald-50/95 to-emerald-300/85 bg-clip-text text-3xl font-bold tracking-tight text-transparent sm:text-4xl">
              Performance lab
            </h1>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={exportCsv}
              disabled={loading || !data?.stats}
              className="rounded-lg border border-zinc-700/80 bg-zinc-950/60 px-3 py-1.5 text-xs font-semibold text-zinc-200 transition hover:border-zinc-600 hover:text-white disabled:opacity-50"
            >
              Export CSV
            </button>
            <button
              type="button"
              onClick={() => void load({ background: true })}
              disabled={loading || refreshing}
              className="rounded-lg border border-zinc-700/80 bg-zinc-950/60 px-3 py-1.5 text-xs font-semibold text-zinc-200 transition hover:border-zinc-600 hover:text-white disabled:opacity-50"
            >
              {refreshing ? "Refreshing…" : "Refresh"}
            </button>
          </div>
        </div>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-zinc-400">
          <span className="font-medium text-zinc-200">Proof-of-edge workspace</span> — period compare, shareable
          weekly snapshot, and deeper charts. The home dashboard chart is a quick pulse; the lab is where you
          study trends and export your numbers.{" "}
          <Link href="/calls" className="font-medium text-emerald-300/90 underline-offset-2 hover:underline">
            My Call Log
          </Link>{" "}
          for every row;{" "}
          <Link href="/leaderboard" className="font-medium text-emerald-300/90 underline-offset-2 hover:underline">
            Leaderboards
          </Link>{" "}
          for the full community.
        </p>
      </header>

      <PerformanceWeeklyCard summary={weeklySummary} loading={loading && !weeklySummary} />

      <PerformancePeriodCompare compare={periodCompare} loading={loading && !periodCompare} />

      {err ? (
        <div className="mt-6 rounded-xl border border-red-500/30 bg-red-950/20 px-4 py-3 text-sm text-red-200">{err}</div>
      ) : null}

      <div
        className={`mt-7 grid gap-2.5 sm:grid-cols-2 sm:gap-3 lg:grid-cols-4 ${terminalListRefreshOpacity(refreshing && !!s)}`}
        data-tutorial="performance.summary"
      >
        <StatCard
          label="Avg × (all)"
          value={loading ? "…" : s ? s.avgX.toFixed(2) + "×" : "—"}
          hint="Mean ATH multiple (peak since call ÷ MC at call)"
        />
        <StatCard
          label="Median ×"
          value={loading ? "…" : s ? s.medianX.toFixed(2) + "×" : "—"}
          hint="Robust center (ATH)"
        />
        <StatCard
          label="Win rate"
          value={loading ? "…" : s ? `${s.winRate.toFixed(0)}%` : "—"}
          hint="Share of calls ≥2×"
        />
        <StatCard
          label="7d rank (users)"
          value={
            loading
              ? "…"
              : data?.rank7d != null
                ? `#${data.rank7d}`
                : data?.totalRanked7d === 0
                  ? "—"
                  : "Unranked"
          }
          hint={
            data?.totalRanked7d
              ? `Rolling week · ${data.totalRanked7d} ranked callers`
              : "Same window as leaderboard API"
          }
        />
      </div>

      <div
        className={`mt-3 grid gap-2.5 sm:grid-cols-2 sm:gap-3 lg:grid-cols-5 ${terminalListRefreshOpacity(refreshing && !!s)}`}
      >
        <StatCard label="Total calls" value={loading ? "…" : s ? String(s.totalCalls) : "—"} />
        <StatCard label="Calls (24h)" value={loading ? "…" : s ? String(s.callsToday) : "—"} hint="Rolling day" />
        <StatCard
          label="Best × (30d)"
          value={loading ? "…" : s && s.bestX30d > 0 ? `${s.bestX30d.toFixed(2)}×` : "—"}
        />
        <StatCard
          label="Hit ≥2× (30d)"
          value={loading ? "…" : s ? `${s.hitRate2x30d.toFixed(0)}%` : "—"}
          hint="Last 30 days"
        />
        <StatCard
          label="UTC day streak"
          value={loading ? "…" : s ? String(s.activeDaysStreak) : "—"}
          hint="Consecutive days with a call"
        />
      </div>

      <div className="mt-8 flex flex-wrap items-center justify-between gap-3" data-tutorial="performance.window">
        <div className="flex flex-wrap gap-2">
          {LAB_WINDOWS.map((w) => (
            <button
              key={w.id}
              type="button"
              onClick={() => setWindow(w.id)}
              className={`rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition ${
                window === w.id
                  ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-100 shadow-[0_0_14px_-4px_rgba(16,185,129,0.35)]"
                  : "border-zinc-700/80 bg-zinc-950/50 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200"
              }`}
            >
              {w.label} UTC
            </button>
          ))}
        </div>
        <p className="text-xs text-zinc-500">Charts and compare follow the selected window.</p>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-5">
        <section className="relative lg:col-span-3" data-tutorial="performance.activity">
          <div className={`relative min-w-0 ${terminalSurface.dashboardListWell}`}>
          <DashboardRefreshBar active={refreshing && series.length > 0} />
          <h2 className="text-base font-semibold tracking-tight text-white">
            Activity · last {window === "7d" ? "7" : window === "30d" ? "30" : "14"} UTC days
          </h2>
          <p className="mt-1 text-xs text-zinc-500">
            Bars = call count per UTC day · line = average ATH multiple that day.
          </p>
          <div
            className={`relative mt-3 h-64 rounded-2xl border border-emerald-500/15 bg-gradient-to-b from-emerald-950/20 to-black/40 p-3 pl-0 ring-1 ring-emerald-500/10 ${terminalListRefreshOpacity(refreshing && series.length > 0)}`}
          >
            {loading && series.length === 0 ? (
              <ChartSkeleton />
            ) : series.length === 0 ? (
              <DashboardWidgetEmpty
                badge="Activity"
                title="No activity in this window"
                description="Once you log calls on the dashboard, you'll see daily bars plus the average multiple line for each UTC day here."
                actionLabel="Open call log"
                actionHref="/calls"
              />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={series} margin={CHART_MARGIN_COMPOSED}>
                  <CartesianGrid stroke="#27272a" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" stroke="#71717a" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis
                    yAxisId="left"
                    stroke="#71717a"
                    tick={{ fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    stroke="#71717a"
                    tick={{ fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#18181b",
                      border: "1px solid rgba(39,39,42,0.9)",
                      borderRadius: 12,
                    }}
                    labelStyle={{ color: "#a1a1aa" }}
                  />
                  <Legend
                    verticalAlign="top"
                    align="right"
                    height={22}
                    wrapperStyle={{ fontSize: 11, paddingBottom: 2 }}
                  />
                  <Bar yAxisId="left" dataKey="calls" name="Calls" fill="rgba(16,185,129,0.35)" radius={[4, 4, 0, 0]} />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="avgX"
                    name="Avg ×"
                    stroke="#5eead4"
                    strokeWidth={2}
                    dot={{ r: 2, fill: "#5eead4" }}
                    activeDot={{ r: 4 }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </div>
          </div>
        </section>

        <section className="relative lg:col-span-2" data-tutorial="performance.distribution">
          <div className={`relative min-w-0 ${terminalSurface.dashboardListWell}`}>
          <DashboardRefreshBar active={refreshing && distChart.length > 0} />
          <h2 className="text-base font-semibold tracking-tight text-white">Multiple mix · all-time tape</h2>
          <p className="mt-1 text-xs text-zinc-500">
            Buckets use ATH multiple since each call (peak ÷ entry MC) across your full eligible history.
          </p>
          <div
            className={`relative mt-3 h-64 rounded-2xl ${terminalListRowBorder} bg-zinc-950/50 p-3 ${terminalListRefreshOpacity(refreshing && distChart.length > 0)}`}
          >
            {loading && distChart.length === 0 ? (
              <ChartSkeleton />
            ) : distChart.length === 0 || !dist || dist.total === 0 ? (
              <DashboardWidgetEmpty
                badge="Mix"
                title="No multiple mix yet"
                description="This chart needs a few logged calls so we can bucket how often you land under 2×, between 2–5×, or 5×+ (ATH vs entry MC)."
                actionLabel="Open call log"
                actionHref="/calls"
              />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={distChart} layout="vertical" margin={CHART_MARGIN_DIST}>
                  <CartesianGrid stroke="#27272a" strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" stroke="#71717a" tick={{ fontSize: 11 }} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" stroke="#71717a" tick={{ fontSize: 11 }} width={52} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#18181b",
                      border: "1px solid rgba(39,39,42,0.9)",
                      borderRadius: 12,
                    }}
                  />
                  <Bar dataKey="value" name="Calls" radius={[0, 6, 6, 0]}>
                    {distChart.map((e, i) => (
                      <Cell key={i} fill={e.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
          </div>
        </section>
      </div>
    </div>
  );
}
