import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isDiscordGuildMember } from "@/lib/discordGuildMember";
import { checkoutBaseUrl, getStripe } from "@/lib/subscription/stripeServer";
import { getPlanBySlug, upsertSubscriptionAfterPayment } from "@/lib/subscription/subscriptionDb";
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

  const planPercent = Math.max(0, Math.min(100, Math.round(Number((plan as { discount_percent?: number }).discount_percent ?? 0) || 0)));
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

  const priceCents = Math.round(discountedUsd * 100);
  if (priceCents < 50) {
    return Response.json({ success: false, error: "Amount below Stripe minimum ($0.50)." }, { status: 400 });
  }

  const base = checkoutBaseUrl();
  const successUrl = `${base}/subscribe?stripe=done&session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl = `${base}/subscribe?stripe=cancel`;

  const checkoutSession = await stripe.checkout.sessions.create({
    mode: "payment",
    client_reference_id: discordId.slice(0, 200),
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: priceCents,
          product_data: {
            name: `McGBot — ${plan.label}`,
            description: `${finalDurationDays} days dashboard access`,
          },
        },
      },
    ],
    metadata: {
      discord_id: discordId,
      plan_id: plan.id,
      duration_days: String(finalDurationDays),
      price_cents: String(priceCents),
      plan_slug: plan.slug,
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
    plan: { slug: plan.slug, label: plan.label, priceUsd: discountedUsd, durationDays: finalDurationDays },
    voucher: voucherPercent > 0 ? { percentOff: voucherPercent } : null,
    planDiscount: planPercent > 0 ? { percentOff: planPercent, listPriceUsd: listUsd } : null,
  });
}
