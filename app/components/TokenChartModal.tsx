"use client";

import { dexscreenerTokenUrl, solscanAccountUrl } from "@/lib/modUiUtils";
import {
  resolveTradingViewSymbolForMint,
  shouldShowTradingViewMintDisclaimer,
  tradingViewAdvancedChartEmbedUrl,
} from "@/lib/tradingViewEmbed";
import { useCallback, useEffect, useMemo, useState } from "react";

export type TokenChartModalPayload = {
  /** Dex chain segment (default solana). */
  chain?: string;
  contractAddress: string;
  /** Short title (ticker or name). */
  symbolLabel: string;
  tokenImageUrl?: string | null;
  /** When set, chart loads this `EXCHANGE:PAIR` instead of heuristics. */
  tradingViewSymbol?: string | null;
};

type Props = {
  open: boolean;
  payload: TokenChartModalPayload | null;
  onClose: () => void;
};

export function TokenChartModal({ open, payload, onClose }: Props) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return;
    setCopied(false);
  }, [open, payload?.contractAddress]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const ca = payload?.contractAddress?.trim() ?? "";
  const chain = payload?.chain?.trim() || "solana";
  const dexUrl = ca ? dexscreenerTokenUrl(chain, ca) : null;
  const solscanUrl = ca ? solscanAccountUrl(ca) : null;

  const tvSymbol = useMemo(() => {
    if (!ca) return "BINANCE:SOLUSDT";
    return resolveTradingViewSymbolForMint(ca, payload?.tradingViewSymbol);
  }, [ca, payload?.tradingViewSymbol]);

  const showMintDisclaimer = ca
    ? shouldShowTradingViewMintDisclaimer(ca, payload?.tradingViewSymbol)
    : false;

  const iframeSrc = useMemo(
    () =>
      tradingViewAdvancedChartEmbedUrl({
        symbol: tvSymbol,
        interval: "5",
        theme: "dark",
        hideSideToolbar: false,
        allowSymbolEdit: true,
      }),
    [tvSymbol]
  );

  const copyCa = useCallback(async () => {
    if (!ca) return;
    try {
      await navigator.clipboard.writeText(ca);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }, [ca]);

  if (!open || !payload || !ca) return null;

  const title = payload.symbolLabel?.trim() || "Token";

  return (
    <div
      className="fixed inset-0 z-[120] flex items-end justify-center bg-black/70 px-0 py-0 sm:items-center sm:px-4 sm:py-8"
      role="dialog"
      aria-modal="true"
      aria-label={`Chart: ${title}`}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[100dvh] w-full max-w-5xl flex-col overflow-hidden rounded-t-2xl border border-zinc-800/90 bg-[#09090b] shadow-2xl shadow-black/60 sm:max-h-[min(92dvh,880px)] sm:rounded-2xl">
        <div className="flex shrink-0 flex-wrap items-start justify-between gap-3 border-b border-zinc-800/80 px-4 py-3 sm:px-5">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            {payload.tokenImageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={payload.tokenImageUrl}
                alt=""
                className="h-10 w-10 shrink-0 rounded-lg border border-zinc-700/60 object-cover"
                loading="lazy"
                referrerPolicy="no-referrer"
              />
            ) : null}
            <div className="min-w-0">
              <h2 className="truncate text-base font-semibold tracking-tight text-zinc-50 sm:text-lg">
                {title}
              </h2>
              <div className="mt-1 flex min-w-0 flex-wrap items-center gap-2">
                <code className="max-w-[min(100%,28rem)] truncate rounded bg-black/40 px-1.5 py-0.5 text-[11px] text-zinc-400">
                  {ca}
                </code>
                <button
                  type="button"
                  onClick={() => void copyCa()}
                  className="shrink-0 rounded border border-zinc-700/80 bg-zinc-900/60 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-300 transition hover:border-zinc-600 hover:text-zinc-100"
                >
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {dexUrl ? (
              <a
                href={dexUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg border border-cyan-500/35 bg-cyan-500/10 px-2.5 py-1.5 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-500/20"
              >
                Dexscreener
              </a>
            ) : null}
            {solscanUrl ? (
              <a
                href={solscanUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg border border-zinc-700/80 bg-zinc-900/60 px-2.5 py-1.5 text-xs font-semibold text-zinc-300 transition hover:border-zinc-600 hover:text-zinc-100"
              >
                Solscan
              </a>
            ) : null}
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-zinc-700/80 px-2.5 py-1.5 text-xs font-semibold text-zinc-400 transition hover:bg-zinc-900 hover:text-zinc-100"
            >
              Close
            </button>
          </div>
        </div>

        {showMintDisclaimer ? (
          <div className="shrink-0 border-b border-amber-500/20 bg-amber-500/10 px-4 py-2 text-[11px] leading-snug text-amber-100/95 sm:px-5">
            TradingView charts use <span className="font-semibold">listed symbols</span> (e.g.{" "}
            <code className="rounded bg-black/30 px-1">EXCHANGE:PAIR</code>), not raw Solana mints.
            This embed defaults to a reference pair; use the chart&apos;s symbol search or open{" "}
            <span className="font-semibold">Dexscreener</span> for this contract&apos;s live DEX
            chart.
          </div>
        ) : null}

        <div className="min-h-0 flex-1 bg-black">
          <iframe
            key={tvSymbol}
            title="TradingView chart"
            src={iframeSrc}
            className="h-[min(58dvh,560px)] w-full min-h-[320px] border-0 sm:h-[min(62vh,620px)]"
            referrerPolicy="no-referrer-when-downgrade"
            allow="clipboard-write; fullscreen"
          />
        </div>
      </div>
    </div>
  );
}
