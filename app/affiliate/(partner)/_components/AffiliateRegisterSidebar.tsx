import {
  AFFILIATE_AFTER_APPLY_STEPS,
  AFFILIATE_PROGRAM_HIGHLIGHTS,
} from "@/lib/affiliate/affiliateRegisterCopy";

export function AffiliateRegisterSidebar() {
  return (
    <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
      <div className="rounded-2xl border border-violet-200/80 bg-gradient-to-br from-violet-50 to-white p-5 shadow-sm">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-violet-800/90">McGBot partner program</p>
        <p className="mt-2 text-sm leading-relaxed text-zinc-700">
          Earn recurring commission when your audience subscribes to McGBot Terminal. This portal is separate from the
          member Discord dashboard.
        </p>
        <ul className="mt-4 space-y-2">
          {AFFILIATE_PROGRAM_HIGHLIGHTS.map((h) => (
            <li key={h.label} className="flex justify-between gap-2 text-xs">
              <span className="text-zinc-500">{h.label}</span>
              <span className="font-semibold text-zinc-900">{h.value}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="rounded-2xl border border-zinc-200/90 bg-white p-5 shadow-sm">
        <p className="text-xs font-semibold text-zinc-900">After you submit</p>
        <ol className="mt-3 space-y-2.5">
          {AFFILIATE_AFTER_APPLY_STEPS.map((line, i) => (
            <li key={line} className="flex gap-2.5 text-xs leading-relaxed text-zinc-600">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-[10px] font-bold text-zinc-600">
                {i + 1}
              </span>
              {line}
            </li>
          ))}
        </ol>
      </div>
      <p className="text-[11px] leading-relaxed text-zinc-500">
        We review promotion fit and compliance — honest answers help us approve faster.
      </p>
    </aside>
  );
}
