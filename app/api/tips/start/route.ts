import { Keypair, PublicKey } from "@solana/web3.js";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { isDiscordGuildMember } from "@/lib/discordGuildMember";
import { liveDashboardAccessForDiscordId } from "@/lib/dashboardGate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function clampAmountSol(v: unknown): number | null {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return null;
  if (n <= 0) return null;
  // Safety cap to prevent fat-finger tips.
  if (n > 10) return null;
  // Round to 9 decimals max (lamports precision).
  return Math.round(n * 1e9) / 1e9;
}

function solToLamports(sol: number): bigint {
  return BigInt(Math.round(sol * 1e9));
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const discordId = session?.user?.id?.trim() ?? "";
  if (!discordId) {
    return Response.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const hasAccess =
    session?.user?.hasDashboardAccess === true ||
    session?.user?.subscriptionExempt === true ||
    (await liveDashboardAccessForDiscordId(discordId).catch(() => false));
  if (!hasAccess) {
    return Response.json({ success: false, error: "Subscription required" }, { status: 402 });
  }

  const inGuild = await isDiscordGuildMember(discordId);
  if (inGuild !== true) {
    return Response.json(
      { success: false, error: "Discord membership required" },
      { status: 403 }
    );
  }

  const db = getSupabaseAdmin();
  if (!db) {
    return Response.json({ success: false, error: "Database not configured" }, { status: 503 });
  }

  const tipsTreasuryRaw = (process.env.SOLANA_TIPS_TREASURY_PUBKEY ?? "").trim();
  if (!tipsTreasuryRaw) {
    return Response.json(
      { success: false, error: "Tips wallet not configured" },
      { status: 503 }
    );
  }

  let treasury: PublicKey;
  try {
    treasury = new PublicKey(tipsTreasuryRaw);
  } catch {
    return Response.json({ success: false, error: "Invalid tips wallet" }, { status: 500 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ success: false, error: "Invalid JSON" }, { status: 400 });
  }

  const o = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const amountSol = clampAmountSol(o.amountSol);
  if (amountSol == null) {
    return Response.json({ success: false, error: "Invalid amount" }, { status: 400 });
  }

  const lamports = solToLamports(amountSol);
  if (lamports <= BigInt(0)) {
    return Response.json({ success: false, error: "Invalid amount" }, { status: 400 });
  }

  const ref = Keypair.generate();
  const referencePubkey = ref.publicKey.toBase58();
  const memo = "Tip for McGBot";

  const { error } = await db.from("bot_tips").insert({
    discord_id: discordId,
    amount_sol: amountSol,
    amount_lamports: lamports.toString(),
    reference_pubkey: referencePubkey,
    treasury_pubkey: treasury.toBase58(),
    memo,
    status: "pending",
  });

  if (error) {
    console.error("[tips/start] insert:", error);
    return Response.json({ success: false, error: "Could not start tip" }, { status: 500 });
  }

  const solanaPayUrl = `solana:${treasury.toBase58()}?amount=${encodeURIComponent(
    amountSol.toString()
  )}&reference=${encodeURIComponent(referencePubkey)}&label=${encodeURIComponent(
    "McGBot"
  )}&message=${encodeURIComponent(memo)}`;

  return Response.json({
    success: true,
    solanaPayUrl,
    reference: referencePubkey,
    treasury: treasury.toBase58(),
    amountSol: amountSol.toString(),
    memo,
  });
}

