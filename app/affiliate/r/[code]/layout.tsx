import type { ReactNode } from "react";
import { AffiliatePortalLogo } from "@/app/components/AffiliatePortalLogo";

/** Public referral landing — no partner sign-in chrome. */
export default function AffiliateReferralLandingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 text-zinc-900 antialiased">
      <header className="border-b border-zinc-200/90 bg-white px-4 py-4 shadow-sm sm:px-6">
        <AffiliatePortalLogo href="" />
      </header>
      <main className="flex flex-1 flex-col">{children}</main>
      <footer className="border-t border-zinc-200/80 py-4 text-center text-[11px] text-zinc-500">
        McGBot Terminal · Discord membership required
      </footer>
    </div>
  );
}
