"use client";

import Link from "next/link";
import { DeskCallQuotaChip } from "@/app/components/dashboard/DeskCallQuotaChip";
import { MarketContextBar } from "@/app/components/dashboard/MarketContextBar";
import type { DeskCallQuotaUi } from "@/lib/deskCallQuotaDisplay";

const DESK_LINKS = [
  { href: "/calls", label: "Call log" },
  { href: "/performance", label: "Lab" },
] as const;

/**
 * Single desk command strip: macro context, daily quota, one primary submit CTA, and core loop links.
 */
export function DeskCommandBar({
  quota,
  quotaLoading,
  onSubmitCall,
}: {
  quota: DeskCallQuotaUi | null;
  quotaLoading?: boolean;
  onSubmitCall: () => void;
}) {
  return (
    <div
      className="flex min-w-0 flex-col gap-3 rounded-xl border border-zinc-800/70 bg-gradient-to-b from-zinc-950/80 to-zinc-950/40 px-3 py-2.5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)] sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-4 sm:py-3"
      data-tutorial="dashboard.deskCommandBar"
    >
      <MarketContextBar />

      <div className="flex min-w-0 flex-wrap items-center gap-2 sm:justify-end sm:gap-3">
        <DeskCallQuotaChip quota={quota} loading={quotaLoading} />
        <button
          type="button"
          onClick={onSubmitCall}
          className="rounded-lg bg-[color:var(--accent)] px-3.5 py-1.5 text-xs font-semibold text-black shadow-md shadow-black/25 transition hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]/40"
          data-tutorial="dashboard.deskCommandBar.submitCall"
        >
          Submit desk call
        </button>
        <nav
          className="flex items-center gap-1 rounded-lg border border-zinc-800/80 bg-zinc-950/50 p-0.5"
          aria-label="Desk shortcuts"
        >
          {DESK_LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="rounded-md px-2.5 py-1 text-[11px] font-semibold text-zinc-400 transition hover:bg-zinc-900/80 hover:text-zinc-100"
            >
              {l.label}
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
}
