import type { Metadata } from "next";
import type { ReactNode } from "react";
import { modChrome } from "@/lib/roleTierStyles";

export const metadata: Metadata = {
  title: "Moderation",
  description: "Staff moderation queue and tools for McGBot Terminal.",
  robots: { index: false, follow: false },
};

/** Same depth treatment as `app/admin/layout.tsx` — full-bleed grid + accent glow (emerald for staff). */
export default function ModerationLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-w-0 space-y-10">
      <div className={`${modChrome.layoutGrid} absolute inset-0`} aria-hidden />
      <div className={modChrome.layoutGlow} aria-hidden />
      {children}
    </div>
  );
}
