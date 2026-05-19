import type { ReactNode } from "react";
import { AffiliatePartnerPublicNav } from "@/app/affiliate/(partner)/_components/AffiliatePartnerPublicNav";
import { AffiliatePortalLogo } from "@/app/components/AffiliatePortalLogo";
import { AFFILIATE_PORTAL_BUILD_ID } from "@/lib/affiliate/affiliatePortalBuild";

/**
 * Partner-facing affiliate portal — light theme, separate from the McGBot member terminal.
 * Same backend (Supabase, Stripe metadata); different surface and auth (email + TOTP cookie).
 */
export default function AffiliatePartnerShellLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 text-zinc-900 antialiased selection:bg-violet-200/80 selection:text-violet-950">
      <header className="sticky top-0 z-40 border-b border-zinc-200/90 bg-white/95 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-white/85">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3.5 sm:px-6">
          <AffiliatePortalLogo href="/affiliate/login" subtitle="Partner program" />
          <AffiliatePartnerPublicNav />
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="mt-auto border-t border-zinc-200/80 bg-white/70 py-5 text-center text-[11px] leading-relaxed text-zinc-500">
        <p>This portal is not the McGBot member dashboard. Partner sign-in and payouts use this site only.</p>
        <p className="mt-1 font-mono text-[10px] text-zinc-400" title="Deploy verification">
          build {AFFILIATE_PORTAL_BUILD_ID}
        </p>
      </footer>
    </div>
  );
}
