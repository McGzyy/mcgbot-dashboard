"use client";

import type { WeeklySummary } from "@/lib/performanceLabInsights";
import { terminalUi } from "@/lib/terminalDesignTokens";
import { useCallback, useState } from "react";

export function PerformanceWeeklyCard({
  summary,
  loading,
}: {
  summary: WeeklySummary | null;
  loading: boolean;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    if (!summary?.copyText) return;
    try {
      await navigator.clipboard.writeText(summary.copyText);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }, [summary?.copyText]);

  if (loading && !summary) {
    return (
      <div
        className="mt-7 h-36 animate-pulse rounded-2xl border border-emerald-500/15 bg-emerald-950/10"
        aria-busy
        data-tutorial="performance.weeklyCard"
      />
    );
  }

  if (!summary) return null;

  return (
    <section
      className="relative mt-7 overflow-hidden rounded-2xl border border-emerald-500/25 bg-gradient-to-br from-emerald-950/35 via-zinc-950/80 to-black/60 p-4 shadow-lg shadow-black/40 ring-1 ring-emerald-500/15 sm:p-5"
      data-tutorial="performance.weeklyCard"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-emerald-300/80">
            Desk edge · weekly snapshot
          </p>
          <h2 className="mt-2 text-lg font-semibold tracking-tight text-white sm:text-xl">{summary.headline}</h2>
        </div>
        <button
          type="button"
          onClick={() => void handleCopy()}
          className={terminalUi.secondaryButtonSm}
        >
          {copied ? "Copied" : "Copy summary"}
        </button>
      </div>
      <ul className="mt-4 space-y-1.5 text-sm text-zinc-400">
        {summary.bullets.map((line) => (
          <li key={line} className="flex gap-2">
            <span className="text-emerald-400/80" aria-hidden>
              ·
            </span>
            <span>{line}</span>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-[11px] text-zinc-600">
        Paste into Discord or notes — proof-of-edge card from your verified call tape.
      </p>
    </section>
  );
}
