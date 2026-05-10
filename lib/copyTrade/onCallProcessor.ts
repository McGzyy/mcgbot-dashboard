import { strategyMatchesCall, type CallSnapshot } from "@/lib/copyTrade/matchStrategy";
import type { SupabaseClient } from "@supabase/supabase-js";

export type CopyTradeOnCallInput = {
  callPerformanceId: string;
  call_ca: string;
  source: string;
  snapshot: Record<string, unknown> | null;
};

export type CopyTradeOnCallResult = {
  signalId: string;
  intentsCreated: number;
  intentsSkipped: number;
};

export async function processCopyTradeOnCall(
  db: SupabaseClient,
  input: CopyTradeOnCallInput
): Promise<{ ok: true; result: CopyTradeOnCallResult } | { ok: false; error: string; status: number }> {
  const callId = input.callPerformanceId.trim();
  const ca = input.call_ca.trim();
  if (!callId || !ca) return { ok: false, error: "callPerformanceId and call_ca are required.", status: 400 };

  const { data: callRow, error: cErr } = await db
    .from("call_performance")
    .select("id,call_ca,source,call_market_cap_usd")
    .eq("id", callId)
    .maybeSingle();

  if (cErr || !callRow) {
    return { ok: false, error: "call_performance row not found.", status: 404 };
  }
  if (String((callRow as { call_ca?: string }).call_ca).trim() !== ca) {
    return { ok: false, error: "call_ca does not match call_performance row.", status: 400 };
  }

  const source = String((callRow as { source?: string }).source || "").trim();
  const callSnapshot: CallSnapshot = {
    source,
    call_market_cap_usd:
      (callRow as { call_market_cap_usd?: number | null }).call_market_cap_usd != null
        ? Number((callRow as { call_market_cap_usd: number | null }).call_market_cap_usd)
        : null,
  };

  const mergedSnapshot = {
    ...(input.snapshot && typeof input.snapshot === "object" ? input.snapshot : {}),
    call_market_cap_usd: callSnapshot.call_market_cap_usd,
    source: callSnapshot.source,
    call_ca: ca,
  };

  const now = new Date().toISOString();
  let signalId: string;

  const insertSig = await db
    .from("copy_trade_signals")
    .insert({
      call_performance_id: callId,
      call_ca: ca,
      source: input.source.trim() || source,
      snapshot: mergedSnapshot,
      created_at: now,
    })
    .select("id")
    .maybeSingle();

  if (insertSig.error && (insertSig.error as { code?: string }).code === "23505") {
    const { data: existing, error: exErr } = await db
      .from("copy_trade_signals")
      .select("id")
      .eq("call_performance_id", callId)
      .maybeSingle();
    if (exErr || !existing) {
      return { ok: false, error: "Signal exists but could not be read.", status: 500 };
    }
    signalId = String((existing as { id: string }).id);
  } else if (insertSig.error || !insertSig.data) {
    console.error("[copyTrade] signal insert", insertSig.error);
    return { ok: false, error: insertSig.error?.message ?? "Could not create signal.", status: 500 };
  } else {
    signalId = String((insertSig.data as { id: string }).id);
  }

  const { data: strategies, error: stErr } = await db
    .from("copy_trade_strategies")
    .select("id,discord_user_id,enabled,mirror_bot_calls_only,max_buy_lamports,min_call_mcap_usd,min_bot_win_rate_2x_pct")
    .eq("enabled", true);

  if (stErr) {
    return { ok: false, error: stErr.message, status: 500 };
  }

  const rows = Array.isArray(strategies) ? strategies : [];
  let intentsCreated = 0;
  let intentsSkipped = 0;

  const intentPayloads: {
    strategy_id: string;
    signal_id: string;
    discord_user_id: string;
    status: string;
    detail: Record<string, unknown> | null;
    created_at: string;
  }[] = [];

  for (const raw of rows) {
    const s = raw as {
      id: string;
      discord_user_id: string;
      enabled: boolean;
      mirror_bot_calls_only: boolean;
      max_buy_lamports: string | number;
      min_call_mcap_usd: number | null;
      min_bot_win_rate_2x_pct: number | null;
    };
    const m = strategyMatchesCall(
      {
        enabled: s.enabled === true,
        mirror_bot_calls_only: s.mirror_bot_calls_only === true,
        max_buy_lamports: s.max_buy_lamports,
        min_call_mcap_usd: s.min_call_mcap_usd,
        min_bot_win_rate_2x_pct: s.min_bot_win_rate_2x_pct,
      },
      callSnapshot
    );

    if (!m.ok) {
      intentsSkipped += 1;
      continue;
    }
    intentsCreated += 1;
    intentPayloads.push({
      strategy_id: s.id,
      signal_id: signalId,
      discord_user_id: s.discord_user_id,
      status: "queued",
      detail: { reason: "matched" },
      created_at: now,
    });
  }

  if (intentPayloads.length) {
    const { error: insErr } = await db.from("copy_trade_intents").upsert(intentPayloads, {
      onConflict: "strategy_id,signal_id",
      ignoreDuplicates: false,
    });
    if (insErr) {
      console.error("[copyTrade] intents upsert", insErr);
      return { ok: false, error: insErr.message, status: 500 };
    }
  }

  return { ok: true, result: { signalId, intentsCreated, intentsSkipped } };
}
