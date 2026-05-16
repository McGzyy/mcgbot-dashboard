type ProBadgeProps = {
  className?: string;
  size?: "xs" | "sm";
};

export function ProBadge({ className = "", size = "xs" }: ProBadgeProps) {
  const sizeClass =
    size === "sm"
      ? "px-2 py-0.5 text-[10px] tracking-[0.14em]"
      : "px-1.5 py-px text-[9px] tracking-[0.12em]";
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full border border-sky-400/40 bg-sky-500/15 font-bold uppercase text-sky-100 ${sizeClass} ${className}`.trim()}
    >
      Pro
    </span>
  );
}
