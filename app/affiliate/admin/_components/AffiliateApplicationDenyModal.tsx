"use client";

import { useEffect, useState } from "react";

type Props = {
  open: boolean;
  email: string;
  busy: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
};

export function AffiliateApplicationDenyModal({ open, email, busy, onClose, onConfirm }: Props) {
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (!open) setReason("");
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="affiliate-deny-title"
      onClick={onClose}
    >
      <form
        className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          onConfirm(reason.trim());
        }}
      >
        <h2 id="affiliate-deny-title" className="text-lg font-semibold text-zinc-900">
          Deny application
        </h2>
        <p className="mt-1 text-sm text-zinc-600">
          This will be shown to <span className="font-medium text-zinc-900">{email}</span> on their application status
          page.
        </p>
        <label className="mt-4 block">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
            Reason (required)
          </span>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="mt-1 min-h-[100px] w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-red-400 focus:ring-1 focus:ring-red-400"
            placeholder="Brief, clear explanation they can act on…"
            required
            minLength={4}
          />
        </label>
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="h-10 flex-1 rounded-lg border border-zinc-200 bg-white text-sm font-semibold text-zinc-800 hover:bg-zinc-50 disabled:opacity-45"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy || reason.trim().length < 4}
            className="h-10 flex-1 rounded-lg border border-red-300 bg-red-600 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-45"
          >
            {busy ? "Denying…" : "Deny application"}
          </button>
        </div>
      </form>
    </div>
  );
}
