import { headers } from "next/headers";
import Stripe from "stripe";

import { applyPaidStripeCheckoutSession } from "@/lib/subscription/stripeApplySession";
import { getStripe } from "@/lib/subscription/stripeServer";
import { tryInsertStripeSubscriptionRenewalMembershipEvent } from "@/lib/subscription/stripeMembershipRenewal";
import {
  syncDiscordSubscriptionFromStripeId,
  syncDiscordSubscriptionFromStripeSubscription,
} from "@/lib/subscription/stripeSubscriptionSync";

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
    if (!result.ok && result.error !== "not_paid" && result.error !== "checkout_not_complete") {
      console.error("[stripe webhook] checkout.session.completed apply failed", result.error, session.id);
    }
  }

  if (event.type === "invoice.paid") {
    const invoice = event.data.object as Stripe.Invoice;
    const sid = (invoice as unknown as { subscription?: string | null }).subscription;
    if (typeof sid === "string" && sid) {
      const result = await syncDiscordSubscriptionFromStripeId({ stripe, subscriptionId: sid });
      if (!result.ok && result.error !== "subscription_not_ready") {
        console.error("[stripe webhook] invoice.paid sync failed", result.error, sid);
      }
      if (result.ok) {
        try {
          await tryInsertStripeSubscriptionRenewalMembershipEvent({ stripe, invoice });
        } catch (e) {
          console.error("[stripe webhook] invoice.paid membership_events insert", e);
        }
      }
    }
  }

  if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
    const sub = event.data.object as Stripe.Subscription;
    const result = await syncDiscordSubscriptionFromStripeSubscription({ stripe, subscription: sub });
    if (!result.ok && result.error !== "subscription_not_ready") {
      console.error(`[stripe webhook] ${event.type} sync failed`, result.error, sub.id);
    }
  }

  return Response.json({ received: true });
}
