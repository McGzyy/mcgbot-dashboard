/**
 * Platform take on copy-trade milestone sells (basis points). Operator-controlled via env only — not user-editable.
 */
export function copyTradeFeeOnSellBpsFromEnv(): number {
  const raw = process.env.COPY_TRADE_FEE_ON_SELL_BPS?.trim();
  const n = raw ? Number(raw) : 100;
  if (!Number.isFinite(n)) return 100;
  return Math.max(0, Math.min(2500, Math.floor(n)));
}
