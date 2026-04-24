import { Keypair, PublicKey } from "@solana/web3.js";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isDiscordGuildMember } from "@/lib/discordGuildMember";
import { fetchSolUsd } from "@/lib/subscription/jupiterSolUsd";
import { lamportsToSolString, usdToLamports } from "@/lib/subscription/solQuote";
import {
  createInvoiceRow,
  getPlanBySlug,
  upsertSubscriptionAfterPayment,
} from "@/lib/subscription/subscriptionDb";
import { consumeVoucherForPlan } from "@/lib/subscription/vouchers";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { resolveHelpTierAsync } from "@/lib/helpRole";
import { getSiteOperationalState } from "@/lib/siteOperationalState";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const QUOTE_MS = 15 * 60 * 1000;

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

  const treasuryRaw = (process.env.SOLANA_TREASURY_PUBKEY ?? "").trim();
  if (!treasuryRaw) {
    return Response.json(
      { success: false, error: "Missing SOLANA_TREASURY_PUBKEY on the server." },
      { status: 503 }
    );
  }
  let treasury: PublicKey;
  try {
    treasury = new PublicKey(treasuryRaw);
  } catch {
    return Response.json({ success: false, error: "Invalid SOLANA_TREASURY_PUBKEY" }, { status: 500 });
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
  const voucherCode = typeof (body as any)?.voucherCode === "string" ? String((body as any).voucherCode) : "";

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

  const percent = Math.max(0, Math.min(100, voucherPercentOff));
  const discountedUsd = Math.max(0, plan.price_usd * (1 - percent / 100));

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
      plan: { slug: plan.slug, label: plan.label, priceUsd: plan.price_usd, durationDays: finalDurationDays },
      voucher: { percentOff: percent },
      subscriptionUpdated: Boolean(granted),
    });
  }

  const solUsd = await fetchSolUsd();
  if (!solUsd) {
    return Response.json(
      { success: false, error: "Could not fetch SOL price (Jupiter). Try again shortly." },
      { status: 503 }
    );
  }

  const lamports = usdToLamports(discountedUsd, solUsd);
  if (lamports <= BigInt(0)) {
    return Response.json({ success: false, error: "Quoted amount invalid" }, { status: 500 });
  }

  const ref = Keypair.generate();
  const referencePubkey = ref.publicKey.toBase58();
  const expires = new Date(Date.now() + QUOTE_MS);

  const db = getSupabaseAdmin()!;
  await db
    .from("payment_invoices")
    .update({ status: "cancelled" })
    .eq("discord_id", discordId)
    .eq("status", "pending");

  const invoiceId = await createInvoiceRow({
    discordId,
    planId: plan.id,
    referencePubkey,
    treasuryPubkey: treasury.toBase58(),
    lamports,
    solUsd,
    quoteExpiresAt: expires,
  });
  if (!invoiceId) {
    return Response.json({ success: false, error: "Could not create invoice" }, { status: 500 });
  }

  const amountSol = lamportsToSolString(lamports);
  const label = encodeURIComponent("McGBot subscription");
  const message = encodeURIComponent(
    `${plan.label} · ${discountedUsd.toFixed(2)} USD quoted${percent > 0 ? ` (${percent}% off)` : ""}`
  );
  const solanaPayUrl = `solana:${treasury.toBase58()}?amount=${amountSol}&reference=${encodeURIComponent(
    referencePubkey
  )}&label=${label}&message=${message}`;

  return Response.json({
    success: true,
    invoiceId,
    plan: { slug: plan.slug, label: plan.label, priceUsd: discountedUsd, durationDays: finalDurationDays },
    quote: {
      solUsd,
      lamports: lamports.toString(),
      amountSol,
      expiresAt: expires.toISOString(),
    },
    treasury: treasury.toBase58(),
    reference: referencePubkey,
    solanaPayUrl,
    voucher: percent > 0 ? { percentOff: percent } : null,
  });
}
