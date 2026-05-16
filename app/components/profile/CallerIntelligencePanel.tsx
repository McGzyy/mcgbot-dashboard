"use client";

import type { CallerProfileIntel } from "@/lib/callerProfileIntel";
import { multipleClass } from "@/lib/callDisplayFormat";

function formatX(v: number): string {
  if (!Number.isFinite(v) || v <= 0) return "—";
  return `${v.toFixed(v >= 10 ? 1 : 2)}×`;
}

function WindowColumn({
  label,
  w,
}: {
  label: string;
  w: CallerProfileIntel["windows"]["d7"];
}) {
  return (
    <div className="min-w-0 rounded-xl border border-zinc-800/70 bg-zinc-950/50 p-3 sm:p-3.5">
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500">{label}</p>
      {w.calls === 0 ? (
        <p className="mt-2 text-xs text-zinc-500">No calls in this window.</p>
      ) : (
        <>
          <p className="mt-2 text-2xl font-bold tabular-nums text-zinc-50">{formatX(w.avgX)}</p>
          <p className="mt-0.5 text-[11px] text-zinc-500">avg ATH · {w.calls} calls</p>
          <dl className="mt-3 grid grid-cols-2 gap-x-2 gap-y-1.5 text-[11px]">
            <div>
              <dt className="text-zinc-600">Median</dt>
              <dd className="font-semibold tabular-nums text-zinc-300">{formatX(w.medianX)}</dd>
            </div>
            <div>
              <dt className="text-zinc-600">2×+</dt>
              <dd className="font-semibold tabular-nums text-zinc-300">
                {Math.round(w.hit2xPct)}%
              </dd>
            </div>
            <div>
              <dt className="text-zinc-600">5×+</dt>
              <dd className="font-semibold tabular-nums text-zinc-300">
                {Math.round(w.hit5xPct)}%
              </dd>
            </div>
            <div>
              <dt className="text-zinc-600">Best</dt>
              <dd className={`font-semibold tabular-nums ${multipleClass(w.bestX)}`}>
                {formatX(w.bestX)}
              </dd>
            </div>
          </dl>
          {w.rank != null && w.rankedCallers > 0 ? (
            <p className="mt-2 text-[10px] font-semibold text-zinc-500">
              Desk rank{" "}
              <span className="text-zinc-300">
                #{w.rank}
              </span>{" "}
              <span className="text-zinc-600">/ {w.rankedCallers}</span>
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}

export function CallerIntelligencePanel({ intel }: { intel: CallerProfileIntel }) {
  const { windows, vsDesk, bestCall30d, activeDaysStreak } = intel;
  const hasAny =
    windows.d7.calls > 0 || windows.d30.calls > 0 || windows.all.calls > 0;

  if (!hasAny) {
    return (
      <p className="text-sm text-zinc-500">
        No verified calls on record yet — stats appear after the first tracked call.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <WindowColumn label="7 days" w={windows.d7} />
        <WindowColumn label="30 days" w={windows.d30} />
        <WindowColumn label="All time" w={windows.all} />
      </div>

      {(vsDesk.d7 || vsDesk.d30) && (
        <div className="rounded-xl border border-zinc-800/70 bg-zinc-950/40 px-3 py-2.5 sm:px-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-500">
            vs desk avg
          </p>
          <ul className="mt-2 flex flex-wrap gap-3 text-xs text-zinc-400">
            {vsDesk.d7 ? (
              <li>
                <span className="font-semibold text-zinc-300">7d:</span>{" "}
                {vsDesk.d7.deltaPct >= 0 ? "+" : ""}
                {vsDesk.d7.deltaPct.toFixed(0)}% ({formatX(vsDesk.d7.callerAvgX)} vs{" "}
                {formatX(vsDesk.d7.deskAvgX)} desk)
              </li>
            ) : null}
            {vsDesk.d30 ? (
              <li>
                <span className="font-semibold text-zinc-300">30d:</span>{" "}
                {vsDesk.d30.deltaPct >= 0 ? "+" : ""}
                {vsDesk.d30.deltaPct.toFixed(0)}% ({formatX(vsDesk.d30.callerAvgX)} vs{" "}
                {formatX(vsDesk.d30.deskAvgX)} desk)
              </li>
            ) : null}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap gap-3 text-[11px] text-zinc-500">
        {activeDaysStreak > 0 ? (
          <span className="rounded-full border border-zinc-800/80 bg-zinc-900/50 px-2.5 py-1">
            Active streak{" "}
            <span className="font-semibold text-zinc-300">
              {activeDaysStreak} day{activeDaysStreak === 1 ? "" : "s"}
            </span>
          </span>
        ) : null}
        {bestCall30d ? (
          <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-emerald-200/90">
            Best 30d:{" "}
            <span className="font-semibold">${bestCall30d.symbol}</span>{" "}
            {formatX(bestCall30d.multiple)}
          </span>
        ) : null}
      </div>
    </div>
  );
}
