type Tone = "default" | "violet" | "emerald" | "amber" | "sky";

const TONE: Record<Tone, string> = {
  default: "border-zinc-200/90 bg-white",
  violet: "border-violet-200/80 bg-violet-50/50",
  emerald: "border-emerald-200/80 bg-emerald-50/50",
  amber: "border-amber-200/80 bg-amber-50/60",
  sky: "border-sky-200/80 bg-sky-50/50",
};

export function AffiliateMetricCard({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: Tone;
}) {
  return (
    <div className={`rounded-2xl border px-4 py-3.5 shadow-sm ${TONE[tone]}`}>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">{label}</p>
      <p className="mt-1.5 text-2xl font-bold tabular-nums tracking-tight text-zinc-900">{value}</p>
      {hint ? <p className="mt-1 text-[11px] leading-snug text-zinc-500">{hint}</p> : null}
    </div>
  );
}
