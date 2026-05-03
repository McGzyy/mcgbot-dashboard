import type { HTMLAttributes, ReactNode } from "react";
import { terminalSurface } from "@/lib/terminalDesignTokens";

/** Bordered panel used across admin sections. */
export function AdminPanel({
  children,
  className = "",
  ...rest
}: {
  children: ReactNode;
  className?: string;
} & Omit<HTMLAttributes<HTMLDivElement>, "className" | "children">) {
  return (
    <div
      {...rest}
      className={`rounded-2xl border border-zinc-800/90 bg-gradient-to-b from-zinc-900/80 to-zinc-950/90 ${terminalSurface.insetEdge} shadow-sm shadow-black/20 backdrop-blur-sm ${className}`}
    >
      {children}
    </div>
  );
}

export function AdminMetric({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: ReactNode;
  tone?: "ok" | "warn" | "bad" | "neutral";
}) {
  const dot =
    tone === "ok"
      ? "bg-emerald-400"
      : tone === "warn"
        ? "bg-amber-400"
        : tone === "bad"
          ? "bg-red-400"
          : "bg-zinc-500";
  return (
    <div className="flex items-start gap-2">
      <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${dot}`} aria-hidden />
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">{label}</p>
        <div className="mt-0.5 text-sm font-medium text-zinc-100">{value}</div>
      </div>
    </div>
  );
}
