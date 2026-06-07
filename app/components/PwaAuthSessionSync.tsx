"use client";

import { isStandalonePwa } from "@/lib/discordSignIn";
import { useSession } from "next-auth/react";
import { useEffect, useRef } from "react";

const RESYNC_DEBOUNCE_MS = 2_000;

/**
 * Installed PWA: refetch session when the app becomes visible again (e.g. after OAuth in Safari).
 */
export function PwaAuthSessionSync() {
  const { status, update } = useSession();
  const lastAtRef = useRef(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!isStandalonePwa()) return;

    const resync = () => {
      if (document.visibilityState !== "visible") return;
      const now = Date.now();
      if (now - lastAtRef.current < RESYNC_DEBOUNCE_MS) return;
      lastAtRef.current = now;
      void update();
    };

    document.addEventListener("visibilitychange", resync);
    window.addEventListener("pageshow", resync);
    window.addEventListener("focus", resync);
    return () => {
      document.removeEventListener("visibilitychange", resync);
      window.removeEventListener("pageshow", resync);
      window.removeEventListener("focus", resync);
    };
  }, [status, update]);

  return null;
}
