import { headers } from "next/headers";
import Stripe from "stripe";

import { applyPaidStripeCheckoutSession } from "@/lib/subscription/stripeApplySession";
import { getStripe } from "@/lib/subscription/stripeServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const stripe = getStripe();
  const whSecret = (process.env.STRIPE_WEBHOOK_SECRET ?? "").trim();
  if (!stripe || !whSecret) {
    return Response.json({ error: "Stripe webhook not configured" }, { status: 503 });
  }

  const body = await request.text();
  const sig = (await headers()).get("stripe-signature");
  if (!sig) {
    return Response.json({ error: "Missing stripe-signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, whSecret);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "invalid payload";
    return Response.json({ error: msg }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const result = await applyPaidStripeCheckoutSession(session);
    if (!result.ok && result.error !== "not_paid") {
      console.error("[stripe webhook] apply failed", result.error, session.id);
    }
  }

  return Response.json({ received: true });
}
