import type { AffiliateAccountStatus } from "@/lib/affiliate/affiliateSession";

/** Partner cannot access hub until ops sets active (or suspended after activation). */
export const AFFILIATE_APPLICATION_GATE_STATUSES = [
  "pending",
  "needs_contact",
  "denied",
] as const satisfies readonly AffiliateAccountStatus[];

export type AffiliateApplicationGateStatus = (typeof AFFILIATE_APPLICATION_GATE_STATUSES)[number];

export function isAffiliateApplicationGateStatus(
  status: AffiliateAccountStatus
): status is AffiliateApplicationGateStatus {
  return (AFFILIATE_APPLICATION_GATE_STATUSES as readonly string[]).includes(status);
}

export const AFFILIATE_APPLICATION_STATUS_PATH = "/affiliate/application";

export const AFFILIATE_STATUS_LABELS: Record<AffiliateAccountStatus, string> = {
  pending: "Pending review",
  needs_contact: "Contact requested",
  denied: "Denied",
  active: "Active",
  suspended: "Suspended",
};

export const AFFILIATE_STATUS_BADGE_CLASS: Record<AffiliateAccountStatus, string> = {
  pending: "border-amber-300 bg-amber-50 text-amber-950",
  needs_contact: "border-violet-300 bg-violet-50 text-violet-950",
  denied: "border-red-300 bg-red-50 text-red-950",
  active: "border-emerald-300 bg-emerald-50 text-emerald-950",
  suspended: "border-zinc-300 bg-zinc-100 text-zinc-800",
};
