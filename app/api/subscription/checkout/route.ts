import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isDiscordGuildMember } from "@/lib/discordGuildMember";
import { getPlanBySlug, upsertSubscriptionAfterPayment } from "@/lib/subscription/subscriptionDb";
import { consumeVoucherForPlan, peekVoucherForPlan } from "@/lib/subscription/vouchers";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { resolveHelpTierAsync } from "@/lib/helpRole";
import { getSiteOperationalState } from "@/lib/siteOperationalState";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Free / 100%-off voucher activation only. Paid plans use Stripe (`/api/subscription/stripe/create-checkout-session`).
 */
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  const discordId = session?.user?.id?.trim() ?? "";
  if (!discordId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!getSupabaseAdmin()) {
    return Response.json({ success: false, error: "Database not configured" }, { status: 503 });
  }

  const op = await getSiteOperationalState();
  const needBypass = op.maintenance_enabled || op.public_signups_paused;
  const tier = needBypass ? await resolveHelpTierAsync(discordId).catch(() => "user" as const) : "user";
  const isAdmin = tier === "admin";
  if (op.maintenance_enabled && !isAdmin) {
    return Response.json(
      {
        success: false,
        error: "Checkout is paused during maintenance.",
        code: "maintenance",
      },
      { status: 503 }
    );
  }
  if (op.public_signups_paused && !isAdmin) {
    return Response.json(
      {
        success: false,
        error: "New checkouts are temporarily paused.",
        code: "signups_paused",
      },
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

  const body = (await request.json().catch(() => null)) as { planSlug?: string } | null;
  const slug = typeof body?.planSlug === "string" ? body.planSlug.trim() : "";
  if (!slug) {
    return Response.json({ success: false, error: "Missing planSlug" }, { status: 400 });
  }
  const voucherCode = typeof (body as { voucherCode?: string })?.voucherCode === "string"
    ? String((body as { voucherCode?: string }).voucherCode)
    : "";

  const plan = await getPlanBySlug(slug);
  if (!plan) {
    return Response.json({ success: false, error: "Unknown plan" }, { status: 400 });
  }

  let voucherPercentOff = 0;
  let voucherDurationDaysOverride: number | null = null;
  if (voucherCode && voucherCode.trim()) {
    const peeked = await peekVoucherForPlan({ code: voucherCode, planSlug: plan.slug });
    if (!peeked.ok) {
      return Response.json({ success: false, error: peeked.error, code: peeked.code }, { status: 400 });
    }
    voucherPercentOff = peeked.voucher.percentOff;
    voucherDurationDaysOverride = peeked.voucher.durationDaysOverride;
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

  if (discountedUsd > 0) {
    return Response.json(
      {
        success: false,
        error:
          "That code is not a full (100%) complimentary voucher. For discounts on card checkout, use a Stripe promotion code on the Stripe payment page.",
        code: "use_stripe",
      },
      { status: 400 }
    );
  }

  if (voucherCode && voucherCode.trim()) {
    const consumed = await consumeVoucherForPlan({ code: voucherCode, planSlug: plan.slug });
    if (!consumed.ok) {
      return Response.json({ success: false, error: consumed.error, code: consumed.code }, { status: 400 });
    }
  }

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
