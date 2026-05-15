"use client";

/** Indeterminate top edge for polling / refetch (`animate-mcg-refresh` in tailwind.config). */
export function DashboardRefreshBar({ active }: { active: boolean }) {
  if (!active) return null;
  return (
    <div
      className="pointer-events-none absolute left-0 right-0 top-0 z-[5] h-[2px] overflow-hidden rounded-t-xl bg-zinc-800/50"
      aria-hidden
    >
      <div className="h-full w-[42%] rounded-full bg-gradient-to-r from-transparent via-sky-400/70 to-transparent motion-reduce:animate-none animate-mcg-refresh" />
    </div>
  );
}
