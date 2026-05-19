import type { ReactNode } from "react";
import { AffiliatePublicShell } from "@/app/affiliate/_components/AffiliatePublicShell";

/**
 * Affiliate-facing portal — light theme, separate from the McGBot member terminal.
 * Same backend (Supabase, Stripe metadata); different surface and auth (email + TOTP cookie).
 */
export default function AffiliatePartnerShellLayout({ children }: { children: ReactNode }) {
  return <AffiliatePublicShell>{children}</AffiliatePublicShell>;
}
