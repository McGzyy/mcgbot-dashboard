"use client";

import type { ProfileChartView } from "@/lib/profileChartData";
import { terminalPage, terminalSurface } from "@/lib/terminalDesignTokens";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const GRID_STROKE = "rgba(63,63,70,0.22)";
const CHART_HEIGHT = 220;

function formatValue(suffix: ProfileChartView["valueSuffix"], value: number): string {
  if (suffix === "x") return `${value.toFixed(1)}×`;
  if (suffix === "%") return `${Math.round(value)}%`;
  return value.toLocaleString();
}

function ChartTooltip({
  active,
  payload,
  suffix,
}: {
  active?: boolean;
  payload?: { payload?: { label: string; value: number; detail?: string } }[];
  suffix: ProfileChartView["valueSuffix"];
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  if (!row) return null;
  return (
    <div className="rounded-xl border border-zinc-800/80 bg-black/85 px-3 py-2 text-xs shadow-2xl shadow-black/60 backdrop-blur">
      <p className="font-semibold text-zinc-200">{row.label}</p>
      {row.detail ? <p className="mt-1 text-zinc-500">{row.detail}</p> : null}
      <p className="mt-1.5 tabular-nums text-emerald-300">{formatValue(suffix, row.value)}</p>
    </div>
  );
}

function BarChartPanel({ view }: { view: ProfileChartView }) {
  const maxVal = view.points.reduce((m, p) => Math.max(m, p.value), 0);
  const yMax =
    view.valueSuffix === "x"
      ? Math.max(2, Math.ceil(maxVal * 1.12))
      : Math.max(1, Math.ceil(maxVal * 1.08));

  return (
    <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
      <BarChart data={view.points} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
        <CartesianGrid stroke={GRID_STROKE} strokeDasharray="2 8" vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fill: "rgba(161,161,170,0.62)", fontSize: 10 }}
          tickLine={false}
          axisLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          width={view.valueSuffix === "calls" ? 36 : 34}
          domain={[0, yMax]}
          tick={{ fill: "rgba(161,161,170,0.62)", fontSize: 10 }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v: number) =>
            view.valueSuffix === "x"
              ? `${v}x`
              : view.valueSuffix === "%"
                ? `${v}%`
                : String(v)
          }
        />
        <Tooltip
          cursor={{ fill: "rgba(34,211,238,0.06)" }}
          content={<ChartTooltip suffix={view.valueSuffix} />}
        />
        <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={view.points.length > 8 ? 22 : 32}>
          {view.points.map((entry) => (
            <Cell key={entry.key} fill={entry.fill} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function DonutChartPanel({ view }: { view: ProfileChartView }) {
  const total = view.points.reduce((s, p) => s + p.value, 0);
  const data = view.points.filter((p) => p.value > 0);
  const primary = view.points[0];

  return (
    <div className="relative mx-auto h-[220px] w-full max-w-[14rem]">
      <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
        <PieChart>
          <Pie
            data={data.length > 0 ? data : view.points}
            dataKey="value"
            nameKey="label"
            cx="50%"
            cy="50%"
            innerRadius={52}
            outerRadius={78}
            paddingAngle={2}
            stroke="rgba(9,9,11,0.92)"
            strokeWidth={2}
          >
            {(data.length > 0 ? data : view.points).map((entry) => (
              <Cell key={entry.key} fill={entry.fill} />
            ))}
          </Pie>
          <Tooltip content={<ChartTooltip suffix={view.valueSuffix} />} />
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
          {primary?.label ?? "—"}
        </p>
        <p className="text-2xl font-bold tabular-nums text-zinc-100">
          {formatValue(view.valueSuffix, primary?.value ?? total)}
        </p>
      </div>
    </div>
  );
}

export function ProfileTrackRecordChart({
  view,
  loading,
}: {
  view: ProfileChartView;
  loading?: boolean;
}) {
  if (loading) {
    return (
      <div
        className={`${terminalPage.statTile} flex h-[260px] flex-col justify-between p-4`}
        aria-busy
      >
        <div className="h-4 w-32 animate-pulse rounded bg-zinc-800/80" />
        <div className="mx-auto h-40 w-40 animate-pulse rounded-full bg-zinc-800/60" />
      </div>
    );
  }

  if (view.points.length === 0) {
    return (
      <div
        className={`${terminalPage.statTile} flex h-[260px] flex-col items-center justify-center gap-2 px-4 text-center`}
      >
        <p className="text-sm font-medium text-zinc-400">No data for this view</p>
        <p className="max-w-xs text-xs text-zinc-600">{view.subtitle}</p>
      </div>
    );
  }

  return (
    <div
      className={`${terminalSurface.insetPanel} ${terminalSurface.insetEdgeSoft} flex h-full min-h-[260px] flex-col p-4`}
    >
      <div className="mb-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-300/75">
          {view.title}
        </p>
        <p className={`${terminalPage.sectionHint} mt-1`}>{view.subtitle}</p>
      </div>
      <div className="min-h-0 flex-1">
        {view.kind === "bar" ? <BarChartPanel view={view} /> : <DonutChartPanel view={view} />}
      </div>
      <ul className="mt-3 flex flex-wrap gap-x-3 gap-y-1.5">
        {view.points.map((p) => (
          <li key={p.key} className="inline-flex items-center gap-1.5 text-[11px] text-zinc-500">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: p.fill }} aria-hidden />
            <span>
              {p.label}{" "}
              <span className="font-medium tabular-nums text-zinc-400">
                {formatValue(view.valueSuffix, p.value)}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
