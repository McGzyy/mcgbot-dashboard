import { getServerSession } from "next-auth";
import Stripe from "stripe";
import { authOptions } from "@/lib/auth";
import { isDiscordGuildMember } from "@/lib/discordGuildMember";
import { checkoutBaseUrl, getStripe } from "@/lib/subscription/stripeServer";
import {
  getPlanBySlug,
  getSubscriptionStripeCustomerId,
  upsertSubscriptionAfterPayment,
} from "@/lib/subscription/subscriptionDb";
import { consumeVoucherForPlan } from "@/lib/subscription/vouchers";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { resolveHelpTierAsync } from "@/lib/helpRole";
import { getSiteOperationalState } from "@/lib/siteOperationalState";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  const discordId = session?.user?.id?.trim() ?? "";
  if (!discordId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!getSupabaseAdmin()) {
    return Response.json({ success: false, error: "Database not configured" }, { status: 503 });
  }

  const stripe = getStripe();
  if (!stripe) {
    return Response.json(
      { success: false, error: "Stripe is not configured (missing STRIPE_SECRET_KEY)." },
      { status: 503 }
    );
  }

  const op = await getSiteOperationalState();
  const needBypass = op.maintenance_enabled || op.public_signups_paused;
  const tier = needBypass ? await resolveHelpTierAsync(discordId).catch(() => "user" as const) : "user";
  const isAdmin = tier === "admin";
  if (op.maintenance_enabled && !isAdmin) {
    return Response.json(
      { success: false, error: "Checkout is paused during maintenance.", code: "maintenance" },
      { status: 503 }
    );
  }
  if (op.public_signups_paused && !isAdmin) {
    return Response.json(
      { success: false, error: "New checkouts are temporarily paused.", code: "signups_paused" },
      { status: 403 }
    );
  }

  const inGuild = await isDiscordGuildMember(discordId);
  if (inGuild === false) {
    return Response.json(
      { success: false, error: "Join the McGBot Discord server before purchasing a subscription." },
      { status: 403 }
    );
  }
  if (inGuild === null) {
    return Response.json(
      {
        success: false,
        error:
          "Could not verify Discord membership (check DISCORD_GUILD_ID and DISCORD_BOT_TOKEN or DISCORD_TOKEN).",
      },
      { status: 503 }
    );
  }

  const body = (await request.json().catch(() => null)) as { planSlug?: string; voucherCode?: string } | null;
  const slug = typeof body?.planSlug === "string" ? body.planSlug.trim() : "";
  const voucherCode = typeof body?.voucherCode === "string" ? String(body.voucherCode) : "";
  if (!slug) {
    return Response.json({ success: false, error: "Missing planSlug" }, { status: 400 });
  }

  const plan = await getPlanBySlug(slug);
  if (!plan) {
    return Response.json({ success: false, error: "Unknown plan" }, { status: 400 });
  }

  let voucherPercentOff = 0;
  let voucherDurationDaysOverride: number | null = null;
  if (voucherCode && voucherCode.trim()) {
    const consumed = await consumeVoucherForPlan({ code: voucherCode, planSlug: plan.slug });
    if (!consumed.ok) {
      return Response.json({ success: false, error: consumed.error, code: consumed.code }, { status: 400 });
    }
    voucherPercentOff = consumed.voucher.percentOff;
    voucherDurationDaysOverride = consumed.voucher.durationDaysOverride;
  }

  const finalDurationDays =
    typeof voucherDurationDaysOverride === "number" && Number.isFinite(voucherDurationDaysOverride)
      ? voucherDurationDaysOverride
      : plan.duration_days;

  const planPercent = Math.max(
    0,
    Math.min(100, Math.round(Number((plan as { discount_percent?: number }).discount_percent ?? 0) || 0))
  );
  const listUsd = Math.max(0, Number(plan.price_usd));
  const afterPlanUsd = Math.max(0, listUsd * (1 - planPercent / 100));

  const voucherPercent = Math.max(0, Math.min(100, voucherPercentOff));
  const discountedUsd = Math.max(0, afterPlanUsd * (1 - voucherPercent / 100));

  if (discountedUsd <= 0) {
    const granted = await upsertSubscriptionAfterPayment({
      discordId,
      planId: plan.id,
      durationDays: finalDurationDays,
    });

    return Response.json({
      success: true,
      activated: true,
      via: "voucher",
      plan: { slug: plan.slug, label: plan.label, priceUsd: discountedUsd, durationDays: finalDurationDays },
      voucher: { percentOff: voucherPercent },
      subscriptionUpdated: Boolean(granted),
    });
  }

  const stripePriceId = typeof plan.stripe_price_id === "string" ? plan.stripe_price_id.trim() : "";
  if (!stripePriceId) {
    return Response.json(
      {
        success: false,
        error:
          "This plan is not linked to Stripe yet. In Supabase, set `subscription_plans.stripe_price_id` to your recurring Price ID (price_…) from the Stripe Dashboard, then try again.",
        code: "missing_stripe_price",
      },
      { status: 503 }
    );
  }

  let discounts: { coupon: string }[] | undefined;
  try {
    if (voucherPercent > 0 && voucherPercent < 100) {
      const coupon = await stripe.coupons.create({
        percent_off: voucherPercent,
        duration: "once",
        name: `Voucher ${plan.slug}`.slice(0, 40),
      });
      discounts = [{ coupon: coupon.id }];
    }

    const base = checkoutBaseUrl();
    const successUrl = `${base}/subscribe?stripe=done&session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${base}/subscribe?stripe=cancel`;

    const existingCustomerId = await getSubscriptionStripeCustomerId(discordId);

    // Stripe forbids `allow_promotion_codes` and `discounts` on the same session.
    const allowPromotionCodes = !discounts?.length;

    // Subscription mode: never pass `customer_creation` (Stripe only allows it in payment/setup).
    // With no `customer`, Checkout creates a Customer from details collected on the page.
    const checkoutSession = await stripe.checkout.sessions.create({
      mode: "subscription",
      client_reference_id: discordId.slice(0, 200),
      ...(existingCustomerId ? { customer: existingCustomerId } : {}),
      line_items: [{ price: stripePriceId, quantity: 1 }],
      ...(allowPromotionCodes ? { allow_promotion_codes: true } : {}),
      ...(discounts ? { discounts } : {}),
      metadata: {
        discord_id: discordId,
        plan_id: plan.id,
        plan_slug: plan.slug,
      },
      subscription_data: {
        metadata: {
          discord_id: discordId,
          plan_id: plan.id,
          plan_slug: plan.slug,
        },
      },
      success_url: successUrl,
      cancel_url: cancelUrl,
    });

    if (!checkoutSession.url) {
      return Response.json({ success: false, error: "Stripe did not return a checkout URL." }, { status: 500 });
    }

    return Response.json({
      success: true,
      url: checkoutSession.url,
      plan: { slug: plan.slug, label: plan.label, priceUsd: discountedUsd, durationDays: plan.duration_days },
      voucher: voucherPercent > 0 ? { percentOff: voucherPercent } : null,
      planDiscount: planPercent > 0 ? { percentOff: planPercent, listPriceUsd: listUsd } : null,
      billing: "stripe_subscription" as const,
    });
  } catch (e: unknown) {
    console.error("[create-checkout-session]", e);
    if (e instanceof Stripe.errors.StripeError) {
      return Response.json(
        {
          success: false,
          error: e.message,
          code: e.code ?? "stripe_error",
        },
        { status: typeof e.statusCode === "number" && e.statusCode >= 400 && e.statusCode < 600 ? e.statusCode : 502 }
      );
    }
    const message = e instanceof Error ? e.message : "unknown_error";
    return Response.json({ success: false, error: message, code: "checkout_failed" }, { status: 502 });
  }
}
