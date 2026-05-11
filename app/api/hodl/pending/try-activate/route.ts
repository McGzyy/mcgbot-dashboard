import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { fetchDexMetricsForMint, sizeTierFromUsd } from "@/lib/hodl/dexTokenMetrics";
import { HODL_MIN_HOLD_MS } from "@/lib/hodl/hodlConstants";
import { holdSinceFromOldestBlockTime, scanSplHoldForMint } from "@/lib/hodl/solanaTokenHold";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { solanaRpcUrlServer } from "@/lib/solanaEnv";
import { Connection, PublicKey } from "@solana/web3.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Re-scan pending HODL rows for the signed-in user: promote to live when the 2-week hold + balance checks pass,
 * or revoke if balance is gone.
 */
export async function POST() {
  const session = await getServerSession(authOptions);
  const discordId = session?.user?.id?.trim() ?? "";
  if (!discordId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session?.user?.hasDashboardAccess !== true) {
    return Response.json({ error: "Subscription required" }, { status: 402 });
  }

  const db = getSupabaseAdmin();
  if (!db) {
    return Response.json({ error: "Database not configured" }, { status: 503 });
  }

  const { data: rows, error } = await db
    .from("hodl_calls")
    .select("id,mint,wallet_pubkey,status,hold_since")
    .eq("discord_id", discordId)
    .eq("status", "pending_hold");

  if (error) {
    console.error("[hodl/try-activate]", error);
    return Response.json({ error: "Could not load pending rows" }, { status: 500 });
  }

  const rpc = solanaRpcUrlServer();
  const conn = new Connection(rpc, "confirmed");
  let promoted = 0;
  let revoked = 0;

  for (const r of rows ?? []) {
    const id = String((r as { id?: string }).id ?? "");
    const mint = String((r as { mint?: string }).mint ?? "");
    const walletPubkey = String((r as { wallet_pubkey?: string }).wallet_pubkey ?? "");
    if (!id || !mint || !walletPubkey) continue;

    let owner: PublicKey;
    let mintPk: PublicKey;
    try {
      owner = new PublicKey(walletPubkey);
      mintPk = new PublicKey(mint);
    } catch {
      continue;
    }

    const scan = await scanSplHoldForMint(conn, owner, mintPk);
    const nowIso = new Date().toISOString();
    if (!scan) {
      await db
        .from("hodl_calls")
        .update({ status: "revoked_no_balance", last_checked_at: nowIso })
        .eq("id", id);
      revoked += 1;
      continue;
    }

    const holdSince = holdSinceFromOldestBlockTime(scan.oldestBlockTimeSec);
    if (!holdSince) {
      await db.from("hodl_calls").update({ last_checked_at: nowIso }).eq("id", id);
      continue;
    }

    const holdMs = Date.now() - holdSince.getTime();
    const meetsMin = holdMs >= HODL_MIN_HOLD_MS;
    const dex = await fetchDexMetricsForMint(mint, "24h");
    const ui =
      Number(scan.balanceRaw) / Math.pow(10, Math.max(0, Math.min(scan.decimals, 18)));
    const usd =
      dex?.priceUsd != null && Number.isFinite(dex.priceUsd) && Number.isFinite(ui) ? ui * dex.priceUsd : null;
    const size_tier = sizeTierFromUsd(usd);

    if (meetsMin) {
      await db
        .from("hodl_calls")
        .update({
          status: "live",
          live_at: nowIso,
          eligible_at: null,
          hold_since: holdSince.toISOString(),
          balance_raw: scan.balanceRaw.toString(),
          token_decimals: scan.decimals,
          token_symbol: scan.symbol,
          size_tier,
          price_change_pct: dex?.priceChangePct ?? null,
          last_metrics_at: nowIso,
          last_checked_at: nowIso,
        })
        .eq("id", id);
      promoted += 1;
    } else {
      await db
        .from("hodl_calls")
        .update({
          hold_since: holdSince.toISOString(),
          eligible_at: new Date(holdSince.getTime() + HODL_MIN_HOLD_MS).toISOString(),
          balance_raw: scan.balanceRaw.toString(),
          token_decimals: scan.decimals,
          token_symbol: scan.symbol,
          size_tier,
          price_change_pct: dex?.priceChangePct ?? null,
          last_metrics_at: nowIso,
          last_checked_at: nowIso,
        })
        .eq("id", id);
    }
  }

  return Response.json({ success: true, promoted, revoked });
}
