"use client";

import Link from "next/link";
import { PanelCard } from "@/app/components/PanelCard";
import { DeskCallQuotaChip } from "@/app/components/dashboard/DeskCallQuotaChip";
import type { DeskCallQuotaUi } from "@/lib/deskCallQuotaDisplay";

const LOOP_LINKS = [
  { href: "/calls", label: "Call log" },
  { href: "/performance", label: "Performance Lab" },
] as const;

/** Primary log-call CTA — sits above personal stats; macro prices live in the top bar only. */
export function HomeLogCallBar({
  quota,
  quotaLoading,
  onSubmitCall,
}: {
  quota: DeskCallQuotaUi | null;
  quotaLoading?: boolean;
  onSubmitCall: () => void;
}) {
  return (
    <PanelCard
      title="Log a call"
      data-tutorial="dashboard.logCallBar"
      paddingClassName="px-4 pt-2.5 pb-3"
    >
      <div className="mt-2 space-y-2.5">
        <button
          type="button"
          onClick={onSubmitCall}
          className="w-full rounded-xl bg-[color:var(--accent)] px-4 py-3 text-base font-semibold text-black shadow-lg shadow-black/30 transition hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]/35"
          data-tutorial="dashboard.logCallBar.submit"
        >
          Log call
        </button>
        <div className="flex flex-wrap items-center justify-between gap-2 gap-y-1">
          <DeskCallQuotaChip quota={quota} loading={quotaLoading} />
          <nav
            className="flex items-center gap-1 rounded-lg border border-zinc-800/80 bg-zinc-950/50 p-0.5"
            aria-label="Call loop"
          >
            {LOOP_LINKS.map((l) => (
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
    </PanelCard>
  );
}
