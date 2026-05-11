"use client";

import { dexscreenerTokenUrl, solscanAccountUrl } from "@/lib/modUiUtils";
import {
  resolveTradingViewSymbolForMint,
  shouldShowTradingViewMintDisclaimer,
  tradingViewAdvancedChartEmbedUrl,
} from "@/lib/tradingViewEmbed";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export type TokenChartModalPayload = {
  /** Dex chain segment (default solana). */
  chain?: string;
  contractAddress: string;
  /** Preferred label (e.g. ticker). Optional; computed from other fields if omitted. */
  symbolLabel?: string;
  tokenName?: string | null;
  tokenTicker?: string | null;
  tokenImageUrl?: string | null;
  /** When set, chart loads this `EXCHANGE:PAIR` instead of heuristics. */
  tradingViewSymbol?: string | null;
};

type Props = {
  open: boolean;
  payload: TokenChartModalPayload | null;
  onClose: () => void;
};

const MODE_STORAGE_KEY = "mcgbot_token_chart_mode_v1";

export function TokenChartModal({ open, payload, onClose }: Props) {
  const [copied, setCopied] = useState(false);
  const [chartMode, setChartMode] = useState<"gecko" | "tv">("gecko");
  const [loaded, setLoaded] = useState(false);
  const [embedTimedOut, setEmbedTimedOut] = useState(false);
  const timeoutRef = useRef<number | null>(null);
  const lastScrollYRef = useRef<number>(0);

  useEffect(() => {
    if (!open) return;
    setCopied(false);
    setLoaded(false);
    setEmbedTimedOut(false);

    // Restore last mode (desktop power users).
    try {
      const stored = window.localStorage.getItem(MODE_STORAGE_KEY);
      if (stored === "tv" || stored === "gecko") {
        setChartMode(stored);
      } else {
        setChartMode("gecko");
      }
    } catch {
      setChartMode("gecko");
    }
  }, [open, payload?.contractAddress]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Premium UX: lock background scroll, restore position on close.
  useEffect(() => {
    if (!open) return;
    const body = document.body;
    lastScrollYRef.current = window.scrollY;
    const prevOverflow = body.style.overflow;
    const prevPaddingRight = body.style.paddingRight;
    const scrollbarComp =
      window.innerWidth - document.documentElement.clientWidth;
    body.style.overflow = "hidden";
    if (scrollbarComp > 0) {
      body.style.paddingRight = `${scrollbarComp}px`;
    }
    return () => {
      body.style.overflow = prevOverflow;
      body.style.paddingRight = prevPaddingRight;
      window.scrollTo({ top: lastScrollYRef.current });
    };
  }, [open]);

  const ca = payload?.contractAddress?.trim() ?? "";
  const chain = payload?.chain?.trim() || "solana";
  const dexUrl = ca ? dexscreenerTokenUrl(chain, ca) : null;
  const solscanUrl = ca ? solscanAccountUrl(ca) : null;

  const title = useMemo(() => {
    const fromLabel = typeof payload?.symbolLabel === "string" ? payload.symbolLabel.trim() : "";
    const tt = typeof payload?.tokenTicker === "string" ? payload.tokenTicker.trim() : "";
    const tn = typeof payload?.tokenName === "string" ? payload.tokenName.trim() : "";
    if (fromLabel) return fromLabel;
    if (tt) return tt.toUpperCase();
    if (tn) return tn;
    return "Token";
  }, [payload?.symbolLabel, payload?.tokenTicker, payload?.tokenName]);

  const subtitle = useMemo(() => {
    const tt = typeof payload?.tokenTicker === "string" ? payload.tokenTicker.trim() : "";
    const tn = typeof payload?.tokenName === "string" ? payload.tokenName.trim() : "";
    if (tt && tn) return `${tt.toUpperCase()} · ${tn}`;
    if (tn) return tn;
    return null;
  }, [payload?.tokenTicker, payload?.tokenName]);

  const tvSymbol = useMemo(() => {
    if (!ca) return "BINANCE:SOLUSDT";
    return resolveTradingViewSymbolForMint(ca, payload?.tradingViewSymbol);
  }, [ca, payload?.tradingViewSymbol]);

  const showMintDisclaimer =
    chartMode === "tv" && ca
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

  const geckoSrc = useMemo(() => {
    if (!ca) return "";
    // GeckoTerminal: `embed=1` is frameable; token URLs redirect to the best pool and honor
    // `chart_type` + `resolution` in the Location (e.g. market cap axis + 1s candles).
    const seg = String(chain || "solana").toLowerCase().trim() || "solana";
    const path = `/${encodeURIComponent(seg)}/tokens/${encodeURIComponent(ca)}`;
    const qs = new URLSearchParams();
    qs.set("embed", "1");
    qs.set("chart_type", "market_cap");
    qs.set("resolution", "1s");
    return `https://www.geckoterminal.com${path}?${qs.toString()}`;
  }, [ca, chain]);

  /** Same chart target without embed (new tab / timeout fallback). */
  const geckoExternalUrl = useMemo(() => {
    if (!geckoSrc) return "";
    try {
      const u = new URL(geckoSrc);
      u.searchParams.delete("embed");
      return u.toString();
    } catch {
      return geckoSrc.replace(/([?&])embed=1(&|$)/i, "$1").replace(/[?&]$/, "");
    }
  }, [geckoSrc]);

  const activeSrc = chartMode === "gecko" ? geckoSrc : iframeSrc;

  // Loading + timeout for iframe (no reliable onError).
  useEffect(() => {
    if (!open) return;
    setLoaded(false);
    setEmbedTimedOut(false);
    if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    timeoutRef.current = window.setTimeout(() => {
      setEmbedTimedOut(true);
    }, 9000);
    return () => {
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    };
  }, [open, activeSrc]);

  const onIframeLoad = useCallback(() => {
    setLoaded(true);
    setEmbedTimedOut(false);
    if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    timeoutRef.current = null;
  }, []);

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
      <div className="flex h-[min(88dvh,900px)] max-h-[100dvh] w-full max-w-6xl flex-col overflow-hidden rounded-t-2xl border border-zinc-800/90 bg-zinc-950 shadow-2xl shadow-black/60 sm:h-[min(92dvh,940px)] sm:rounded-2xl">
        <div className="sticky top-0 z-10 flex shrink-0 flex-wrap items-start justify-between gap-3 border-b border-zinc-800/80 bg-zinc-950/95 px-4 py-3 backdrop-blur sm:px-5">
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
              {subtitle ? (
                <p className="mt-0.5 truncate text-xs text-zinc-500">{subtitle}</p>
              ) : null}
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
            <div className="hidden items-center gap-1 rounded-lg border border-zinc-800/80 bg-black/30 p-1 sm:flex">
              <button
                type="button"
                onClick={() => {
                  setChartMode("gecko");
                  try {
                    window.localStorage.setItem(MODE_STORAGE_KEY, "gecko");
                  } catch {}
                }}
                className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition ${
                  chartMode === "gecko"
                    ? "bg-emerald-500/15 text-emerald-100"
                    : "text-zinc-400 hover:text-zinc-100"
                }`}
                title="GeckoTerminal embed (DEX chart)"
              >
                Live
              </button>
              <button
                type="button"
                onClick={() => {
                  setChartMode("tv");
                  try {
                    window.localStorage.setItem(MODE_STORAGE_KEY, "tv");
                  } catch {}
                }}
                className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition ${
                  chartMode === "tv"
                    ? "bg-sky-500/15 text-sky-100"
                    : "text-zinc-400 hover:text-zinc-100"
                }`}
                title="TradingView listed symbol (CEX pair)"
              >
                TV
              </button>
            </div>
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

        <div className="relative min-h-0 flex-1 bg-black">
          {!loaded ? (
            <div className="absolute inset-0 z-[5] flex items-center justify-center bg-black/70">
              <div className="w-full max-w-md px-6 text-center">
                <div className="mx-auto mb-3 h-10 w-10 animate-pulse rounded-full bg-zinc-800/80" />
                <p className="text-sm font-semibold text-zinc-200">Loading chart…</p>
                <p className="mt-1 text-xs text-zinc-500">
                  If it takes too long, open an external chart below.
                </p>
                {embedTimedOut ? (
                  <div className="mt-4 flex flex-wrap justify-center gap-2">
                    {dexUrl ? (
                      <a
                        href={dexUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-lg border border-cyan-500/35 bg-cyan-500/10 px-3 py-2 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-500/20"
                      >
                        Dexscreener
                      </a>
                    ) : null}
                    <a
                      href={
                        chartMode === "gecko"
                          ? geckoExternalUrl || "https://www.geckoterminal.com/"
                          : "https://www.tradingview.com/"
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-lg border border-zinc-700/80 bg-zinc-900/60 px-3 py-2 text-xs font-semibold text-zinc-200 transition hover:border-zinc-600 hover:text-zinc-100"
                    >
                      Open externally
                    </a>
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}
          <iframe
            key={chartMode === "gecko" ? geckoSrc : tvSymbol}
            title={chartMode === "gecko" ? "GeckoTerminal chart" : "TradingView chart"}
            src={chartMode === "gecko" ? geckoSrc : iframeSrc}
            className="min-h-0 w-full flex-1 border-0"
            referrerPolicy="no-referrer-when-downgrade"
            allow="clipboard-write; fullscreen"
            onLoad={onIframeLoad}
          />
        </div>
      </div>
    </div>
  );
}
