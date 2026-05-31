"use client";

import Link from "next/link";
import {
  MOD_ACTIVITY_LOG_EVENT,
  clearModActivityLog,
  loadModActivityLog,
  type ModActivityLogEntry,
} from "@/lib/modActivityLog";
import { terminalSurface } from "@/lib/terminalDesignTokens";
import { useCallback, useEffect, useState } from "react";

export function ModerationActivityLogPanel() {
  const [activityLog, setActivityLog] = useState<ModActivityLogEntry[]>([]);

  const refresh = useCallback(() => {
    setActivityLog(loadModActivityLog());
  }, []);

  useEffect(() => {
    refresh();
    const onUpdate = () => refresh();
    window.addEventListener(MOD_ACTIVITY_LOG_EVENT, onUpdate);
    return () => window.removeEventListener(MOD_ACTIVITY_LOG_EVENT, onUpdate);
  }, [refresh]);

  const wipeActivityLog = useCallback(() => {
    clearModActivityLog();
    setActivityLog([]);
  }, []);

  return (
    <section
      id="mod-action-log"
      className={`${terminalSurface.panelCard} rounded-xl border px-4 py-4 sm:px-5`}
      aria-label="Moderation action log"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800/60 pb-3">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-zinc-500">Mod log</h2>
          <p className="mt-1 max-w-2xl text-xs leading-relaxed text-zinc-600">
            Session log for this browser. Permanent audit trail lives on{" "}
            <Link href="/moderation/activity" className="font-medium text-emerald-400/90 hover:underline">
              Staff → Activity
            </Link>
            .
          </p>
        </div>
        <button
          type="button"
          onClick={wipeActivityLog}
          disabled={activityLog.length === 0}
          className="rounded-lg border border-zinc-700/80 bg-zinc-900/60 px-3 py-1.5 text-[11px] font-semibold text-zinc-300 transition hover:border-zinc-600 hover:text-zinc-100 disabled:opacity-40"
        >
          Clear log
        </button>
      </div>

      {activityLog.length === 0 ? (
        <p className="mt-4 text-sm text-zinc-500">No actions yet this session.</p>
      ) : (
        <ul className="mt-4 divide-y divide-zinc-800/50">
          {activityLog.map((row) => {
            const tone =
              row.outcome === "approved"
                ? "text-emerald-300/90"
                : row.outcome === "denied"
                  ? "text-zinc-400"
                  : row.outcome === "excluded"
                    ? "text-amber-200/85"
                    : row.outcome === "failed"
                      ? "text-red-300/85"
                      : "text-zinc-400";
            const kind =
              row.kind === "call_bot"
                ? "Bot"
                : row.kind === "call_user"
                  ? "Community"
                  : row.kind === "dev"
                    ? "Dev"
                    : "";
            return (
              <li key={row.id} className="py-3 first:pt-0 last:pb-0">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-[11px]">
                  <span className="shrink-0 tabular-nums text-zinc-600">
                    {new Date(row.ts).toLocaleString(undefined, {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                  <span className={`shrink-0 font-semibold uppercase ${tone}`}>{row.outcome}</span>
                  <span className="text-zinc-600">{kind}</span>
                </div>
                <p className="mt-1 text-sm font-medium text-zinc-200">{row.subject}</p>
                {row.moderatorName ? (
                  <p className="mt-0.5 text-[11px] text-zinc-500">by {row.moderatorName}</p>
                ) : null}
                {row.detail ? <p className="mt-1 text-xs leading-relaxed text-zinc-500">{row.detail}</p> : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
