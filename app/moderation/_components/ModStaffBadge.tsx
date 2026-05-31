import { modChrome } from "@/lib/roleTierStyles";

export function ModStaffBadge({
  helpTier,
  roleTier,
  compact = false,
}: {
  helpTier?: string | null;
  roleTier?: string | null;
  compact?: boolean;
}) {
  const isAdmin = helpTier === "admin";
  const isHeadMod = roleTier === "head_mod";
  const label = isAdmin ? "Admin" : isHeadMod ? "Head mod" : "Staff";
  const detail = isAdmin ? "Operator" : isHeadMod ? "Lead moderator" : "Moderator";

  if (compact) {
    return (
      <span
        className={`inline-flex items-center rounded-full border border-emerald-500/30 bg-emerald-950/50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-200/95 shadow-[0_0_16px_-8px_rgba(16,185,129,0.5)] ${modChrome.borderSoft}`}
      >
        {label}
      </span>
    );
  }

  return (
    <span
      className={`inline-flex flex-col rounded-lg border px-2.5 py-1 ${modChrome.borderMedium} bg-emerald-950/40 shadow-[0_0_20px_-10px_rgba(16,185,129,0.45)]`}
    >
      <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-200/95">{label}</span>
      <span className="text-[10px] text-emerald-500/70">{detail}</span>
    </span>
  );
}
