import type { CopySellRule } from "@/lib/copyTrade/sellRules";

export type CallSnapshot = {
  source: string;
  call_market_cap_usd: number | null;
};

export type StrategyMatchInput = {
  enabled: boolean;
  mirror_bot_calls_only: boolean;
  max_buy_lamports: string | number | bigint;
  min_call_mcap_usd: number | null;
  min_bot_win_rate_2x_pct: number | null;
};

function num(v: string | number | bigint | null | undefined): number {
  if (v == null) return 0;
  if (typeof v === "bigint") return Number(v);
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Phase-1 filters only (mcap, source, enabled, positive buy size).
 * `min_bot_win_rate_2x_pct` reserved for a later stats join — currently never fails the match when null.
 */
export function strategyMatchesCall(strategy: StrategyMatchInput, call: CallSnapshot): { ok: true } | { ok: false; reason: string } {
  if (!strategy.enabled) return { ok: false, reason: "strategy_disabled" };
  const buy = num(strategy.max_buy_lamports);
  if (!(buy > 0)) return { ok: false, reason: "max_buy_zero" };
  if (strategy.mirror_bot_calls_only && String(call.source).trim() !== "bot") {
    return { ok: false, reason: "not_bot_call" };
  }
  const minMc = strategy.min_call_mcap_usd;
  if (minMc != null && Number.isFinite(minMc) && minMc > 0) {
    const mc = call.call_market_cap_usd;
    if (mc == null || !Number.isFinite(mc) || mc < minMc) return { ok: false, reason: "below_min_mcap" };
  }
  const minWr = strategy.min_bot_win_rate_2x_pct;
  if (minWr != null && Number.isFinite(minWr) && minWr > 0) {
    // Reserved: wire to leaderboard aggregates when available.
  }
  return { ok: true };
}

export function defaultSellRules(): CopySellRule[] {
  return [{ multiple: 2, sell_fraction: 1 }];
}
