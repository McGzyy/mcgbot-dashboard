import type { Metadata } from "next";
import type { ReactNode } from "react";
import { modChrome } from "@/lib/roleTierStyles";

export const metadata: Metadata = {
  title: "Call tape",
  description: "Your verified calls — contracts, ATH multiples, source, and jump links.",
};

/** Full-bleed grid (same as moderation/admin) + sky glow for user analytics routes. */
export default function CallsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-w-0 space-y-10">
      <div className={`${modChrome.layoutGrid} absolute inset-0`} aria-hidden />
      <div
        className="pointer-events-none absolute -left-6 -top-6 h-52 w-52 rounded-full bg-sky-500/12 blur-3xl"
        aria-hidden
      />
      {children}
    </div>
  );
}
