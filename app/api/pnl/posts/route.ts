import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requirePremiumAndDiscord } from "@/app/api/pnl/_lib/pnlGate";
import { fetchPricePerTokenSol } from "@/app/api/pnl/_lib/dexscreenerPrice";
import { computeVerifiedPnlAverageCost } from "@/app/api/pnl/_lib/pnlCompute";
import { PublicKey } from "@solana/web3.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
  const ca = typeof o.ca === "string" ? o.ca.trim() : "";
  const walletPubkey = typeof o.walletPubkey === "string" ? o.walletPubkey.trim() : "";
  if (!ca || !walletPubkey) {
    return Response.json({ success: false, error: "Missing contract address or wallet" }, { status: 400 });
  }
  try {
    new PublicKey(ca);
    new PublicKey(walletPubkey);
  } catch {
    return Response.json({ success: false, error: "Invalid contract address or wallet" }, { status: 400 });
  }

  const { data: walletRow } = await db
    .from("pnl_wallets")
    .select("wallet_pubkey")
    .eq("discord_id", gate.discordId)
    .eq("wallet_pubkey", walletPubkey)
    .maybeSingle();
  if (!walletRow) {
    return Response.json({ success: false, error: "Wallet not linked" }, { status: 403 });
  }

  const eligibleRes = await db.from("call_performance").select("id").eq("call_ca", ca).limit(1);
  const eligible = !eligibleRes.error && Array.isArray(eligibleRes.data) && eligibleRes.data.length > 0;
  if (!eligible) {
    return Response.json(
      { success: false, error: "This token hasn’t been called on McGBot Terminal yet." },
      { status: 400 }
    );
  }

  const pricePerTokenSol = await fetchPricePerTokenSol(ca);
  const result = await computeVerifiedPnlAverageCost({ walletPubkey, tokenCa: ca, pricePerTokenSol });
  const hasBuy = result.trades.some((t) => t.kind === "buy");
  if (!hasBuy) {
    return Response.json(
      { success: false, error: "Couldn’t verify trades for this wallet/token yet." },
      { status: 422 }
    );
  }

  const username =
    typeof gate.session?.user?.name === "string" && gate.session.user.name.trim()
      ? gate.session.user.name.trim()
      : gate.discordId;

  const { data: inserted, error } = await db
    .from("pnl_posts")
    .insert({
      discord_id: gate.discordId,
      username,
      wallet_pubkey: walletPubkey,
      token_ca: ca,
      verified: true,
      cost_basis_sol: result.costBasisSol,
      proceeds_sol: result.proceedsSol,
      realized_pnl_sol: result.realizedPnlSol,
      realized_pnl_pct: result.realizedPnlPct,
      unrealized_pnl_sol: result.unrealizedPnlSol,
      unrealized_pnl_pct: result.unrealizedPnlPct,
      qty_remaining: result.qtyRemainingBaseUnits,
      price_per_token_sol: result.pricePerTokenSol,
      computed_at: new Date().toISOString(),
    })
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("[pnl/posts] insert:", error);
    return Response.json({ success: false, error: "Failed to post PnL" }, { status: 500 });
  }

  const postId = String((inserted as any)?.id ?? "");
  if (postId && result.signatures.length) {
    const rows = result.signatures.slice(0, 12).map((sig) => ({ post_id: postId, signature: sig }));
    const txIns = await db.from("pnl_post_transactions").insert(rows);
    if (txIns.error) {
      console.warn("[pnl/posts] tx insert:", txIns.error);
    }
  }

  return Response.json({ success: true, postId, result });
}

