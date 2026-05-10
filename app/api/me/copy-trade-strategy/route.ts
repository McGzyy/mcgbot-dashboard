import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { copyTradeFeeOnSellBpsFromEnv } from "@/lib/copyTrade/platformFee";
import { getOrCreateStrategy, updateStrategy, type StrategyPatch } from "@/lib/copyTrade/strategyService";
import { lamportsBigIntToSolString, type CopySellRule } from "@/lib/copyTrade/sellRules";
import { getCopyTradeUserWallet } from "@/lib/copyTrade/userWalletService";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { Connection, PublicKey } from "@solana/web3.js";
import { solanaRpcUrlServer } from "@/lib/solanaEnv";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function discordUserId(session: { user?: { id?: string | null } } | null): string {
  return session?.user?.id?.trim() ?? "";
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const uid = discordUserId(session);
    if (!uid) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const db = getSupabaseAdmin();
    if (!db) return Response.json({ error: "Database not configured" }, { status: 503 });

    const strategy = await getOrCreateStrategy(db, uid);
    if (!strategy) return Response.json({ error: "Could not load strategy" }, { status: 500 });

    const maxLamports = BigInt(String(strategy.max_buy_lamports ?? "0"));
    const max_buy_sol = lamportsBigIntToSolString(maxLamports);

    const [intentsRes, posRes, walletRow, openPosRes] = await Promise.all([
      db
        .from("copy_trade_intents")
        .select(
          "id,strategy_id,signal_id,status,created_at,updated_at,started_at,completed_at,buy_signature,buy_input_lamports,error_message,executor_wallet,detail"
        )
        .eq("discord_user_id", uid)
        .order("created_at", { ascending: false })
        .limit(40),
      db
        .from("copy_trade_positions")
        .select("id,intent_id,status,mint,next_rule_index,created_at,updated_at,detail")
        .eq("discord_user_id", uid)
        .order("created_at", { ascending: false })
        .limit(40),
      getCopyTradeUserWallet(db, uid),
      db.from("copy_trade_positions").select("id", { count: "exact", head: true }).eq("discord_user_id", uid).eq("status", "open"),
    ]);

    if (intentsRes.error) console.error("[copy-trade-strategy] intents", intentsRes.error);
    if (posRes.error) console.error("[copy-trade-strategy] positions", posRes.error);

    const intentRows = Array.isArray(intentsRes.data) ? intentsRes.data : [];
    const signalIds = [...new Set(intentRows.map((r: { signal_id?: string }) => String(r.signal_id ?? "").trim()).filter(Boolean))];
    const caMap = new Map<string, string>();
    if (signalIds.length) {
      const { data: sigs } = await db.from("copy_trade_signals").select("id,call_ca").in("id", signalIds);
      for (const s of sigs ?? []) {
        const o = s as { id: string; call_ca: string };
        if (o?.id) caMap.set(String(o.id), String(o.call_ca ?? ""));
      }
    }

    const intents = intentRows.map((row: Record<string, unknown>) => ({
      ...row,
      call_ca: caMap.get(String(row.signal_id ?? "")) ?? null,
    }));

    let wallet: { publicKey: string; balanceLamports: string } | null = null;
    if (walletRow?.public_key) {
      let bal = "0";
      try {
        const rpc = solanaRpcUrlServer();
        const conn = new Connection(rpc, "confirmed");
        const pk = new PublicKey(walletRow.public_key);
        const lamports = await conn.getBalance(pk, "confirmed");
        bal = String(lamports);
      } catch {
        // ignore RPC errors for display
      }
      wallet = { publicKey: walletRow.public_key, balanceLamports: bal };
    }

    const openCount = typeof openPosRes.count === "number" ? openPosRes.count : 0;

    return Response.json({
      ok: true,
      strategy: { ...strategy, max_buy_sol },
      intents,
      positions: posRes.data ?? [],
      wallet,
      platformFeeOnSellBps: copyTradeFeeOnSellBpsFromEnv(),
      openPositionsCount: openCount,
    });
  } catch (e) {
    console.error("[copy-trade-strategy GET]", e);
    return Response.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    const uid = discordUserId(session);
    if (!uid) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return Response.json({ error: "Invalid JSON" }, { status: 400 });

    const db = getSupabaseAdmin();
    if (!db) return Response.json({ error: "Database not configured" }, { status: 503 });

    const patch: StrategyPatch = {};
    if (typeof body.enabled === "boolean") patch.enabled = body.enabled;
    if (typeof body.mirror_bot_calls_only === "boolean") patch.mirror_bot_calls_only = body.mirror_bot_calls_only;
    if (typeof body.max_buy_sol === "number") patch.max_buy_sol = body.max_buy_sol;
    if (typeof body.max_slippage_bps === "number") patch.max_slippage_bps = body.max_slippage_bps;
    if ("min_call_mcap_usd" in body) {
      const v = body.min_call_mcap_usd;
      patch.min_call_mcap_usd =
        v == null || v === ""
          ? null
          : typeof v === "number" && Number.isFinite(v)
            ? v
            : Number(v);
    }
    if ("min_bot_win_rate_2x_pct" in body) {
      const v = body.min_bot_win_rate_2x_pct;
      patch.min_bot_win_rate_2x_pct =
        v == null || v === ""
          ? null
          : typeof v === "number" && Number.isFinite(v)
            ? v
            : Number(v);
    }
    if (Array.isArray(body.sell_rules)) {
      patch.sell_rules = body.sell_rules as CopySellRule[];
    }

    const r = await updateStrategy(db, uid, patch);
    if (!r.ok) return Response.json({ error: r.error }, { status: 400 });

    const maxLamports = BigInt(String(r.row.max_buy_lamports ?? "0"));
    return Response.json({
      ok: true,
      strategy: { ...r.row, max_buy_sol: lamportsBigIntToSolString(maxLamports) },
    });
  } catch (e) {
    console.error("[copy-trade-strategy PUT]", e);
    return Response.json({ error: "Internal error" }, { status: 500 });
  }
}
