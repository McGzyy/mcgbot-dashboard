"use client";

import { useCallback, useEffect, useState } from "react";

export type ActivityPopupItem = {
  text: string;
  /** Solana mint when derivable from activity text / Dex link. */
  contractAddress: string | null;
  tokenImageUrl?: string | null;
  /** Parsed from `($TICKER)` in call lines when present. */
  tokenTicker?: string | null;
};

type ActivityPopupProps = {
  item: ActivityPopupItem | null;
  onClose: () => void;
  onViewChart: (args: {
    contractAddress: string;
    tokenTicker?: string | null;
    tokenImageUrl?: string | null;
  }) => void;
  onAddToPrivateWatchlist: (mint: string) => Promise<{ ok: boolean; error?: string }>;
};

const SOLANA_MINT_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export function ActivityPopup({
  item,
  onClose,
  onViewChart,
  onAddToPrivateWatchlist,
}: ActivityPopupProps) {
  const [wlBusy, setWlBusy] = useState(false);
  const [wlError, setWlError] = useState<string | null>(null);
  const [wlOk, setWlOk] = useState(false);

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

  if (!item) return null;

  const mint = (item.contractAddress ?? "").trim();
  const mintOk = SOLANA_MINT_RE.test(mint);

  const btnBase =
    "inline-flex min-h-[44px] flex-1 items-center justify-center rounded-xl border px-4 py-2.5 text-sm font-semibold tracking-tight transition focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100";

  return (
    <div
      className="activity-popup-backdrop fixed inset-0 z-[200] flex items-center justify-center bg-black/82 p-4 backdrop-blur-md"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="activity-popup-title"
        className="activity-popup-panel relative w-full max-w-lg rounded-2xl border border-zinc-700/90 bg-zinc-950 p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.04),0_24px_56px_-8px_rgba(0,0,0,0.85),inset_0_1px_0_0_rgba(255,255,255,0.06)] sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-lg text-zinc-500 transition hover:bg-white/[0.06] hover:text-zinc-200"
          aria-label="Close"
        >
          <span className="text-lg leading-none" aria-hidden>
            ×
          </span>
        </button>

        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">Live activity</p>
        <h2
          id="activity-popup-title"
          className="mt-2 pr-10 text-base font-semibold leading-relaxed tracking-tight text-zinc-100 sm:text-[17px]"
        >
          {item.text}
        </h2>

        {mintOk ? (
          <>
            <div className="mt-6 border-t border-white/[0.06] pt-5">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => {
                    onViewChart({
                      contractAddress: mint,
                      tokenTicker: item.tokenTicker ?? null,
                      tokenImageUrl: item.tokenImageUrl ?? null,
                    });
                    onClose();
                  }}
                  className={`${btnBase} border-sky-400/35 bg-gradient-to-b from-sky-500 to-sky-700 text-white [box-shadow:inset_0_1px_0_0_rgba(255,255,255,0.22),0_8px_20px_-6px_rgba(14,165,233,0.55)] hover:from-sky-400 hover:to-sky-600 hover:border-sky-300/45 focus-visible:ring-sky-400/55`}
                >
                  View chart
                </button>
                <button
                  type="button"
                  onClick={() => void handleAddWatchlist()}
                  disabled={wlBusy}
                  className={`${btnBase} border-emerald-500/35 bg-gradient-to-b from-emerald-600 to-emerald-800 text-white [box-shadow:inset_0_1px_0_0_rgba(255,255,255,0.18),0_8px_20px_-6px_rgba(16,185,129,0.45)] hover:from-emerald-500 hover:to-emerald-700 hover:border-emerald-400/40 focus-visible:ring-emerald-400/50`}
                >
                  {wlBusy ? "Adding…" : "Add to watchlist"}
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="mt-6 border-t border-white/[0.06] pt-5">
            <p className="rounded-xl border border-zinc-700/80 bg-zinc-900 px-4 py-3 text-sm leading-relaxed text-zinc-400">
              No Solana contract could be read from this activity. It needs a Dexscreener link or a
              mint in the text.
            </p>
          </div>
        )}

        <div className="mt-4 min-h-[3rem]">
          {wlError ? (
            <div
              className="rounded-xl border border-red-600/40 bg-red-950 px-3 py-2.5 text-sm leading-snug text-red-100"
              role="alert"
            >
              {wlError}
            </div>
          ) : null}
          {wlOk ? (
            <div className="rounded-xl border border-emerald-600/35 bg-emerald-950 px-3 py-2.5 text-sm font-medium text-emerald-50">
              Added to your private watchlist.
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
