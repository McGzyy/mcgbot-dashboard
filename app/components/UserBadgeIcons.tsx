"use client";

import { parseTopCallerTimesFromBadges } from "@/lib/topCallerBadgeDisplay";

export function UserBadgeIcons({
  badges,
  className = "",
}: {
  badges: string[];
  className?: string;
}) {
  const topCallerTimes = parseTopCallerTimesFromBadges(badges);
  const hasTrustedPro = badges.includes("trusted_pro");
  if (topCallerTimes <= 0 && !hasTrustedPro) return null;

  return (
    <span
      className={`inline-flex items-baseline gap-1 text-xs text-zinc-500 ${className}`.trim()}
      aria-hidden
    >
      {topCallerTimes > 0 ? (
        <span className="inline-flex items-baseline gap-0.5">
          <span className="dashboard-fire-emoji text-sm leading-none">🔥</span>
          {topCallerTimes > 1 ? (
            <span className="text-[9px] font-bold leading-none text-amber-400/95">
              {topCallerTimes}×
            </span>
          ) : null}
        </span>
      ) : null}
      {hasTrustedPro ? (
        <span className="text-sm leading-none">🧠</span>
      ) : null}
    </span>
  );
}

