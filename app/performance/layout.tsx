import type { Metadata } from "next";
import type { ReactNode } from "react";
import { modChrome } from "@/lib/roleTierStyles";

export const metadata: Metadata = {
  title: "Performance",
  description: "Personal performance charts — averages, streaks, activity, and rank from your calls.",
};

/** Full-bleed grid + emerald glow — pairs visually with Performance lab copy. */
export default function PerformanceLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-w-0 space-y-10">
      <div className={`${modChrome.layoutGrid} absolute inset-0`} aria-hidden />
      <div
        className="pointer-events-none absolute -right-8 top-0 h-48 w-48 rounded-full bg-emerald-500/12 blur-3xl"
        aria-hidden
      />
      {children}
    </div>
  );
}
