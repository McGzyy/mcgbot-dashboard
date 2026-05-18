"use client";

import { useSession } from "next-auth/react";
import { useEffect, useRef } from "react";

const FOCUS_DEBOUNCE_MS = 12_000;

/**
 * Refetch session when Discord/subscription gates look stuck (stale JWT).
 * Also helps users escape /membership after a transient false "not in guild" lock.
 */
export function SessionGateRecovery() {
  const { data: session, status, update } = useSession();
  const lastAtRef = useRef(0);
  const mountedRefreshRef = useRef(false);

  useEffect(() => {
    if (status !== "authenticated") return;

    const u = session?.user as {
      helpTier?: string;
      canModerate?: boolean;
      hasDashboardAccess?: boolean;
      discordInGuild?: boolean | null;
      discordNeedsVerification?: boolean;
      discordBlockedReason?: string | null;
      hasActiveSubscription?: boolean;
    };

    if (u.hasDashboardAccess === true) return;

    if (u.helpTier === "admin" || u.helpTier === "mod" || u.canModerate === true) return;

    const onMembershipFunnel =
      u.discordInGuild === true &&
      !u.discordNeedsVerification &&
      (u.discordBlockedReason === "unpaid_role" ||
        u.discordBlockedReason === "missing_required_role" ||
        !u.hasActiveSubscription);

    if (onMembershipFunnel) return;

    const needsRecovery =
      u.discordInGuild === false ||
      u.discordNeedsVerification === true ||
      u.discordInGuild == null;

    if (!needsRecovery) return;

    const bump = (force = false) => {
      const now = Date.now();
      if (!force && now - lastAtRef.current < FOCUS_DEBOUNCE_MS) return;
      lastAtRef.current = now;
      void update({ refreshAccess: true });
    };

    if (!mountedRefreshRef.current) {
      mountedRefreshRef.current = true;
      bump(true);
    }

    const onVis = () => {
      if (document.visibilityState === "visible") bump(false);
    };

    const onFocus = () => bump(false);
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [status, session?.user, update]);

  return null;
}
