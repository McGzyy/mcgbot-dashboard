"use client";

import Link from "next/link";
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

type DailyBucket = { dayKey: string; label: string; calls: number; avgX: number; bestX: number };
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
    <div className="rounded-2xl border border-white/[0.07] bg-gradient-to-br from-zinc-900/80 via-zinc-950/90 to-black/80 p-4 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)]">
      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">{label}</p>
      <p className="mt-2 text-2xl font-bold tabular-nums tracking-tight text-white">{value}</p>
      {hint ? <p className="mt-1 text-[11px] text-zinc-500">{hint}</p> : null}
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
      <header className="border-b border-white/[0.06] pb-8 pt-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-emerald-300/80">Your terminal</p>
        <h1 className="mt-2 bg-gradient-to-r from-white via-emerald-50/95 to-emerald-300/85 bg-clip-text text-3xl font-bold tracking-tight text-transparent sm:text-4xl">
          Performance lab
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-zinc-400">
          <span className="font-medium text-zinc-200">Same data as Call tape</span>, but summarized: averages, win
          rate, 14-day activity, how your multiples stack, and your spot on the weekly caller list.{" "}
          <Link href="/calls" className="font-medium text-emerald-300/90 underline-offset-2 hover:underline">
            Call tape
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

      <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Avg × (all)"
          value={loading ? "…" : s ? s.avgX.toFixed(2) + "×" : "—"}
          hint="Mean ATH multiple"
        />
        <StatCard
          label="Median ×"
          value={loading ? "…" : s ? s.medianX.toFixed(2) + "×" : "—"}
          hint="Robust center"
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

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
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

      <div className="mt-10 grid gap-8 lg:grid-cols-5">
        <section className="lg:col-span-3">
          <h2 className="text-base font-semibold tracking-tight text-white">Last 14 days · activity</h2>
          <p className="mt-1 text-xs text-zinc-500">Bars = call count per UTC day · line = average multiple that day.</p>
          <div className="mt-4 h-72 rounded-2xl border border-emerald-500/15 bg-gradient-to-b from-emerald-950/20 to-black/40 p-3 pl-0 ring-1 ring-emerald-500/10">
            {series.length === 0 && !loading ? (
              <div className="flex h-full items-center justify-center text-sm text-zinc-500">No calls in range yet.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={series}>
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
                      backgroundColor: "#09090b",
                      border: "1px solid rgba(16,185,129,0.25)",
                      borderRadius: 12,
                    }}
                    labelStyle={{ color: "#a1a1aa" }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
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

        <section className="lg:col-span-2">
          <h2 className="text-base font-semibold tracking-tight text-white">Multiple mix</h2>
          <p className="mt-1 text-xs text-zinc-500">How your verified calls stack by ATH bucket.</p>
          <div className="mt-4 h-72 rounded-2xl border border-zinc-800/80 bg-zinc-950/50 p-3 ring-1 ring-white/[0.04]">
            {distChart.length === 0 || dist?.total === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-zinc-500">No distribution yet.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={distChart} layout="vertical" margin={{ left: 8, right: 16 }}>
                  <CartesianGrid stroke="#27272a" strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" stroke="#71717a" tick={{ fontSize: 11 }} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" stroke="#71717a" tick={{ fontSize: 11 }} width={48} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#09090b",
                      border: "1px solid #27272a",
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
