import { getServerSession } from "next-auth";
import Stripe from "stripe";
import { authOptions } from "@/lib/auth";
import { isDiscordGuildMember } from "@/lib/discordGuildMember";
import { checkoutBaseUrl, getStripe } from "@/lib/subscription/stripeServer";
import { getDashboardAdminSettings } from "@/lib/dashboardAdminSettingsDb";
import { getPlanById, getPlanBySlug, getSubscriptionStripeCustomerId } from "@/lib/subscription/subscriptionDb";
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

  const body = (await request.json().catch(() => null)) as {
    planSlug?: string;
    voucherCode?: string;
    testCheckout?: boolean;
  } | null;
  const testCheckout = body?.testCheckout === true;
  const slug = typeof body?.planSlug === "string" ? body.planSlug.trim() : "";
  if (typeof body?.voucherCode === "string" && body.voucherCode.trim()) {
    return Response.json(
      {
        success: false,
        error:
          "Dashboard voucher codes are not applied to card checkout. Use a Stripe promotion code on the Stripe checkout page, or redeem a complimentary (100% off) code under “Complimentary access” on this page.",
        code: "voucher_use_complimentary_flow",
      },
      { status: 400 }
    );
  }

  let plan: Awaited<ReturnType<typeof getPlanBySlug>>;
  let stripePriceId: string;
  let planPercent: number;
  let listUsd: number;
  let displayEffectiveUsd: number;

  if (testCheckout) {
    const adminRow = await getDashboardAdminSettings();
    if (!adminRow?.stripe_test_checkout_enabled) {
      return Response.json(
        { success: false, error: "Stripe test checkout is not enabled.", code: "test_checkout_disabled" },
        { status: 403 }
      );
    }
    stripePriceId = typeof adminRow.stripe_test_price_id === "string" ? adminRow.stripe_test_price_id.trim() : "";
    if (!stripePriceId || !/^price_[a-zA-Z0-9]+$/.test(stripePriceId)) {
      return Response.json(
        {
          success: false,
          error:
            "Test checkout has no valid Stripe price. In Site admin settings, set the test Price ID (price_…) to match your Stripe API mode.",
          code: "missing_test_stripe_price",
        },
        { status: 503 }
      );
    }
    const planIdHint =
      typeof adminRow.stripe_test_plan_id === "string" ? adminRow.stripe_test_plan_id.trim() : "";
    plan = planIdHint ? await getPlanById(planIdHint) : null;
    if (!plan) {
      plan = await getPlanBySlug("monthly");
    }
    if (!plan) {
      return Response.json(
        {
          success: false,
          error: "Could not resolve a subscription plan for test checkout metadata. Set stripe_test_plan_id or ensure an active monthly plan exists.",
          code: "test_plan_missing",
        },
        { status: 503 }
      );
    }
    planPercent = 0;
    listUsd = 1;
    displayEffectiveUsd = 1;
  } else {
    if (!slug) {
      return Response.json({ success: false, error: "Missing planSlug" }, { status: 400 });
    }

    plan = await getPlanBySlug(slug);
    if (!plan) {
      return Response.json({ success: false, error: "Unknown plan" }, { status: 400 });
    }

    planPercent = Math.max(
      0,
      Math.min(100, Math.round(Number((plan as { discount_percent?: number }).discount_percent ?? 0) || 0))
    );
    listUsd = Math.max(0, Number(plan.price_usd));
    displayEffectiveUsd = Math.max(0, listUsd * (1 - planPercent / 100));

    stripePriceId = typeof plan.stripe_price_id === "string" ? plan.stripe_price_id.trim() : "";
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
  }

  try {
    const base = checkoutBaseUrl();
    const successUrl = `${base}/membership?stripe=done&session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${base}/membership?stripe=cancel`;

    const existingCustomerId = await getSubscriptionStripeCustomerId(discordId);

    const checkoutSession = await stripe.checkout.sessions.create({
      mode: "subscription",
      client_reference_id: discordId.slice(0, 200),
      ...(existingCustomerId ? { customer: existingCustomerId } : {}),
      line_items: [{ price: stripePriceId, quantity: 1 }],
      allow_promotion_codes: !testCheckout,
      metadata: {
        discord_id: discordId,
        plan_id: plan.id,
        plan_slug: plan.slug,
        ...(testCheckout ? { stripe_test_checkout: "1" } : {}),
      },
      subscription_data: {
        metadata: {
          discord_id: discordId,
          plan_id: plan.id,
          plan_slug: plan.slug,
          ...(testCheckout ? { stripe_test_checkout: "1" } : {}),
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
      plan: {
        slug: plan.slug,
        label: testCheckout ? `${plan.label} (Stripe test price)` : plan.label,
        priceUsd: displayEffectiveUsd,
        durationDays: plan.duration_days,
      },
      voucher: null,
      planDiscount: !testCheckout && planPercent > 0 ? { percentOff: planPercent, listPriceUsd: listUsd } : null,
      billing: "stripe_subscription" as const,
      testCheckout: testCheckout ? true : undefined,
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
