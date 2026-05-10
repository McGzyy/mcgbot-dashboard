import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getOrCreateStrategy, updateStrategy, type StrategyPatch } from "@/lib/copyTrade/strategyService";
import { lamportsBigIntToSolString } from "@/lib/copyTrade/sellRules";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  const uid = session?.user?.id?.trim() ?? "";
  if (!uid) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const db = getSupabaseAdmin();
  if (!db) return Response.json({ error: "Database not configured" }, { status: 503 });

  const strategy = await getOrCreateStrategy(db, uid);
  if (!strategy) return Response.json({ error: "Could not load strategy" }, { status: 500 });

  const { data: intentsRaw, error: iErr } = await db
    .from("copy_trade_intents")
    .select("id,status,detail,created_at,signal_id")
    .eq("discord_user_id", uid)
    .order("created_at", { ascending: false })
    .limit(40);

  if (iErr) {
    console.error("[copy-trade-strategy GET]", iErr);
  }

  const intentsList = Array.isArray(intentsRaw) ? intentsRaw : [];
  const signalIds = [...new Set(intentsList.map((r: { signal_id?: string }) => String(r.signal_id || "")).filter(Boolean))];
  let caBySignal = new Map<string, string>();
  if (signalIds.length) {
    const { data: sigs } = await db.from("copy_trade_signals").select("id,call_ca").in("id", signalIds);
    if (Array.isArray(sigs)) {
      caBySignal = new Map(sigs.map((s: { id: string; call_ca: string }) => [s.id, s.call_ca]));
    }
  }

  const intents = intentsList.map((row: { id: string; status: string; detail: unknown; created_at: string; signal_id: string }) => ({
    id: row.id,
    status: row.status,
    detail: row.detail,
    created_at: row.created_at,
    signal_id: row.signal_id,
    call_ca: caBySignal.get(row.signal_id) ?? null,
  }));

  const maxBuySol = lamportsBigIntToSolString(BigInt(String(strategy.max_buy_lamports ?? 0)));

  return Response.json({
    ok: true,
    strategy: {
      ...strategy,
      max_buy_sol: maxBuySol,
    },
    intents,
  });
}

export async function PUT(request: Request) {
  const session = await getServerSession(authOptions);
  const uid = session?.user?.id?.trim() ?? "";
  if (!uid) return Response.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const o = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const patch: StrategyPatch = {};

  if ("enabled" in o) patch.enabled = o.enabled === true;
  if ("mirror_bot_calls_only" in o) patch.mirror_bot_calls_only = o.mirror_bot_calls_only === true;
  if (typeof o.max_buy_sol === "number") patch.max_buy_sol = o.max_buy_sol;
  if (typeof o.max_slippage_bps === "number") patch.max_slippage_bps = o.max_slippage_bps;
  if ("min_call_mcap_usd" in o) {
    patch.min_call_mcap_usd =
      o.min_call_mcap_usd === null || o.min_call_mcap_usd === ""
        ? null
        : Number(o.min_call_mcap_usd);
  }
  if ("min_bot_win_rate_2x_pct" in o) {
    patch.min_bot_win_rate_2x_pct =
      o.min_bot_win_rate_2x_pct === null || o.min_bot_win_rate_2x_pct === ""
        ? null
        : Number(o.min_bot_win_rate_2x_pct);
  }
  if (Array.isArray(o.sell_rules)) patch.sell_rules = o.sell_rules as StrategyPatch["sell_rules"];
  if (typeof o.fee_on_sell_bps === "number") patch.fee_on_sell_bps = o.fee_on_sell_bps;

  const db = getSupabaseAdmin();
  if (!db) return Response.json({ error: "Database not configured" }, { status: 503 });

  const res = await updateStrategy(db, uid, patch);
  if (!res.ok) return Response.json({ error: res.error }, { status: 400 });

  const maxBuySol = lamportsBigIntToSolString(BigInt(String(res.row.max_buy_lamports ?? 0)));
  return Response.json({
    ok: true,
    strategy: { ...res.row, max_buy_sol: maxBuySol },
  });
}
