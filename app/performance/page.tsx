"use client";

import Link from "next/link";
import { terminalChrome, terminalSurface } from "@/lib/terminalDesignTokens";
import { useSession } from "next-auth/react";
import { useCallback, useEffect, useState } from "react";
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

type DailyBucket = {
  dayKey: string;
  label: string;
  calls: number;
  avgX: number;
  bestX: number;
  wins?: number;
  winRate?: number;
};
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
  series14d?: DailyBucket[];
  distribution?: Distribution;
  rank7d?: number | null;
  totalRanked7d?: number;
  error?: string;
};

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

function ChartEmptyState({
  title,
  body,
  ctaHref,
  ctaLabel,
}: {
  title: string;
  body: string;
  ctaHref?: string;
  ctaLabel?: string;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center px-5 py-8 text-center">
      <span className="text-2xl opacity-25" aria-hidden>
        📊
      </span>
      <p className="mt-3 text-sm font-medium text-zinc-400">{title}</p>
      <p className="mx-auto mt-1.5 max-w-[22rem] text-xs leading-relaxed text-zinc-600">{body}</p>
      {ctaHref && ctaLabel ? (
        <Link
          href={ctaHref}
          className="mt-4 text-xs font-semibold text-emerald-300/90 underline-offset-2 hover:underline"
        >
          {ctaLabel}
        </Link>
      ) : null}
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
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (status !== "authenticated") return;
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch("/api/me/performance-lab", { credentials: "same-origin" });
      const json = (await res.json().catch(() => ({}))) as LabPayload;
      if (!res.ok || json.success !== true) {
        setErr(typeof json.error === "string" ? json.error : "Could not load performance.");
        setData(null);
        return;
      }
      setData(json);
    } catch {
      setErr("Could not load performance.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    void load();
  }, [load]);

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
  const series = data?.series14d ?? [];
  const dist = data?.distribution;
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
        <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-emerald-300/80">Your terminal</p>
        <h1 className="mt-2 bg-gradient-to-r from-white via-emerald-50/95 to-emerald-300/85 bg-clip-text text-3xl font-bold tracking-tight text-transparent sm:text-4xl">
          Performance lab
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-zinc-400">
          <span className="font-medium text-zinc-200">Same data as Call log</span>, but summarized: averages, win
          rate, 14-day activity, how your multiples stack, and your spot on the weekly caller list.{" "}
          <Link href="/calls" className="font-medium text-emerald-300/90 underline-offset-2 hover:underline">
            Call log
          </Link>{" "}
          is the line-by-line list;{" "}
          <Link href="/leaderboard" className="font-medium text-emerald-300/90 underline-offset-2 hover:underline">
            Leaderboards
          </Link>{" "}
          is still where the whole community competes.
        </p>
      </header>

      {err ? (
        <div className="mt-6 rounded-xl border border-red-500/30 bg-red-950/20 px-4 py-3 text-sm text-red-200">{err}</div>
      ) : null}

      <div className="mt-7 grid gap-2.5 sm:grid-cols-2 sm:gap-3 lg:grid-cols-4" data-tutorial="performance.summary">
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

      <div className="mt-3 grid gap-2.5 sm:grid-cols-2 sm:gap-3 lg:grid-cols-5">
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

      <div className="mt-9 grid gap-6 lg:grid-cols-5">
        <section className="lg:col-span-3" data-tutorial="performance.activity">
          <h2 className="text-base font-semibold tracking-tight text-white">Last 14 days · activity</h2>
          <p className="mt-1 text-xs text-zinc-500">
            Bars = call count per UTC day · line = average ATH multiple that day.
          </p>
          <div className="mt-3 h-64 rounded-2xl border border-emerald-500/15 bg-gradient-to-b from-emerald-950/20 to-black/40 p-3 pl-0 ring-1 ring-emerald-500/10">
            {loading && series.length === 0 ? (
              <ChartSkeleton />
            ) : series.length === 0 ? (
              <ChartEmptyState
                title="No activity in this window"
                body="Once you log calls on the dashboard, you’ll see daily bars plus the average multiple line for each UTC day here."
                ctaHref="/calls"
                ctaLabel="Open call log →"
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
        </section>

        <section className="lg:col-span-2" data-tutorial="performance.distribution">
          <h2 className="text-base font-semibold tracking-tight text-white">Multiple mix</h2>
          <p className="mt-1 text-xs text-zinc-500">
            Buckets use ATH multiple since each call (peak ÷ entry MC).
          </p>
          <div className="mt-3 h-64 rounded-2xl border border-zinc-800/90 bg-zinc-950/50 p-3 ring-1 ring-zinc-700/20">
            {loading && distChart.length === 0 ? (
              <ChartSkeleton />
            ) : distChart.length === 0 || !dist || dist.total === 0 ? (
              <ChartEmptyState
                title="No multiple mix yet"
                body="This chart needs a few logged calls so we can bucket how often you land under 2×, between 2–5×, or 5×+ (ATH vs entry MC)."
                ctaHref="/calls"
                ctaLabel="Log a call →"
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
        </section>
      </div>
    </div>
  );
}
