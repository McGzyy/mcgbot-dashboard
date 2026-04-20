import type { Metadata } from "next";
import type { ReactNode } from "react";
import { modChrome } from "@/lib/roleTierStyles";

export const metadata: Metadata = {
  title: "Watchlist",
  description:
    "Track Solana contract addresses privately or publish them to the shared dashboard watchlist.",
};

export default function WatchlistLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-w-0 space-y-10">
      <div className={`${modChrome.layoutGrid} absolute inset-0`} aria-hidden />
      <div
        className="pointer-events-none absolute -left-10 top-0 h-56 w-56 rounded-full bg-fuchsia-500/10 blur-3xl"
        aria-hidden
      />
      {children}
    </div>
  );
}

