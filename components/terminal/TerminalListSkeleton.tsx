"use client";

import { terminalListRow, terminalListRowBorder } from "@/lib/terminalListRow";

export type TerminalListSkeletonVariant = "compact" | "social";

type TerminalListSkeletonProps = {
  variant?: TerminalListSkeletonVariant;
  rows?: number;
  /** First-load shimmer; keep false on poll refetch (list stays visible). */
  pulse?: boolean;
  compact?: boolean;
  listClassName?: string;
  "aria-label"?: string;
};

function skeletonPulse(pulse: boolean): string {
  return pulse ? "animate-pulse" : "";
}

function SkBlock({ className }: { className?: string }) {
  return <div className={className} aria-hidden />;
}

function CompactSkeletonRow({ pulse }: { pulse: boolean }) {
  return (
    <div
      className={`flex items-center gap-2 rounded-lg ${terminalListRowBorder} bg-zinc-900/20 px-2 py-2 sm:gap-3 sm:px-3 ${skeletonPulse(pulse)}`}
    >
      <SkBlock className="h-7 w-7 shrink-0 rounded-md bg-zinc-800/60 sm:h-8 sm:w-8 sm:rounded-lg" />
      <div className="min-w-0 flex-1 space-y-2">
        <SkBlock className="h-3.5 w-28 max-w-[60%] rounded bg-zinc-800/50" />
        <SkBlock className="h-2.5 w-40 max-w-[85%] rounded bg-zinc-800/40" />
      </div>
      <SkBlock className="hidden h-8 w-14 shrink-0 rounded bg-zinc-800/40 sm:block" />
      <SkBlock className="hidden h-8 w-14 shrink-0 rounded bg-zinc-800/35 sm:block" />
    </div>
  );
}

function SocialSkeletonRow({ compact, pulse }: { compact: boolean; pulse: boolean }) {
  return (
    <li className={`rounded-xl ${terminalListRowBorder} bg-zinc-950/50 p-2.5 sm:p-3`}>
      <div className={`flex gap-3 ${skeletonPulse(pulse)}`}>
        <SkBlock className="h-11 w-11 shrink-0 rounded-full bg-zinc-800/90 ring-2 ring-black/20" />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
              <SkBlock className="h-3.5 w-32 rounded-md bg-zinc-800/80" />
              <SkBlock className="h-3 w-14 rounded-md bg-zinc-800/50" />
            </div>
            <SkBlock className="h-4 w-[4.5rem] shrink-0 rounded-md bg-zinc-800/45" />
          </div>
          <div className="space-y-2 pt-0.5">
            <SkBlock className="h-3 w-full rounded bg-zinc-800/35" />
            <SkBlock className="h-3 w-[92%] rounded bg-zinc-800/30" />
            {!compact ? <SkBlock className="h-3 w-[70%] rounded bg-zinc-800/25" /> : null}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-zinc-800/40 pt-1.5">
            <div className="flex flex-wrap gap-3">
              <SkBlock className="h-3 w-10 rounded bg-zinc-800/40" />
              <SkBlock className="h-3 w-10 rounded bg-zinc-800/35" />
              <SkBlock className="h-3 w-10 rounded bg-zinc-800/30" />
            </div>
            <SkBlock className="h-6 w-[5.5rem] shrink-0 rounded-md bg-zinc-800/45" />
          </div>
        </div>
      </div>
    </li>
  );
}

/** Height-stable skeleton rows for dashboard list wells. */
export function TerminalListSkeleton({
  variant = "compact",
  rows = 6,
  pulse = true,
  compact = false,
  listClassName = "",
  "aria-label": ariaLabel = "Loading list",
}: TerminalListSkeletonProps) {
  if (variant === "social") {
    return (
      <ul
        className={`${compact ? "space-y-2.5 pr-0.5" : "space-y-3"} ${listClassName}`.trim()}
        aria-busy="true"
        aria-label={ariaLabel}
      >
        {Array.from({ length: rows }, (_, i) => (
          <SocialSkeletonRow key={`social-sk-${i}`} compact={compact} pulse={pulse} />
        ))}
      </ul>
    );
  }

  return (
    <ul className={`space-y-1 ${listClassName}`.trim()} aria-busy="true" aria-label={ariaLabel}>
      {Array.from({ length: rows }, (_, i) => (
        <li key={`list-sk-${i}`}>
          <CompactSkeletonRow pulse={pulse} />
        </li>
      ))}
    </ul>
  );
}

/** Live Activity feed skeleton (home dashboard). */
export function TerminalActivitySkeleton({
  pulse = true,
  rows = 7,
}: {
  pulse?: boolean;
  rows?: number;
}) {
  return (
    <ul className="space-y-2.5 px-1 py-2 sm:space-y-2" aria-busy="true" aria-label="Loading activity">
      {Array.from({ length: rows }, (_, i) => (
        <li key={`act-sk-${i}`}>
          <div
            className={`flex gap-2 rounded-lg ${terminalListRowBorder} bg-zinc-900/20 px-3 py-2.5 sm:px-3 sm:py-2 ${skeletonPulse(pulse)}`}
          >
            <SkBlock className="h-7 w-7 shrink-0 rounded-full bg-zinc-800/60 sm:h-8 sm:w-8" />
            <SkBlock className="mt-0.5 h-7 w-7 shrink-0 rounded-lg bg-zinc-800/55" />
            <div className="min-w-0 flex-1 space-y-2">
              <SkBlock className="h-3 w-32 max-w-[55%] rounded bg-zinc-800/50" />
              <SkBlock className="h-2.5 max-w-[95%] rounded bg-zinc-800/40" />
              <SkBlock className="h-2.5 max-w-[78%] rounded bg-zinc-800/35" />
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Divided recent-calls skeleton (matches static row height). */
export function TerminalRecentCallsSkeleton({ pulse = true }: { pulse?: boolean }) {
  return (
    <ul className={terminalListRow.dividedList} aria-busy="true" aria-label="Loading recent calls">
      {Array.from({ length: 5 }, (_, i) => (
        <li key={`call-sk-${i}`}>
          <div
            className={`flex items-center gap-2 py-2 pl-1 pr-1 sm:gap-2.5 sm:py-2 sm:pl-1.5 sm:pr-2 ${skeletonPulse(pulse)}`}
          >
            <SkBlock className="h-8 w-8 shrink-0 rounded-lg bg-zinc-800/55 ring-1 ring-black/15" />
            <div className="min-w-0 flex-1 space-y-2 pr-2">
              <SkBlock className="h-3.5 max-w-[88%] rounded bg-zinc-800/45" />
            </div>
            <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
              <SkBlock className="h-5 w-9 rounded-md bg-zinc-800/40" />
              <SkBlock className="h-6 w-11 rounded-md bg-zinc-800/40" />
              <SkBlock className="h-6 w-9 rounded bg-zinc-800/35" />
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
