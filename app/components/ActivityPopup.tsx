"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { terminalUi } from "@/lib/terminalDesignTokens";
import { parseOutsideActivityLineText } from "@/lib/outsideActivityFeedFormat";

export type ActivityPopupItem = {
  text: string;
  /** Solana mint when derivable from activity text / Dex link. */
  contractAddress: string | null;
  tokenImageUrl?: string | null;
  /** Parsed from `($TICKER)` or milestone `$TICK hit …` lines. */
  tokenTicker?: string | null;
  /** Parsed from `New Call - … called Name ($TICK)` when present. */
  tokenName?: string | null;
  /** Original X post when present (e.g. outside monitor rows). */
  xPostUrl?: string | null;
};

type ActivityPopupProps = {
  item: ActivityPopupItem | null;
  onClose: () => void;
  onViewChart: (args: {
    contractAddress: string;
    tokenTicker?: string | null;
    tokenName?: string | null;
    tokenImageUrl?: string | null;
  }) => void;
  onAddToPrivateWatchlist: (mint: string) => Promise<{ ok: boolean; error?: string }>;
};

const SOLANA_MINT_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

function shortenMint(ca: string): string {
  const t = ca.trim();
  if (t.length <= 12) return t;
  return `${t.slice(0, 4)}…${t.slice(-4)}`;
}

function dexScreenerUrl(mint: string): string {
  return `https://dexscreener.com/solana/${encodeURIComponent(mint.trim())}`;
}

/** Split common “New Call - … called …” copy into caller + tail for clearer layout. */
function parseCallActivityHeadline(text: string): { caller: string; tail: string } | null {
  const m = text.match(/^New Call - (.+?) called (.+)$/i);
  if (!m) return null;
  return { caller: (m[1] ?? "").trim(), tail: (m[2] ?? "").trim() };
}

