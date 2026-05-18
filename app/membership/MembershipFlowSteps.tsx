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
      className="mx-auto w-full max-w-3xl rounded-2xl border border-zinc-800/70 bg-zinc-950/50 p-3 ring-1 ring-white/[0.03] sm:p-4"
    >
      <ol className="grid grid-cols-1 gap-2 sm:grid-cols-3 sm:gap-3">
        {STEPS.map((s) => (
          <li
            key={s.n}
            className="flex items-start gap-3 rounded-xl border border-zinc-800/60 bg-black/25 px-3 py-2.5 sm:flex-col sm:items-center sm:text-center sm:px-2"
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-zinc-700/80 bg-zinc-900/80 text-[11px] font-bold tabular-nums text-zinc-300">
              {s.n}
            </span>
            <span className="min-w-0">
              <span className="block text-xs font-semibold text-zinc-200">{s.label}</span>
              <span className="mt-0.5 block text-[11px] leading-snug text-zinc-500">{s.detail}</span>
            </span>
          </li>
        ))}
      </ol>
    </nav>
  );
}
