import { encodeURL } from "@solana/pay";
import { getServerSession } from "next-auth";
import BigNumber from "bignumber.js";
import { Keypair, PublicKey } from "@solana/web3.js";
import { authOptions } from "@/lib/auth";
import { getDashboardAdminSettings } from "@/lib/dashboardAdminSettingsDb";
import { isDiscordGuildMember } from "@/lib/discordGuildMember";
import { resolveHelpTierAsync } from "@/lib/helpRole";
import { getSiteOperationalState } from "@/lib/siteOperationalState";
import {
  createInvoiceRow,
  getPlanById,
  getPlanBySlug,
  hasPendingSolInvoiceForDiscord,
} from "@/lib/subscription/subscriptionDb";
import { fetchSolUsdPrice, usdToLamportsCeil } from "@/lib/subscription/solUsdQuote";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const QUOTE_TTL_MS = 20 * 60 * 1000;

function membershipTreasury(): string | null {
  return (process.env.SOLANA_MEMBERSHIP_TREASURY_PUBKEY ?? "").trim() || null;
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  const discordId = session?.user?.id?.trim() ?? "";
  if (!discordId) {
    return Response.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  if (!getSupabaseAdmin()) {
    return Response.json({ success: false, error: "Database not configured" }, { status: 503 });
  }

  const treasuryStr = membershipTreasury();
  if (!treasuryStr) {
    return Response.json(
      {
        success: false,
        error: "SOL membership treasury is not configured (SOLANA_MEMBERSHIP_TREASURY_PUBKEY).",
        code: "missing_treasury",
      },
      { status: 503 }
    );
  }

  let treasury: PublicKey;
  try {
    treasury = new PublicKey(treasuryStr);
  } catch {
    return Response.json(
      { success: false, error: "Invalid SOLANA_MEMBERSHIP_TREASURY_PUBKEY.", code: "bad_treasury" },
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
      { success: false, error: "Join the McGBot Discord server before purchasing membership." },
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
    testSol?: boolean;
  } | null;

  const testSol = body?.testSol === true;
  const slug = typeof body?.planSlug === "string" ? body.planSlug.trim() : "";

  if (await hasPendingSolInvoiceForDiscord(discordId)) {
    return Response.json(
      {
        success: false,
        error: "You already have a pending SOL checkout. Finish or wait for it to expire before starting another.",
        code: "pending_invoice",
      },
      { status: 409 }
    );
  }

  let plan: Awaited<ReturnType<typeof getPlanBySlug>>;
  let effectiveUsd: number;

  if (testSol) {
    const adminRow = await getDashboardAdminSettings();
    if (!adminRow?.stripe_test_checkout_enabled) {
      return Response.json(
        { success: false, error: "SOL test checkout is not enabled.", code: "test_checkout_disabled" },
        { status: 403 }
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
          error: "Could not resolve a plan for SOL test checkout.",
          code: "test_plan_missing",
        },
        { status: 503 }
      );
    }
    effectiveUsd = 1;
  } else {
    if (!slug) {
      return Response.json({ success: false, error: "Missing planSlug" }, { status: 400 });
    }
    plan = await getPlanBySlug(slug);
    if (!plan) {
      return Response.json({ success: false, error: "Unknown plan" }, { status: 400 });
    }
    const planPercent = Math.max(
      0,
      Math.min(100, Math.round(Number((plan as { discount_percent?: number }).discount_percent ?? 0) || 0))
    );
    const listUsd = Math.max(0, Number(plan.price_usd));
    effectiveUsd = Math.max(0, listUsd * (1 - planPercent / 100));
    if (!(effectiveUsd > 0)) {
      return Response.json({ success: false, error: "Plan price is not available for SOL checkout." }, { status: 400 });
    }
  }

  let solUsd: number;
  try {
    solUsd = await fetchSolUsdPrice();
  } catch (e) {
    console.error("[sol/start] SOL/USD quote", e);
    return Response.json(
      { success: false, error: "Could not load SOL price. Try again in a moment.", code: "quote_failed" },
      { status: 503 }
    );
  }

  let lamports: bigint;
  try {
    lamports = usdToLamportsCeil(effectiveUsd, solUsd);
  } catch (e) {
    console.error("[sol/start] lamports", e);
    return Response.json({ success: false, error: "Could not compute SOL amount." }, { status: 500 });
  }

  const reference = Keypair.generate();
  const refStr = reference.publicKey.toBase58();
  const quoteExpiresAt = new Date(Date.now() + QUOTE_TTL_MS);

  const invoiceId = await createInvoiceRow({
    discordId,
    planId: plan.id,
    referencePubkey: refStr,
    treasuryPubkey: treasuryStr,
    lamports,
    solUsd,
    quoteExpiresAt,
  });
  if (!invoiceId) {
    return Response.json({ success: false, error: "Could not create checkout." }, { status: 500 });
  }

  const amountBn = new BigNumber(lamports.toString()).dividedBy(1e9);
  const amountSolStr = amountBn.toFixed(9).replace(/\.?0+$/, "") || "0";

  const solanaPayUrl = encodeURL({
    recipient: treasury,
    amount: amountBn,
    reference: reference.publicKey,
    label: "McGBot",
    message: "Membership",
  }).toString();

  return Response.json({
    success: true,
    invoiceId,
    reference: refStr,
    treasury: treasuryStr,
    amountSol: amountSolStr,
    lamports: lamports.toString(),
    solUsd,
    usdQuoted: effectiveUsd,
    plan: {
      id: plan.id,
      slug: plan.slug,
      label: testSol ? `${plan.label} (SOL test)` : plan.label,
      durationDays: plan.duration_days,
    },
    solanaPayUrl,
    quoteExpiresAt: quoteExpiresAt.toISOString(),
  });
}