export function ActivityPopup({
  item,
  onClose,
  onViewChart,
  onAddToPrivateWatchlist,
}: ActivityPopupProps) {
  const [wlBusy, setWlBusy] = useState(false);
  const [wlError, setWlError] = useState<string | null>(null);
  const [wlOk, setWlOk] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);
  const [copyState, setCopyState] = useState<"idle" | "ok" | "err">("idle");

  useEffect(() => {
    if (!item) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [item, onClose]);

  useEffect(() => {
    if (!item) return;
    setWlBusy(false);
    setWlError(null);
    setWlOk(false);
    setImgFailed(false);
    setCopyState("idle");
  }, [item]);

  const handleAddWatchlist = useCallback(async () => {
    const mint = (item?.contractAddress ?? "").trim();
    if (!mint || wlBusy) return;
    setWlBusy(true);
    setWlError(null);
    setWlOk(false);
    try {
      const res = await onAddToPrivateWatchlist(mint);
      if (res.ok) {
        setWlOk(true);
        window.setTimeout(() => onClose(), 650);
      } else {
        setWlError(res.error ?? "Could not add to watchlist");
      }
    } catch {
      setWlError("Request failed");
    } finally {
      setWlBusy(false);
    }
  }, [item?.contractAddress, onAddToPrivateWatchlist, onClose, wlBusy]);

  const copyContractAddress = useCallback(async (fullMint: string) => {
    const t = fullMint.trim();
    if (!t) return;
    try {
      await navigator.clipboard.writeText(t);
      setCopyState("ok");
      window.setTimeout(() => setCopyState("idle"), 2000);
    } catch {
      setCopyState("err");
      window.setTimeout(() => setCopyState("idle"), 2500);
    }
  }, []);

  if (!item) return null;

  const mint = (item.contractAddress ?? "").trim();
  const mintOk = SOLANA_MINT_RE.test(mint);
  const outsideParsed = parseOutsideActivityLineText(item.text);
  const parsedCall = parseCallActivityHeadline(item.text);
  const ticker = (item.tokenTicker ?? "").trim();

  return (
    <div
      className={terminalUi.activityBackdrop}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="activity-popup-title"
        className={`${terminalUi.activityPanel} shadow-[inset_0_1px_0_0_rgba(63,63,70,0.18)]`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-zinc-800/70 pb-4">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-400/85">McGBot Terminal</p>
            <h2 id="activity-popup-title" className="mt-1 text-base font-semibold tracking-tight text-white">
              {outsideParsed ? "Outside call" : parsedCall ? "New call" : "Activity"}
            </h2>
            {outsideParsed ? (
              <p className="mt-2 text-sm leading-relaxed text-zinc-300">
                <span className="font-medium text-emerald-300/75">{outsideParsed.tapeLabel}</span>
                <span className="text-zinc-500"> (@{outsideParsed.xHandle || "unknown"})</span>
                <span className="text-zinc-500"> flagged this contract from X.</span>
              </p>
            ) : parsedCall ? (
              <p className="mt-2 text-sm leading-relaxed text-zinc-300">
                <span className="font-medium text-zinc-100">{parsedCall.caller}</span>
                <span className="text-zinc-500"> called </span>
                <span className="text-zinc-200">{parsedCall.tail}</span>
              </p>
            ) : (
              <p className="mt-2 text-sm leading-relaxed text-zinc-300">{item.text}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className={terminalUi.modalCloseIconBtn}
            aria-label="Close"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-4 w-4"
              aria-hidden
            >
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {mintOk ? (
          <div className="mt-4 flex gap-3 rounded-xl border border-zinc-800/80 bg-gradient-to-b from-zinc-900/40 to-black/20 p-3 shadow-[inset_0_1px_0_0_rgba(63,63,70,0.12)]">
            {item.tokenImageUrl && !imgFailed ? (
              <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-zinc-800/90 bg-zinc-900">
                {/* eslint-disable-next-line @next/next/no-img-element -- token icons from arbitrary CDNs */}
                <img
                  src={item.tokenImageUrl}
                  alt=""
                  className="h-full w-full object-cover"
                  loading="lazy"
                  referrerPolicy="no-referrer"
                  onError={() => setImgFailed(true)}
                />
              </div>
            ) : (
              <div
                className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border border-zinc-800/90 bg-zinc-900/80 text-lg font-bold text-zinc-600"
                aria-hidden
              >
                {ticker ? ticker.slice(0, 1).toUpperCase() : "◆"}
              </div>
            )}
            <div className="min-w-0 flex-1">
              {ticker ? (
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Ticker</p>
              ) : null}
              {ticker ? <p className="truncate font-mono text-sm font-semibold text-cyan-300/95">${ticker}</p> : null}
              <div className="mt-1 flex items-center justify-between gap-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Contract</p>
                {copyState === "ok" ? (
                  <span className="text-[10px] font-semibold text-[color:var(--accent)]">Copied</span>
                ) : copyState === "err" ? (
                  <span className="text-[10px] font-semibold text-red-400">Copy failed</span>
                ) : null}
              </div>
              <div className="flex items-center gap-2">
                <p
                  className="min-w-0 flex-1 truncate font-mono text-[11px] leading-snug text-zinc-300"
                  title={mint}
                >
                  {shortenMint(mint)}
                </p>
                <button
                  type="button"
                  onClick={() => void copyContractAddress(mint)}
                  className="inline-flex shrink-0 items-center gap-1 rounded-md border border-zinc-700/90 bg-zinc-900/60 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-300 transition hover:border-zinc-600 hover:bg-zinc-800/70 hover:text-zinc-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]/30"
                  aria-label="Copy full contract address"
                  title="Copy full contract address"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-3.5 w-3.5"
                    aria-hidden
                  >
                    <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
                    <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
                  </svg>
                  Copy CA
                </button>
              </div>
              <Link
                href={dexScreenerUrl(mint)}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex text-xs font-semibold text-cyan-400/90 underline-offset-2 hover:underline"
              >
                Dexscreener →
              </Link>
              {outsideParsed && (item.xPostUrl ?? "").trim() ? (
                <Link
                  href={(item.xPostUrl ?? "").trim()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1.5 inline-flex text-xs font-semibold text-zinc-400 underline-offset-2 hover:text-zinc-200 hover:underline"
                >
                  View X post →
                </Link>
              ) : null}
            </div>
          </div>
        ) : null}

        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
          {mintOk ? (
            <>
              <button
                type="button"
                onClick={() => {
                  onViewChart({
                    contractAddress: mint,
                    tokenTicker: item.tokenTicker ?? null,
                    tokenName: item.tokenName ?? null,
                    tokenImageUrl: item.tokenImageUrl ?? null,
                  });
                  onClose();
                }}
                className="inline-flex flex-1 justify-center rounded-md bg-[color:var(--accent)] px-4 py-2.5 text-center text-sm font-semibold text-black shadow-lg shadow-black/35 transition hover:bg-green-500 sm:flex-none sm:min-w-[140px]"
              >
                View chart
              </button>
              <button
                type="button"
                onClick={() => void handleAddWatchlist()}
                disabled={wlBusy}
                className="inline-flex flex-1 justify-center rounded-md border border-zinc-700/90 bg-zinc-900/50 px-4 py-2.5 text-center text-sm font-semibold text-zinc-200 transition hover:border-zinc-600 hover:bg-zinc-800/60 disabled:cursor-not-allowed disabled:opacity-50 sm:flex-none sm:min-w-[160px]"
              >
                {wlBusy ? "Adding…" : "Add to watchlist"}
              </button>
            </>
          ) : (
            <p className="text-sm leading-relaxed text-zinc-500">
              No Solana contract could be read from this line. Open a row that includes a mint or Dexscreener link, or
              use CA Analyzer from the top bar.
            </p>
          )}
        </div>

        {wlError ? (
          <p className="mt-3 rounded-lg border border-red-500/30 bg-red-950/25 px-3 py-2 text-sm text-red-200/95" role="alert">
            {wlError}
          </p>
        ) : null}
        {wlOk ? (
          <p className="mt-3 rounded-lg border border-[color:var(--accent)]/25 bg-[color:var(--accent)]/10 px-3 py-2 text-sm font-medium text-[color:var(--accent)]">
            Added to your private watchlist.
          </p>
        ) : null}
      </div>
    </div>
  );
}
