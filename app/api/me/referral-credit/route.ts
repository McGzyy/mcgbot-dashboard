import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { listActivePlans } from "@/lib/subscription/subscriptionDb";
import { getReferralCreditBalanceCents } from "@/lib/referralRewards";
import { redeemReferralCreditForPlan, resolveReferralRedemptionSegmentKey } from "@/lib/referralRedeem";
import { REFERRAL_EXEMPT_SEGMENT_REDEEM_CAP_MONTHS } from "@/lib/referralPolicy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  const discordId = session?.user?.id?.trim() ?? "";
  if (!discordId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [balanceCents, plans, seg] = await Promise.all([
    getReferralCreditBalanceCents(discordId),
    listActivePlans(),
    resolveReferralRedemptionSegmentKey(discordId),
  ]);

  const planOptions = plans.map((p) => ({
    slug: p.slug,
    label: p.label,
    durationDays: p.duration_days,
    priceUsd: p.price_usd,
    discountPercent: p.discount_percent ?? 0,
  }));

  return NextResponse.json({
    ok: true,
    balanceCents,
    redemption: {
      segmentKey: seg.segmentKey,
      exemptCapApplies: seg.exemptCapApplies,
      exemptCapMonths: seg.exemptCapApplies ? REFERRAL_EXEMPT_SEGMENT_REDEEM_CAP_MONTHS : null,
    },
    plans: planOptions,
  });
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  const discordId = session?.user?.id?.trim() ?? "";
  if (!discordId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const planSlug = typeof body?.planSlug === "string" ? body.planSlug.trim().toLowerCase() : "";
  if (!planSlug) {
    return NextResponse.json({ error: "Missing planSlug" }, { status: 400 });
  }

  const result = await redeemReferralCreditForPlan({ discordId, planSlug });
  if (!result.ok) {
    return NextResponse.json({ error: result.error, code: result.code }, { status: 400 });
  }
  return NextResponse.json({
    ok: true,
    balanceCents: result.balanceCents,
    extendedDays: result.extendedDays,
    costCents: result.costCents,
  });
}
