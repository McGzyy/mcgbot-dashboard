import type { ReactNode } from "react";

/** Partner + admin shells share background only; width is set per section. */
export default function AffiliateLayout({ children }: { children: ReactNode }) {
  return <div className="min-h-screen bg-zinc-950 text-zinc-100">{children}</div>;
}
