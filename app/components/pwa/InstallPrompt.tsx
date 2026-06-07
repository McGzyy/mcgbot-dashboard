"use client";

import { useCallback, useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "mcgbot_pwa_install_dismissed";

function isIos(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (navigator as any).standalone === true
  );
}

function IosShareGlyph({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M8 2.5v6" />
      <path d="M5.5 4.25 8 1.75 10.5 4.25" />
      <rect x="3.25" y="7" width="9.5" height="6.75" rx="1.25" />
    </svg>
  );
}

export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [showIosHint, setShowIosHint] = useState(false);

  useEffect(() => {
    if (isStandalone()) return;
    try {
      if (sessionStorage.getItem(DISMISS_KEY) === "1") setDismissed(true);
    } catch {
      /* ignore */
    }

    const onBip = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", onBip);
    if (isIos()) setShowIosHint(true);

    return () => window.removeEventListener("beforeinstallprompt", onBip);
  }, []);

  const dismiss = useCallback(() => {
    setDismissed(true);
    try {
      sessionStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
  }, []);

  const install = useCallback(async () => {
    if (!deferred) return;
    await deferred.prompt();
    setDeferred(null);
    dismiss();
  }, [deferred, dismiss]);

  if (isStandalone() || dismissed) return null;

  if (showIosHint && !deferred) {
    return (
      <div className="flex flex-wrap items-center justify-center gap-x-1.5 gap-y-1 border-b border-zinc-800/80 bg-zinc-950/95 px-4 pb-2.5 pt-[max(0.625rem,env(safe-area-inset-top))] text-center text-xs text-zinc-400">
        <span>Add McGBot to your home screen for the full-screen app: in Safari tap</span>
        <span className="inline-flex items-center gap-0.5 rounded border border-zinc-700 bg-zinc-900 px-1.5 py-0.5 font-semibold text-zinc-100">
          <IosShareGlyph className="h-3.5 w-3.5 shrink-0" />
          Share
        </span>
        <span aria-hidden>→</span>
        <strong className="text-zinc-200">Add to Home Screen</strong>
        <button type="button" className="ml-2 font-semibold text-cyan-400/90" onClick={dismiss}>
          Dismiss
        </button>
      </div>
    );
  }

  if (!deferred) return null;

  return (
    <div className="flex flex-wrap items-center justify-center gap-3 border-b border-cyan-500/20 bg-cyan-950/30 px-4 pb-2.5 pt-[max(0.625rem,env(safe-area-inset-top))] text-sm">
      <span className="text-zinc-300">Install McGBot for full-screen app access</span>
      <button
        type="button"
        className="rounded-md border border-cyan-500/40 bg-cyan-500/15 px-3 py-1.5 text-xs font-semibold text-cyan-100"
        onClick={() => void install()}
      >
        Install app
      </button>
      <button type="button" className="text-xs font-medium text-zinc-500" onClick={dismiss}>
        Not now
      </button>
    </div>
  );
}
