"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { parseSolanaMintFromInput } from "@/lib/solanaCa";
import { terminalUi } from "@/lib/terminalDesignTokens";

type Visibility = "private" | "public";

export type AddToWatchlistModalProps = {
  open: boolean;
  onClose: () => void;
  /** Called after a successful add (either mode). */
  onAdded?: () => void;
};

export function AddToWatchlistModal({
  open,
  onClose,
  onAdded,
}: AddToWatchlistModalProps) {
  const [ca, setCa] = useState("");
  const [visibility, setVisibility] = useState<Visibility>("private");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!open) return;
    setCa("");
    setVisibility("private");
    setSubmitting(false);
    setError(null);
    setSuccess(false);
  }, [open]);

  const handleSubmit = useCallback(async () => {
    const mint = parseSolanaMintFromInput(ca);
    if (!mint || submitting) return;

    setSubmitting(true);
    setError(null);
    setSuccess(false);

    try {
      const res = await fetch("/api/me/watchlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          action: "add",
          scope: visibility,
          mint,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        error?: string;
        note?: string;
      };
      if (!res.ok || data.success !== true) {
        setError(
          data.error ||
            (visibility === "public"
              ? "Could not save public watch (Discord bot may be offline — try Private)."
              : "Could not save to your watchlist.")
        );
        return;
      }
      setSuccess(true);
      onAdded?.();
      window.setTimeout(() => {
        onClose();
      }, 700);
    } catch {
      setError("Network error — try again.");
    } finally {
      setSubmitting(false);
    }
  }, [ca, submitting, visibility, onAdded, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 grid min-h-[100dvh] place-items-center overflow-y-auto bg-black/60 px-4 py-8 sm:py-10"
      role="dialog"
      aria-modal="true"
      aria-label="Add to watchlist"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className={terminalUi.dialogPanelCompact}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-zinc-100">Add to watchlist</h3>
            <p className="mt-1 text-xs text-zinc-500">
              <span className="font-medium text-zinc-400">Private</span> saves only for
              you. <span className="font-medium text-zinc-400">Public</span> posts like{" "}
              <code className="rounded bg-zinc-900 px-1 text-[11px] text-zinc-300">
                !watch
              </code>{" "}
              in #user-calls (same bot flow as Discord).
            </p>
          </div>
          <button
            type="button"
            onClick={() => onClose()}
            className={terminalUi.modalCloseIconBtn}
            aria-label="Close"
            disabled={submitting}
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

        <div className="mt-4 space-y-3">
          <label className="block text-xs font-medium text-zinc-400">
            Solana contract
            <input
              type="text"
              value={ca}
              onChange={(e) => setCa(e.target.value)}
              placeholder="Paste mint address"
              disabled={submitting}
              className={`mt-1 ${terminalUi.formInput}`}
            />
          </label>

          <fieldset className="space-y-2">
            <legend className="text-xs font-medium text-zinc-400">Visibility</legend>
            <label className={terminalUi.choiceRow}>
              <input
                type="radio"
                name="watch-visibility"
                checked={visibility === "private"}
                onChange={() => setVisibility("private")}
                disabled={submitting}
                className="accent-[color:var(--accent)]"
              />
              <span>
                <span className="font-medium">Private</span>
                <span className="ml-1 text-xs text-zinc-500">
                  — your list only (dashboard)
                </span>
              </span>
            </label>
            <label className={terminalUi.choiceRow}>
              <input
                type="radio"
                name="watch-visibility"
                checked={visibility === "public"}
                onChange={() => setVisibility("public")}
                disabled={submitting}
                className="accent-[color:var(--accent)]"
              />
              <span>
                <span className="font-medium">Public</span>
                <span className="ml-1 text-xs text-zinc-500">
                  — #user-calls + bot tracking (like Discord)
                </span>
              </span>
            </label>
          </fieldset>

          {error ? (
            <p className="text-sm text-red-400" role="alert">
              {error}
            </p>
          ) : null}
          {success ? (
            <p className="text-sm text-[color:var(--accent)]">Saved.</p>
          ) : null}

          <div className={`flex flex-wrap items-center justify-between gap-2 pt-3 ${terminalUi.inlineFooterRule}`}>
            <Link
              href="/watchlist"
              className="text-xs text-zinc-500 underline-offset-2 hover:text-zinc-300 hover:underline"
              onClick={() => onClose()}
            >
              Open full watchlist page
            </Link>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onClose()}
                disabled={submitting}
                className={terminalUi.secondaryButtonSm}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleSubmit()}
                disabled={submitting || parseSolanaMintFromInput(ca) == null}
                className="rounded-md bg-[color:var(--accent)] px-3 py-1.5 text-xs font-medium text-black shadow-lg shadow-black/40 transition hover:bg-green-500 disabled:opacity-60"
              >
                {submitting ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
