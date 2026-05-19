"use client";

import { AFFILIATE_APPLY_STEPS } from "@/lib/affiliate/affiliateRegisterCopy";

type Props = { current: 1 | 2 | 3 };

export function AffiliateRegisterStepIndicator({ current }: Props) {
  return (
    <ol className="grid gap-3 sm:grid-cols-3" aria-label="Application progress">
      {AFFILIATE_APPLY_STEPS.map((s) => {
        const done = current > s.id;
        const active = current === s.id;
        return (
          <li
            key={s.id}
            className={
              active
                ? "rounded-xl border border-violet-300 bg-violet-50/90 px-3 py-2.5 shadow-sm"
                : done
                  ? "rounded-xl border border-violet-100 bg-white px-3 py-2.5"
                  : "rounded-xl border border-zinc-200/80 bg-white/60 px-3 py-2.5"
            }
          >
            <div className="flex items-center gap-2">
              <span
                className={
                  active || done
                    ? "flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-violet-600 text-[11px] font-bold text-white"
                    : "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-zinc-300 bg-zinc-50 text-[11px] font-bold text-zinc-500"
                }
                aria-hidden
              >
                {done ? "✓" : s.id}
              </span>
              <span className="min-w-0">
                <span className="block text-xs font-semibold text-zinc-900">{s.title}</span>
                <span className="hidden text-[10px] leading-snug text-zinc-500 sm:block">{s.description}</span>
              </span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
