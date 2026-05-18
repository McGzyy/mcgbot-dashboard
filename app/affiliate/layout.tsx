import type { ReactNode } from "react";

export default function AffiliateLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-lg px-4 py-10 sm:py-14">{children}</div>
    </div>
  );
}
