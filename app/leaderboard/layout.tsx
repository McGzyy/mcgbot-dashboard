import type { Metadata } from "next";
import type { ReactNode } from "react";
import { modChrome } from "@/lib/roleTierStyles";

export const metadata: Metadata = {
  title: "Leaderboards",
  description: "Public caller rankings, spotlight leaders, and community records on McGBot Terminal.",
};

export default function LeaderboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-w-0 space-y-10">
      <div className={`${modChrome.layoutGrid} absolute inset-0`} aria-hidden />
      <div
        className="pointer-events-none absolute -right-10 top-0 h-56 w-56 rounded-full bg-cyan-500/10 blur-3xl"
        aria-hidden
      />
      {children}
    </div>
  );
}
