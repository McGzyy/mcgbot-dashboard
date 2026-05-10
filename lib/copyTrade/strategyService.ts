import type { SupabaseClient } from "@supabase/supabase-js";
import { copyTradeFeeOnSellBpsFromEnv } from "@/lib/copyTrade/platformFee";
import { defaultSellRules } from "@/lib/copyTrade/matchStrategy";
import { parseSellRules, sellRulesToJson, solToLamportsBigInt, type CopySellRule } from "@/lib/copyTrade/sellRules";

export type CopyTradeStrategyRow = {
  id: string;
  discord_user_id: string;
  enabled: boolean;
  mirror_bot_calls_only: boolean;
  max_buy_lamports: string;
  max_slippage_bps: number;
  min_call_mcap_usd: number | null;
  min_bot_win_rate_2x_pct: number | null;
  sell_rules: unknown;
  fee_on_sell_bps: number;
  created_at: string;
  updated_at: string;
};

function defaultFeeBps(): number {
  return copyTradeFeeOnSellBpsFromEnv();
}

const DEFAULTS = {
  enabled: false,
  mirror_bot_calls_only: true,
  max_buy_lamports: "0",
  max_slippage_bps: 800,
  min_call_mcap_usd: null as number | null,
  min_bot_win_rate_2x_pct: null as number | null,
};

export async function getOrCreateStrategy(db: SupabaseClient, discordUserId: string): Promise<CopyTradeStrategyRow | null> {
  const uid = discordUserId.trim();
  if (!uid) return null;

  const { data: existing, error: e1 } = await db
    .from("copy_trade_strategies")
    .select("*")
    .eq("discord_user_id", uid)
    .maybeSingle();

  if (e1) {
    console.error("[copyTrade] get strategy", e1);
    return null;
  }
  if (existing) return existing as CopyTradeStrategyRow;

  const now = new Date().toISOString();
  const { data: created, error: e2 } = await db
    .from("copy_trade_strategies")
    .insert({
      discord_user_id: uid,
      enabled: DEFAULTS.enabled,
      mirror_bot_calls_only: DEFAULTS.mirror_bot_calls_only,
      max_buy_lamports: DEFAULTS.max_buy_lamports,
      max_slippage_bps: DEFAULTS.max_slippage_bps,
      min_call_mcap_usd: DEFAULTS.min_call_mcap_usd,
      min_bot_win_rate_2x_pct: DEFAULTS.min_bot_win_rate_2x_pct,
      fee_on_sell_bps: defaultFeeBps(),
      sell_rules: sellRulesToJson(defaultSellRules()),
      created_at: now,
      updated_at: now,
    })
    .select("*")
    .maybeSingle();

  if (e2) {
    console.error("[copyTrade] create strategy", e2);
    return null;
  }
  return created as CopyTradeStrategyRow;
}

export type StrategyPatch = {
  enabled?: boolean;
  mirror_bot_calls_only?: boolean;
  max_buy_sol?: number;
  max_slippage_bps?: number;
  min_call_mcap_usd?: number | null;
  min_bot_win_rate_2x_pct?: number | null;
  sell_rules?: CopySellRule[];
};

export async function updateStrategy(
  db: SupabaseClient,
  discordUserId: string,
  patch: StrategyPatch
): Promise<{ ok: true; row: CopyTradeStrategyRow } | { ok: false; error: string }> {
  const uid = discordUserId.trim();
  if (!uid) return { ok: false, error: "Missing user." };

  const row = await getOrCreateStrategy(db, uid);
  if (!row) return { ok: false, error: "Could not load strategy." };

  const next: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
    fee_on_sell_bps: defaultFeeBps(),
  };

  if (typeof patch.enabled === "boolean") next.enabled = patch.enabled;
  if (typeof patch.mirror_bot_calls_only === "boolean") next.mirror_bot_calls_only = patch.mirror_bot_calls_only;
  if (typeof patch.max_buy_sol === "number" && Number.isFinite(patch.max_buy_sol) && patch.max_buy_sol >= 0) {
    next.max_buy_lamports = solToLamportsBigInt(patch.max_buy_sol).toString();
  }
  if (typeof patch.max_slippage_bps === "number" && Number.isFinite(patch.max_slippage_bps)) {
    next.max_slippage_bps = Math.max(0, Math.min(5000, Math.floor(patch.max_slippage_bps)));
  }
  if ("min_call_mcap_usd" in patch) {
    const v = patch.min_call_mcap_usd;
    next.min_call_mcap_usd =
      v == null || !Number.isFinite(Number(v)) || Number(v) <= 0 ? null : Math.max(0, Number(v));
  }
  if ("min_bot_win_rate_2x_pct" in patch) {
    const v = patch.min_bot_win_rate_2x_pct;
    next.min_bot_win_rate_2x_pct =
      v == null || !Number.isFinite(Number(v)) || Number(v) <= 0 ? null : Math.min(100, Math.max(0, Number(v)));
  }
  if (patch.sell_rules) {
    const parsed = parseSellRules(patch.sell_rules);
    if (!parsed.ok) return { ok: false, error: parsed.error };
    next.sell_rules = sellRulesToJson(parsed.rules);
  }

  const { data, error } = await db.from("copy_trade_strategies").update(next).eq("id", row.id).select("*").maybeSingle();

  if (error || !data) {
    return { ok: false, error: error?.message ?? "Update failed." };
  }
  return { ok: true, row: data as CopyTradeStrategyRow };
}
