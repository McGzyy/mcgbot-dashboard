"use client";

import { useSession } from "next-auth/react";
import { useEffect, useRef } from "react";

const DEBOUNCE_MS = 20_000;

/**
 * If the JWT briefly marks the user as not-in-guild or subscription fields lag reality,
 * refetching session on focus/visibility helps recover without signing out (pairs with
 * `refreshAccess` handling in `lib/auth.ts` jwt callback).
 */
export function SessionGateRecovery() {
  const { data: session, status, update } = useSession();
  const lastAtRef = useRef(0);

  useEffect(() => {
    if (status !== "authenticated") return;
    if (session?.user?.hasDashboardAccess === true) return;

    const bump = () => {
      const now = Date.now();
      if (now - lastAtRef.current < DEBOUNCE_MS) return;
      lastAtRef.current = now;
      void update({ refreshAccess: true });
    };

    const onVis = () => {
      if (document.visibilityState === "visible") bump();
    };

    window.addEventListener("focus", bump);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("focus", bump);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [status, session?.user?.hasDashboardAccess, update]);

  return null;
}
