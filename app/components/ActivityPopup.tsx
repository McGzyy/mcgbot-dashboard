"use client";

import { useCallback, useEffect, useState } from "react";
import { terminalUi } from "@/lib/terminalDesignTokens";

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

  return (
    <div
      className={terminalUi.activityBackdrop}
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="activity-popup-title"
        className={terminalUi.activityPanel}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 rounded-md p-1 text-zinc-500 transition hover:bg-zinc-800 hover:text-zinc-200"
          aria-label="Close"
        >
          ✕
        </button>
        <h2
          id="activity-popup-title"
          className="pr-10 text-base font-semibold leading-snug text-zinc-100"
        >
          {item.text}
        </h2>

        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          {mintOk ? (
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
              className="inline-flex flex-1 justify-center rounded-lg bg-sky-600 px-4 py-2.5 text-center text-sm font-semibold text-white transition hover:bg-sky-500"
            >
              View chart
            </button>
          ) : null}

          {mintOk ? (
            <button
              type="button"
              onClick={() => void handleAddWatchlist()}
              disabled={wlBusy}
              className="inline-flex flex-1 justify-center rounded-lg border border-emerald-600/50 bg-emerald-600/15 px-4 py-2.5 text-center text-sm font-semibold text-emerald-100 transition hover:bg-emerald-600/25 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {wlBusy ? "Adding…" : "+ to Watchlist"}
            </button>
          ) : null}

          {!mintOk ? (
            <p className="text-sm text-zinc-500">
              No Solana contract could be read from this activity (needs a Dex link or mint in the
              text).
            </p>
          ) : null}
        </div>

        {wlError ? (
          <p className="mt-3 text-sm text-red-400" role="alert">
            {wlError}
          </p>
        ) : null}
        {wlOk ? (
          <p className="mt-3 text-sm text-[color:var(--accent)]">Added to your private watchlist.</p>
        ) : null}
      </div>
    </div>
  );
}
