"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

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
    const trimmed = ca.trim();
    if (!trimmed || submitting) return;

    setSubmitting(true);
    setError(null);
    setSuccess(false);

    try {
      if (visibility === "private") {
        const res = await fetch("/api/me/watchlist", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({
            action: "add",
            scope: "private",
            mint: trimmed,
          }),
        });
        const data = (await res.json().catch(() => ({}))) as {
          success?: boolean;
          error?: string;
        };
        if (!res.ok) {
          setError(data.error || "Could not save to your private watchlist");
          return;
        }
        setSuccess(true);
        onAdded?.();
        window.setTimeout(() => {
          onClose();
        }, 700);
        return;
      }

      const rec = await fetch("/api/me/watchlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          action: "add",
          scope: "public",
          mint: trimmed,
        }),
      });
      const recJson = (await rec.json().catch(() => ({}))) as {
        success?: boolean;
        error?: string;
      };
      if (!rec.ok) {
        setError(
          recJson.error ||
            "Posted to Discord, but saving this entry on your watchlist page failed."
        );
        return;
      }

      setSuccess(true);
      onAdded?.();
      window.setTimeout(() => {
        onClose();
      }, 700);
    } catch {
      setError("Request failed");
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
      <div className="my-auto w-full max-w-md rounded-xl border border-[#1a1a1a] bg-[#0a0a0a] p-4 shadow-xl shadow-black/50 backdrop-blur">
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
            className="flex h-8 w-8 items-center justify-center rounded-md border border-[#1a1a1a] bg-[#0a0a0a] text-zinc-300 transition hover:bg-zinc-900/40 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]/25"
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
              className="mt-1 w-full rounded-lg border border-[#1a1a1a] bg-[#050505] px-3 py-2 text-sm text-zinc-200 outline-none ring-[color:var(--accent)]/20 focus:ring-2 disabled:opacity-60"
            />
          </label>

          <fieldset className="space-y-2">
            <legend className="text-xs font-medium text-zinc-400">Visibility</legend>
            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-[#1a1a1a] bg-zinc-950/50 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-900/40">
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
            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-[#1a1a1a] bg-zinc-950/50 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-900/40">
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

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#1a1a1a] pt-3">
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
                className="rounded-md border border-[#1a1a1a] bg-[#0a0a0a] px-3 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-900/40 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleSubmit()}
                disabled={submitting || ca.trim() === ""}
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
