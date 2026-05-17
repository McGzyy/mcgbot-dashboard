"use client";

import Link from "next/link";
import type { DeskCallQuotaUi } from "@/lib/deskCallQuotaDisplay";
import { deskCallsAtLimit, deskCallsRemainingLabel } from "@/lib/deskCallQuotaDisplay";

export function DeskCallQuotaChip({
  quota,
  loading,
  onSubmitCall,
  variant = "compact",
}: {
  quota: DeskCallQuotaUi | null;
  loading?: boolean;
  onSubmitCall?: () => void;
  /** `compact` — subtle inline hint; `default` — bordered chip (legacy). */
  variant?: "compact" | "default";
}) {
  if (loading) {
    return variant === "compact" ? (
      <span
        className="inline-block h-3.5 w-14 animate-pulse rounded bg-zinc-800/50"
        aria-hidden
        data-tutorial="dashboard.deskCallQuota"
      />
    ) : (
      <QuotaSkeleton />
    );
  }

  if (!quota || quota.unlimited) return null;

  const atLimit = deskCallsAtLimit(quota);
  const label = deskCallsRemainingLabel(quota);

  if (variant === "compact") {
    const remaining = quota.remaining ?? 0;
    const limit = quota.dailyLimit;
    const text = atLimit
      ? "Daily calls used"
      : limit != null
        ? `${remaining} of ${limit} calls today`
        : `${remaining} calls left today`;
    const className = atLimit
      ? "text-[11px] font-medium tabular-nums text-amber-200/75"
      : "text-[11px] font-medium tabular-nums text-zinc-500";

    if (onSubmitCall && !atLimit) {
      return (
        <button
          type="button"
          onClick={onSubmitCall}
          className={`${className} transition hover:text-zinc-300 focus:outline-none focus-visible:underline`}
          title={`${label} — submit a call`}
          data-tutorial="dashboard.deskCallQuota"
        >
          {text}
        </button>
      );
    }

    return (
      <span className={className} title={label} data-tutorial="dashboard.deskCallQuota">
        {text}
      </span>
    );
  }

  const inner = (
    <>
      <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-500">
        Calls
      </span>
      <span
        className={`truncate text-sm font-bold tabular-nums ${
          atLimit ? "text-amber-200/95" : "text-zinc-100"
        }`}
      >
        {atLimit ? "0 left" : `${quota.remaining ?? 0}/${quota.dailyLimit ?? "—"}`}
      </span>
      <span className="hidden text-[10px] text-zinc-600 sm:inline" title={label}>
        UTC day
      </span>
    </>
  );

  const className = `flex min-w-0 items-center gap-2 rounded-lg border px-2.5 py-1.5 sm:px-3 ${
    atLimit
      ? "border-amber-500/30 bg-amber-500/[0.08]"
      : "border-zinc-800/70 bg-zinc-950/40"
  }`;

  if (onSubmitCall && !atLimit) {
    return (
      <button
        type="button"
        onClick={onSubmitCall}
        className={`${className} transition hover:border-zinc-600 focus:outline-none focus:ring-2 focus:ring-zinc-500/25`}
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
