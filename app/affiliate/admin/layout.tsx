import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Affiliate ops",
  description: "McGBot affiliate operations (Discord admin only).",
  robots: { index: false, follow: false },
};

/** Light ops plane — separate from the member terminal and partner dark pages. */
export default function AffiliateAdminRootLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 antialiased selection:bg-violet-200/80 selection:text-violet-950">
      {children}
    </div>
  );
}
