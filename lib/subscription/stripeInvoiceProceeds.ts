import type Stripe from "stripe";

export type StripeInvoiceProceeds = {
  grossCents: number;
  stripeFeeCents: number;
  netCents: number;
  feeSource: "balance_transaction" | "estimate";
};

function resolveChargeIdFromInvoice(invoice: Stripe.Invoice): string | null {
  const chargeRef = (invoice as Stripe.Invoice & { charge?: string | Stripe.Charge | null }).charge;
  if (typeof chargeRef === "string" && chargeRef.trim()) return chargeRef.trim();
  if (chargeRef && typeof chargeRef === "object" && "id" in chargeRef) {
    return String((chargeRef as { id: string }).id).trim();
  }

  const piRef = (invoice as Stripe.Invoice & { payment_intent?: string | Stripe.PaymentIntent | null })
    .payment_intent;
  if (typeof piRef === "object" && piRef !== null && "latest_charge" in piRef) {
    const lc = (piRef as Stripe.PaymentIntent).latest_charge;
    if (typeof lc === "string" && lc.trim()) return lc.trim();
    if (lc && typeof lc === "object" && "id" in lc) return String((lc as { id: string }).id).trim();
  }

  return null;
}

/** US card estimate when balance_transaction is unavailable (2.9% + $0.30 by default). */
export function estimateStripeFeeCents(grossCents: number): number {
  const gross = Math.floor(grossCents);
  if (gross <= 0) return 0;
  const bps = Math.floor(Number(process.env.STRIPE_FEE_ESTIMATE_BPS ?? 290)) || 290;
  const fixed = Math.floor(Number(process.env.STRIPE_FEE_ESTIMATE_FIXED_CENTS ?? 30)) || 30;
  return Math.min(gross, Math.floor((gross * bps) / 10_000) + fixed);
}

/**
 * Gross = invoice.amount_paid. Net = Stripe balance_transaction.net (deposit after fees).
 * Affiliate rev-share is calculated on net, not gross.
 */
export async function resolveStripeInvoiceProceedsCents(
  stripe: Stripe,
  invoice: Stripe.Invoice
): Promise<StripeInvoiceProceeds | null> {
  const grossCents = Math.floor(typeof invoice.amount_paid === "number" ? invoice.amount_paid : 0);
  if (!Number.isFinite(grossCents) || grossCents <= 0) return null;

  const chargeId = resolveChargeIdFromInvoice(invoice);
  if (chargeId) {
    try {
      const charge = await stripe.charges.retrieve(chargeId, {
        expand: ["balance_transaction"],
      });
      const bt = charge.balance_transaction;
      if (bt && typeof bt === "object" && !Array.isArray(bt)) {
        const fee = Math.max(0, Math.floor(bt.fee));
        const net = Math.max(0, Math.floor(bt.net));
        if (net > 0) {
          return { grossCents, stripeFeeCents: fee, netCents: net, feeSource: "balance_transaction" };
        }
      }
    } catch (e) {
      console.warn("[stripeInvoiceProceeds] charge lookup failed", chargeId, e);
    }
  }

  const stripeFeeCents = estimateStripeFeeCents(grossCents);
  return {
    grossCents,
    stripeFeeCents,
    netCents: Math.max(0, grossCents - stripeFeeCents),
    feeSource: "estimate",
  };
}
