export const AFFILIATE_PAYOUT_METHODS = ["paypal", "usdc_solana", "other"] as const;

export type AffiliatePayoutMethod = (typeof AFFILIATE_PAYOUT_METHODS)[number];

export const AFFILIATE_PAYOUT_METHOD_LABELS: Record<AffiliatePayoutMethod, string> = {
  paypal: "PayPal",
  usdc_solana: "USDC (Solana)",
  other: "Other",
};

export type AffiliatePayoutMethodFields = {
  payoutMethod: AffiliatePayoutMethod | null;
  payoutDestination: string | null;
  payoutMethodUpdatedAt: string | null;
};

export function parseAffiliatePayoutMethod(raw: unknown): AffiliatePayoutMethod | null {
  if (typeof raw !== "string") return null;
  const s = raw.trim() as AffiliatePayoutMethod;
  return (AFFILIATE_PAYOUT_METHODS as readonly string[]).includes(s) ? s : null;
}

export function affiliatePayoutMethodConfigured(fields: AffiliatePayoutMethodFields): boolean {
  const method = fields.payoutMethod;
  const dest = fields.payoutDestination?.trim() ?? "";
  if (!method || dest.length < 3) return false;
  return validateAffiliatePayoutDestination(method, dest).ok;
}

export function validateAffiliatePayoutDestination(
  method: AffiliatePayoutMethod,
  destination: string
): { ok: true } | { ok: false; error: string } {
  const dest = destination.trim();
  if (dest.length < 3) {
    return { ok: false, error: "Payout destination is too short." };
  }
  if (dest.length > 500) {
    return { ok: false, error: "Payout destination is too long." };
  }

  if (method === "paypal") {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(dest)) {
      return { ok: false, error: "Enter a valid PayPal email address." };
    }
    return { ok: true };
  }

  if (method === "usdc_solana") {
    if (dest.length < 32 || dest.length > 64 || /\s/.test(dest)) {
      return { ok: false, error: "Enter a valid Solana wallet address." };
    }
    return { ok: true };
  }

  return { ok: true };
}

export function formatAffiliatePayoutMethodSummary(fields: AffiliatePayoutMethodFields): string {
  if (!fields.payoutMethod || !fields.payoutDestination?.trim()) return "Not configured";
  const label = AFFILIATE_PAYOUT_METHOD_LABELS[fields.payoutMethod];
  return `${label}: ${fields.payoutDestination.trim()}`;
}
