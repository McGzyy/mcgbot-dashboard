import Link from "next/link";
import { AFFILIATE_EARNINGS_SUMMARY } from "@/lib/affiliate/affiliateEarningsCopy";

export function AffiliateLoyaltyScheduleCallout({ className = "" }: { className?: string }) {
  return (
    <div
      className={`rounded-xl border border-violet-200/80 bg-gradient-to-br from-violet-50/90 to-white px-4 py-3 shadow-sm ${className}`}
    >
      <p className="text-[10px] font-semibold uppercase tracking-wider text-violet-800/90">
        Loyalty rev-share (current program)
      </p>
      <p className="mt-1.5 text-sm leading-relaxed text-zinc-700">{AFFILIATE_EARNINGS_SUMMARY.recurring}</p>
      <Link
        href="/affiliate/resources#how-you-earn"
        className="mt-2 inline-block text-xs font-semibold text-violet-700 hover:underline"
      >
        Full schedule & bonuses →
      </Link>
    </div>
  );
}

