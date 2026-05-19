"use client";

import { useEffect, useMemo, useState } from "react";
import type { DenyReapplyPolicy } from "@/lib/affiliate/affiliateDenialReapply";

export type DenyApplicationConfirm = {
  reason: string;
  reapplyPolicy: DenyReapplyPolicy;
  customReapplyDate?: string;
};

type Props = {
  open: boolean;
  email: string;
  busy: boolean;
  onClose: () => void;
  onConfirm: (input: DenyApplicationConfirm) => void;
};

export function AffiliateApplicationDenyModal({ open, email, busy, onClose, onConfirm }: Props) {
  const [reason, setReason] = useState("");
  const [reapplyPolicy, setReapplyPolicy] = useState<DenyReapplyPolicy>("permanent");
  const [customReapplyDate, setCustomReapplyDate] = useState("");

  useEffect(() => {
    if (!open) {
      setReason("");
      setReapplyPolicy("permanent");
      setCustomReapplyDate("");
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const customDateInvalid = useMemo(() => {
    if (reapplyPolicy !== "custom") return false;
    const raw = customReapplyDate.trim();
    if (!raw) return true;
    const ms = Date.parse(raw);
    return !Number.isFinite(ms) || ms <= Date.now();
  }, [reapplyPolicy, customReapplyDate]);

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
        className="max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-2xl border border-zinc-200 bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          onConfirm({
            reason: reason.trim(),
            reapplyPolicy,
            customReapplyDate: customReapplyDate.trim() || undefined,
          });
        }}
      >
        <h2 id="affiliate-deny-title" className="text-lg font-semibold text-zinc-900">
          Deny application
        </h2>
        <p className="mt-1 text-sm text-zinc-600">
          Shown to <span className="font-medium text-zinc-900">{email}</span> on their application status page.
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

        <fieldset className="mt-4 space-y-2">
          <legend className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
            Re-application policy
          </legend>
          <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-zinc-200 px-3 py-2.5">
            <input
              type="radio"
              name="reapplyPolicy"
              checked={reapplyPolicy === "permanent"}
              onChange={() => setReapplyPolicy("permanent")}
              className="mt-0.5"
            />
            <span className="text-sm text-zinc-800">
              <span className="font-semibold text-zinc-900">Permanent</span> — cannot apply again with this email
            </span>
          </label>
          <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-zinc-200 px-3 py-2.5">
            <input
              type="radio"
              name="reapplyPolicy"
              checked={reapplyPolicy === "immediate"}
              onChange={() => setReapplyPolicy("immediate")}
              className="mt-0.5"
            />
            <span className="text-sm text-zinc-800">
              <span className="font-semibold text-zinc-900">Allow resubmit</span> — they can submit an updated
              application anytime
            </span>
          </label>
          <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-zinc-200 px-3 py-2.5">
            <input
              type="radio"
              name="reapplyPolicy"
              checked={reapplyPolicy === "30d"}
              onChange={() => setReapplyPolicy("30d")}
              className="mt-0.5"
            />
            <span className="text-sm text-zinc-800">
              <span className="font-semibold text-zinc-900">Allow after 30 days</span>
            </span>
          </label>
          <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-zinc-200 px-3 py-2.5">
            <input
              type="radio"
              name="reapplyPolicy"
              checked={reapplyPolicy === "90d"}
              onChange={() => setReapplyPolicy("90d")}
              className="mt-0.5"
            />
            <span className="text-sm text-zinc-800">
              <span className="font-semibold text-zinc-900">Allow after 90 days</span>
            </span>
          </label>
          <label className="flex cursor-pointer flex-col gap-2 rounded-lg border border-zinc-200 px-3 py-2.5">
            <span className="flex items-start gap-2">
              <input
                type="radio"
                name="reapplyPolicy"
                checked={reapplyPolicy === "custom"}
                onChange={() => setReapplyPolicy("custom")}
                className="mt-0.5"
              />
              <span className="text-sm text-zinc-800">
                <span className="font-semibold text-zinc-900">Allow after date</span>
              </span>
            </span>
            {reapplyPolicy === "custom" ? (
              <input
                type="datetime-local"
                value={customReapplyDate}
                onChange={(e) => setCustomReapplyDate(e.target.value)}
                className="ml-6 h-9 w-full max-w-xs rounded-lg border border-zinc-200 px-2 text-sm text-zinc-900"
                required
              />
            ) : null}
          </label>
        </fieldset>

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
            disabled={busy || reason.trim().length < 4 || customDateInvalid}
            className="h-10 flex-1 rounded-lg border border-red-300 bg-red-600 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-45"
          >
            {busy ? "Denying…" : "Deny application"}
          </button>
        </div>
      </form>
    </div>
  );
}
