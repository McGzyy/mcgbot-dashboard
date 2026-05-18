import type { AffiliateSessionClaims } from "@/lib/affiliate/affiliateSession";
import { affiliateSessionFullyVerified } from "@/lib/affiliate/affiliateSession";

/** Where to send a partner after login or 2FA, based on approval + TOTP state. */
export function affiliatePostAuthPath(session: AffiliateSessionClaims): string {
  if (session.needsTotpEnrollment) return "/affiliate/auth/setup";
  if (session.pendingTotpVerification) return "/affiliate/auth/totp";
  if (!affiliateSessionFullyVerified(session)) return "/affiliate/auth/totp";
  if (session.status === "pending") return "/affiliate/pending";
  if (session.needsAgreement) return "/affiliate/auth/agreement";
  return "/affiliate/dashboard";
}
