"use client";

import Link from "next/link";
import type { DeskCallQuotaUi } from "@/lib/deskCallQuotaDisplay";
import { deskCallsAtLimit, deskCallsRemainingLabel } from "@/lib/deskCallQuotaDisplay";

export function DeskCallQuotaChip({
  quota,
  loading,
  onSubmitCall,
}: {
  quota: DeskCallQuotaUi | null;
  loading?: boolean;
  onSubmitCall?: () => void;
}) {
  if (loading) {
    return (
      <QuotaSkeleton />
    );
  }

  if (!quota) return null;

  const atLimit = deskCallsAtLimit(quota);
  const label = deskCallsRemainingLabel(quota);

  const inner = (
    <>
      <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-500">
        Desk calls
      </span>
      <span
        className={`truncate text-sm font-bold tabular-nums ${
          atLimit ? "text-amber-200/95" : quota.unlimited ? "text-sky-200/95" : "text-zinc-100"
        }`}
      >
        {quota.unlimited
          ? "Unlimited"
          : atLimit
            ? "0 left"
            : `${quota.remaining ?? 0}/${quota.dailyLimit ?? "—"}`}
      </span>
      <span className="hidden text-[10px] text-zinc-600 sm:inline" title={label}>
        UTC day
      </span>
    </>
  );

  const className = `flex min-w-0 items-center gap-2 rounded-lg border px-2.5 py-1.5 sm:px-3 ${
    atLimit
      ? "border-amber-500/30 bg-amber-500/[0.08]"
      : quota.unlimited
        ? "border-sky-500/25 bg-sky-500/[0.07]"
        : "border-[color:var(--accent)]/25 bg-[color:var(--accent)]/[0.07]"
  }`;

  if (onSubmitCall && !atLimit) {
    return (
      <button
        type="button"
        onClick={onSubmitCall}
        className={`${className} transition hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-[color:var(--accent)]/25`}
        title={`${label} — submit a call`}
        data-tutorial="dashboard.deskCallQuota"
      >
        {inner}
      </button>
    );
  }

  return (
    <div className={className} data-tutorial="dashboard.deskCallQuota" title={label}>
      {inner}
      {atLimit ? (
        <Link
          href="/membership"
          className="ml-1 shrink-0 text-[10px] font-semibold text-amber-200/90 underline-offset-2 hover:underline"
        >
          Upgrade
        </Link>
      ) : null}
    </div>
  );
}

function QuotaSkeleton() {
  return (
    <div
      className="h-9 w-32 animate-pulse rounded-lg border border-zinc-800/60 bg-zinc-900/40"
      aria-hidden
      data-tutorial="dashboard.deskCallQuota"
    />
  );
}
