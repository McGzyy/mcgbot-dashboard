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

function clip(s: string, max: number): string {
  const t = s.trim();
  if (t.length <= max) return t;
  return t.slice(0, max);
}

function isLikelyMint(s: string): boolean {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(s.trim());
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  const discordId = session?.user?.id?.trim() ?? "";
  if (!discordId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session?.user?.hasDashboardAccess !== true) {
    return Response.json({ error: "Subscription required" }, { status: 402 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const o = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const mintIn = typeof o.mint === "string" ? o.mint.trim() : "";
  const walletScope =
    o.walletScope === "hodl_only" || o.walletScope === "dashboard" ? o.walletScope : "";
  const narrativeIn = typeof o.narrative === "string" ? o.narrative : "";
  const thesisIn = typeof o.thesis === "string" ? o.thesis : "";
  const mcIn = o.mcPredictionUsd ?? o.mc_prediction_usd;

  if (!isLikelyMint(mintIn)) {
    return Response.json({ error: "Invalid Solana mint" }, { status: 400 });
  }
  if (walletScope !== "dashboard" && walletScope !== "hodl_only") {
    return Response.json({ error: "walletScope must be dashboard or hodl_only" }, { status: 400 });
  }

  const narrative = clip(narrativeIn, 2500);
  const thesis = clip(thesisIn, 4000);
  let mc_prediction_usd: number | null = null;
  if (typeof mcIn === "number" && Number.isFinite(mcIn)) mc_prediction_usd = mcIn;
  else if (typeof mcIn === "string" && mcIn.trim()) {
    const n = Number(mcIn.trim().replace(/,/g, ""));
    if (Number.isFinite(n) && n > 0) mc_prediction_usd = n;
  }

  const db = getSupabaseAdmin();
  if (!db) {
    return Response.json({ error: "Database not configured" }, { status: 503 });
  }

  const { data: existing } = await db
    .from("hodl_calls")
    .select("id,status")
    .eq("discord_id", discordId)
    .eq("mint", mintIn)
    .maybeSingle();
  if (existing) {
    const st = String((existing as { status?: string }).status ?? "");
    if (st !== "cancelled" && st !== "revoked_no_balance") {
      return Response.json(
        { error: "You already have a HODL row for this mint. Cancel it first to resubmit." },
        { status: 409 }
      );
    }
  }

  let walletPubkey = "";
  if (walletScope === "dashboard") {
    const { data: row } = await db
      .from("dashboard_linked_wallets")
      .select("wallet_pubkey")
      .eq("discord_id", discordId)
      .maybeSingle();
    const pk = row && typeof (row as { wallet_pubkey?: string }).wallet_pubkey === "string"
      ? (row as { wallet_pubkey: string }).wallet_pubkey.trim()
      : "";
    if (!pk) {
      return Response.json(
        { error: "No primary linked wallet. Link one in the wallet panel or use “HODL-only wallet”." },
        { status: 400 }
      );
    }
    walletPubkey = pk;
  } else {
    const { data: row } = await db
      .from("hodl_linked_wallets")
      .select("wallet_pubkey")
      .eq("discord_id", discordId)
      .maybeSingle();
    const pk = row && typeof (row as { wallet_pubkey?: string }).wallet_pubkey === "string"
      ? (row as { wallet_pubkey: string }).wallet_pubkey.trim()
      : "";
    if (!pk) {
      return Response.json(
        { error: "No HODL-only wallet linked yet. Complete the link flow first." },
        { status: 400 }
      );
    }
    walletPubkey = pk;
  }

  const rpc = solanaRpcUrlServer();
  const conn = new Connection(rpc, "confirmed");
  let owner: PublicKey;
  let mintPk: PublicKey;
  try {
    owner = new PublicKey(walletPubkey);
    mintPk = new PublicKey(mintIn);
  } catch {
    return Response.json({ error: "Invalid wallet or mint public key" }, { status: 400 });
  }

  const scan = await scanSplHoldForMint(conn, owner, mintPk);
  if (!scan) {
    return Response.json(
      { error: "No token balance found for this mint in the selected wallet (or below dust threshold)." },
      { status: 400 }
    );
  }

  const holdSince = holdSinceFromOldestBlockTime(scan.oldestBlockTimeSec);
  if (!holdSince) {
    return Response.json(
      {
        error:
          "Could not determine hold start from chain history (try again, or use an RPC with fuller history).",
      },
      { status: 422 }
    );
  }

  const now = Date.now();
  const holdMs = now - holdSince.getTime();
  const meetsMin = holdMs >= HODL_MIN_HOLD_MS;
  const eligibleAt = meetsMin ? null : new Date(holdSince.getTime() + HODL_MIN_HOLD_MS).toISOString();
  const status = meetsMin ? "live" : "pending_hold";
  const liveAt = meetsMin ? new Date().toISOString() : null;

  const dex = await fetchDexMetricsForMint(mintIn, "24h");
  const ui =
    Number(scan.balanceRaw) / Math.pow(10, Math.max(0, Math.min(scan.decimals, 18)));
  const usd =
    dex?.priceUsd != null && Number.isFinite(dex.priceUsd) && Number.isFinite(ui) ? ui * dex.priceUsd : null;
  const size_tier = sizeTierFromUsd(usd);

  const row = {
    discord_id: discordId,
    mint: mintIn,
    wallet_pubkey: walletPubkey,
    wallet_scope: walletScope,
    status,
    hold_since: holdSince.toISOString(),
    submitted_at: new Date().toISOString(),
    eligible_at: eligibleAt,
    live_at: liveAt,
    narrative: narrative || null,
    thesis: thesis || null,
    mc_prediction_usd,
    size_tier,
    balance_raw: scan.balanceRaw.toString(),
    token_decimals: scan.decimals,
    token_symbol: scan.symbol,
    price_change_pct: dex?.priceChangePct ?? null,
    last_metrics_at: new Date().toISOString(),
    last_checked_at: new Date().toISOString(),
    cancelled_at: null as string | null,
  };

  if (existing && ((existing as { status?: string }).status === "cancelled" || (existing as { status?: string }).status === "revoked_no_balance")) {
    const { error: updErr } = await db
      .from("hodl_calls")
      .update({ ...row, cancelled_at: null })
      .eq("id", (existing as { id: string }).id);
    if (updErr) {
      console.error("[hodl/submit update]", updErr);
      return Response.json({ error: "Could not save HODL call" }, { status: 500 });
    }
    return Response.json({
      success: true,
      status,
      eligibleAt,
      holdSince: holdSince.toISOString(),
      message:
        status === "live"
          ? "HODL is live — you meet the 2-week on-chain hold check."
          : "Saved. Your HODL will go live automatically once the 2-week hold is satisfied and you still hold the token.",
    });
  }

  const { error: insErr } = await db.from("hodl_calls").insert(row);
  if (insErr) {
    if ((insErr as { code?: string }).code === "23505") {
      return Response.json({ error: "Duplicate HODL for this mint." }, { status: 409 });
    }
    console.error("[hodl/submit insert]", insErr);
    return Response.json({ error: "Could not save HODL call" }, { status: 500 });
  }

  return Response.json({
    success: true,
    status,
    eligibleAt,
    holdSince: holdSince.toISOString(),
    message:
      status === "live"
        ? "HODL is live — you meet the 2-week on-chain hold check."
        : "Saved. Your HODL will go live automatically once the 2-week hold is satisfied and you still hold the token.",
  });
}
