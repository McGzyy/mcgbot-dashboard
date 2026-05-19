export type { AffiliateLandingContext } from "@/lib/affiliate/affiliateReferralResolve";
export {
  resolveAffiliateLandingByPublicCode,
  resolveAffiliateLandingBySlug,
} from "@/lib/affiliate/affiliateReferralResolve";

/** @deprecated Use resolveAffiliateLandingBySlug */
export { resolveAffiliateLandingBySlug as resolveAffiliateLanding } from "@/lib/affiliate/affiliateReferralResolve";
