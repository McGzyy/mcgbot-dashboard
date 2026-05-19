import type { ReactNode } from "react";
import { AffiliatePublicFooter } from "@/app/affiliate/_components/AffiliatePublicFooter";
import { AffiliatePublicNav } from "@/app/affiliate/_components/AffiliatePublicNav";
import { AffiliatePortalLogo } from "@/app/components/AffiliatePortalLogo";

/** Shared chrome for marketing pages and unauthenticated affiliate flows. */
export function AffiliatePublicShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 text-zinc-900 antialiased selection:bg-violet-200/80 selection:text-violet-950">
      <header className="sticky top-0 z-40 border-b border-zinc-200/90 bg-white/95 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-white/85">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3.5 sm:px-6">
          <AffiliatePortalLogo href="/affiliate" subtitle="Affiliate program" />
          <AffiliatePublicNav />
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <AffiliatePublicFooter />
    </div>
  );
}
