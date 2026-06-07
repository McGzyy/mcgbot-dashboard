"use client";

import { isIosDevice, isStandalonePwa } from "@/lib/discordSignIn";
import { useEffect, useState } from "react";

const DISMISS_KEY = "mcg_ios_legacy_standalone_dismissed";

/**
 * Users who added McGBot to the home screen before we disabled iOS standalone mode are
 * stuck in a WebKit shell where Discord login has no keyboard. One-time nudge to re-add.
 */
export function IosLegacyStandaloneBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!isIosDevice() || !isStandalonePwa()) return;
    try {
      if (localStorage.getItem(DISMISS_KEY) === "1") return;
    } catch {
      /* ignore */
    }
    setVisible(true);
  }, []);

  if (!visible) return null;

  const dismiss = () => {
    setVisible(false);
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
  };

  return (
    <div
      role="status"
      className="border-b border-amber-500/30 bg-amber-950/40 px-4 pb-3 pt-[max(0.625rem,env(safe-area-inset-top))] text-center text-xs leading-snug text-amber-100/95"
    >
      <p className="font-semibold text-amber-50">Update your home screen shortcut</p>
      <p className="mt-1 text-amber-100/85">
        Remove this McGBot icon, open{" "}
        <strong className="font-semibold text-white">mcgbot.xyz in Safari</strong>, then Share → Add to
        Home Screen again. Discord login will work with one tap — no extra browser steps.
      </p>
      <button
        type="button"
        onClick={dismiss}
        className="mt-2 font-semibold text-amber-200/90 underline decoration-amber-400/40 underline-offset-2"
      >
        Dismiss
      </button>
    </div>
  );
}
