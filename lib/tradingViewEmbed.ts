/** Wrapped SOL mint (native SOL liquidity pairs). */
export const WSOL_MINT = "So11111111111111111111111111111111111111112";

export function isWrappedSolMint(contractAddress: string | null | undefined): boolean {
  return String(contractAddress ?? "").trim() === WSOL_MINT;
}

/**
 * TradingView Advanced Chart (free widget iframe).
 * @see https://www.tradingview.com/widget-docs/widgets/charts/advanced-chart/
 */
export function tradingViewAdvancedChartEmbedUrl(opts: {
  symbol: string;
  interval?: string;
  theme?: "dark" | "light";
  hideSideToolbar?: boolean;
  allowSymbolEdit?: boolean;
}): string {
  const symbol = String(opts.symbol || "").trim() || "BINANCE:SOLUSDT";
  const interval = opts.interval ?? "5";
  const theme = opts.theme ?? "dark";
  const toolbarbg = theme === "dark" ? "131722" : "f1f3f6";
  const hideSide = opts.hideSideToolbar ? "1" : "0";
  const symboledit = opts.allowSymbolEdit === false ? "0" : "1";

  const params = new URLSearchParams({
    frameElementId: "tv_mcgbot_token_modal",
    symbol,
    interval,
    hidesidetoolbar: hideSide,
    symboledit,
    saveimage: "0",
    toolbarbg,
    studies: "[]",
    hideideas: "1",
    theme,
    style: "1",
    timezone: "Etc/UTC",
    studies_overrides: "{}",
    overrides: "{}",
    enabled_features: "[]",
    disabled_features: "[]",
    locale: "en",
    utm_source: "mcgbot-terminal",
    utm_medium: "widget",
    utm_campaign: "token-chart-modal",
  });

  return `https://s.tradingview.com/widgetembed/?${params.toString()}`;
}

/** Resolve TV symbol: explicit override, wrapped SOL → spot pair, else env/default (reference chart). */
export function resolveTradingViewSymbolForMint(
  contractAddress: string,
  tradingViewSymbol?: string | null
): string {
  const explicit = typeof tradingViewSymbol === "string" ? tradingViewSymbol.trim() : "";
  if (explicit) return explicit;
  if (isWrappedSolMint(contractAddress)) return "BINANCE:SOLUSDT";
  const fromEnv =
    typeof process !== "undefined" &&
    typeof process.env.NEXT_PUBLIC_TRADINGVIEW_MODAL_DEFAULT_SYMBOL === "string"
      ? process.env.NEXT_PUBLIC_TRADINGVIEW_MODAL_DEFAULT_SYMBOL.trim()
      : "";
  return fromEnv || "BINANCE:SOLUSDT";
}

export function shouldShowTradingViewMintDisclaimer(
  contractAddress: string,
  tradingViewSymbol?: string | null
): boolean {
  if (typeof tradingViewSymbol === "string" && tradingViewSymbol.trim()) return false;
  return !isWrappedSolMint(contractAddress);
}

/** Title for the token chart modal (ticker → name → fallback). */
export function tokenChartLabel(opts: {
  tokenTicker?: string | null;
  tokenName?: string | null;
  contractAddress: string;
  symbolFallback?: string | null;
}): string {
  const tt = typeof opts.tokenTicker === "string" ? opts.tokenTicker.trim() : "";
  if (tt) return tt.toUpperCase().slice(0, 18);
  const tn = typeof opts.tokenName === "string" ? opts.tokenName.trim() : "";
  if (tn) return tn.slice(0, 22);
  const sf = typeof opts.symbolFallback === "string" ? opts.symbolFallback.trim() : "";
  if (sf) return sf.slice(0, 18);
  const ca = String(opts.contractAddress ?? "").trim();
  if (!ca) return "Token";
  return ca.length > 10 ? `${ca.slice(0, 4)}…${ca.slice(-4)}` : ca;
}
