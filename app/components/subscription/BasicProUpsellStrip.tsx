"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const DISMISS_KEY = "mcg_basic_pro_upsell_dismissed";

export function BasicProUpsellStrip() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (sessionStorage.getItem(DISMISS_KEY) === "1") return;
    } catch {
      /* ignore private mode */
    }
    setVisible(true);
  }, []);

  function dismiss() {
    try {
      sessionStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div
      className="mb-5 flex flex-col gap-2 rounded-xl border border-sky-500/25 bg-sky-500/8 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:px-4 sm:py-3"
      role="status"
    >
      <p className="min-w-0 text-xs leading-relaxed text-sky-100/90 sm:text-sm">
        <span className="font-semibold text-sky-50">Unlock Outside Calls + full alerts</span>
        <span className="hidden text-sky-100/75 sm:inline"> — Pro adds off-desk X tape, Discord DM mirrors, and unlimited daily submissions.</span>
      </p>
      <div className="flex shrink-0 items-center gap-2">
        <Link
          href="/membership?line=pro"
          className="inline-flex h-8 items-center justify-center rounded-lg bg-sky-500/90 px-3 text-xs font-bold text-sky-950 transition hover:bg-sky-400 sm:h-9 sm:px-4 sm:text-sm"
        >
          View Pro
        </Link>
        <button
          type="button"
          onClick={dismiss}
          className="inline-flex h-8 items-center justify-center rounded-lg px-2 text-xs font-medium text-sky-200/70 transition hover:bg-sky-500/10 hover:text-sky-100 sm:h-9"
          aria-label="Dismiss upgrade reminder"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
