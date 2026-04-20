import { PublicKey } from "@solana/web3.js";
import { requirePremiumAndDiscord } from "@/app/api/pnl/_lib/pnlGate";
import { computeVerifiedPnlAverageCost } from "@/app/api/pnl/_lib/pnlCompute";
import { fetchPricePerTokenSol } from "@/app/api/pnl/_lib/dexscreenerPrice";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function normalizeCa(raw: string): string {
  return raw.trim();
}

export async function POST(req: Request) {
  const gate = await requirePremiumAndDiscord();
  if (!gate.ok) return gate.response;

  const db = getSupabaseAdmin();
  if (!db) {
    return Response.json({ success: false, error: "Database not configured" }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ success: false, error: "Invalid JSON" }, { status: 400 });
  }
  const o = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const ca = normalizeCa(typeof o.ca === "string" ? o.ca : "");
  const walletPubkey = typeof o.walletPubkey === "string" ? o.walletPubkey.trim() : "";
  if (!ca || !walletPubkey) {
    return Response.json({ success: false, error: "Missing contract address or wallet" }, { status: 400 });
  }
  try {
    // validate formats
    new PublicKey(ca);
    new PublicKey(walletPubkey);
  } catch {
    return Response.json({ success: false, error: "Invalid contract address or wallet" }, { status: 400 });
  }

  // Ensure wallet is linked to this user.
  const { data: walletRow } = await db
    .from("pnl_wallets")
    .select("wallet_pubkey")
    .eq("discord_id", gate.discordId)
    .eq("wallet_pubkey", walletPubkey)
    .maybeSingle();
  if (!walletRow) {
    return Response.json({ success: false, error: "Wallet not linked" }, { status: 403 });
  }

  // Eligibility: must have been called.
  const eligibleRes = await db.from("call_performance").select("id").eq("call_ca", ca).limit(1);
  if (eligibleRes.error) {
    console.error("[pnl/compute] eligibility:", eligibleRes.error);
    return Response.json({ success: false, error: "Could not verify token eligibility" }, { status: 500 });
  }
  const eligible = Array.isArray(eligibleRes.data) && eligibleRes.data.length > 0;
  if (!eligible) {
    return Response.json(
      { success: false, error: "This token hasn’t been called on McGBot Terminal yet." },
      { status: 400 }
    );
  }

  const pricePerTokenSol = await fetchPricePerTokenSol(ca);
  const result = await computeVerifiedPnlAverageCost({ walletPubkey, tokenCa: ca, pricePerTokenSol });

  // Guard rails: require at least one detected buy.
  const hasBuy = result.trades.some((t) => t.kind === "buy");
  if (!hasBuy) {
    return Response.json(
      { success: false, error: "Couldn’t verify trades for this wallet/token yet." },
      { status: 422 }
    );
  }

  return Response.json({ success: true, result });
}

