"use client";

import { useSession } from "next-auth/react";
import { useEffect, useRef } from "react";

const DEBOUNCE_MS = 20_000;

/**
 * Refetch session on focus when Discord/subscription gates look stuck.
 * Skips the membership funnel (verified in Discord, no paid sub yet) to avoid
 * hammering Discord and flipping verification state on every tab focus.
 */
export function SessionGateRecovery() {
  const { data: session, status, update } = useSession();
  const lastAtRef = useRef(0);

  useEffect(() => {
    if (status !== "authenticated") return;
    if (session?.user?.hasDashboardAccess === true) return;

    const u = session.user as {
      discordInGuild?: boolean | null;
      discordNeedsVerification?: boolean;
      discordBlockedReason?: string | null;
      hasActiveSubscription?: boolean;
    };

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
  }, [status, session?.user, update]);

  return null;
}
