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
  needs_contact: "border-amber-400 bg-amber-100 text-amber-950",
  denied: "border-zinc-300 bg-zinc-100 text-zinc-600",
  active: "border-emerald-300 bg-emerald-50 text-emerald-950",
  suspended: "border-zinc-300 bg-zinc-100 text-zinc-800",
};

/** Table row surface + hover for affiliate admin “All accounts”. */
export function affiliateAccountRowClass(
  status: AffiliateAccountStatus,
  selected: boolean
): string {
  const base = "text-zinc-800 transition-colors";
  const selectedRing = selected ? "ring-1 ring-inset ring-violet-300" : "";

  switch (status) {
    case "denied":
      return `${base} bg-zinc-100/95 text-zinc-500 ${selectedRing}`;
    case "active":
      return `${base} cursor-pointer bg-emerald-50/70 hover:bg-emerald-100/80 border-l-2 border-l-emerald-500 ${selectedRing}`;
    case "needs_contact":
      return `${base} cursor-pointer bg-amber-50/80 hover:bg-amber-100/90 border-l-2 border-l-amber-400 ${selectedRing}`;
    case "pending":
      return `${base} cursor-pointer hover:bg-amber-50/50 ${selectedRing}`;
    case "suspended":
      return `${base} cursor-pointer bg-zinc-50/80 hover:bg-zinc-100/90 border-l-2 border-l-zinc-400 ${selectedRing}`;
    default:
      return `${base} hover:bg-zinc-50 ${selectedRing}`;
  }
}

/** Row click affordance hint (title attribute). */
export function affiliateAccountRowClickHint(status: AffiliateAccountStatus): string | undefined {
  if (status === "active" || status === "suspended") return "Open affiliate profile";
  if (status === "needs_contact" || status === "pending") return "View application";
  if (status === "denied") return "View denied application";
  return undefined;
}

/** Active/suspended partners open the full profile route; applications stay inline. */
export function affiliateAccountOpensPartnerProfile(status: AffiliateAccountStatus): boolean {
  return status === "active" || status === "suspended";
}
