"use client";

type Step = { n: number; label: string; detail: string };

const STEPS: Step[] = [
  { n: 1, label: "Choose tier", detail: "Basic or Pro" },
  { n: 2, label: "Pick billing", detail: "Monthly or annual" },
  { n: 3, label: "Pay & unlock", detail: "Stripe or SOL" },
];

export function MembershipFlowSteps() {
  return (
    <nav
      aria-label="Membership steps"
      className="mx-auto w-full max-w-3xl rounded-xl border border-zinc-800/70 bg-zinc-950/50 p-2 ring-1 ring-white/[0.03] sm:rounded-2xl sm:p-4"
    >
      <ol className="grid grid-cols-3 gap-1.5 sm:gap-3">
        {STEPS.map((s) => (
          <li
            key={s.n}
            className="flex flex-col items-center rounded-lg border border-zinc-800/60 bg-black/25 px-1.5 py-2 text-center sm:rounded-xl sm:px-2 sm:py-2.5"
          >
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-zinc-700/80 bg-zinc-900/80 text-[10px] font-bold tabular-nums text-zinc-300 sm:h-7 sm:w-7 sm:text-[11px]">
              {s.n}
            </span>
            <span className="mt-1 min-w-0">
              <span className="block text-[10px] font-semibold leading-tight text-zinc-200 sm:text-xs">
                {s.label}
              </span>
              <span className="mt-0.5 hidden text-[11px] leading-snug text-zinc-500 sm:block">
                {s.detail}
              </span>
            </span>
          </li>
        ))}
      </ol>
    </nav>
  );
}
