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
      subscriptionExempt?: boolean;
      hasActiveSubscription?: boolean;
      discordInGuild?: boolean | null;
      discordNeedsVerification?: boolean;
      discordBlockedReason?: string | null;
    };

    const bump = (force = false) => {
      const now = Date.now();
      if (!force && now - lastAtRef.current < FOCUS_DEBOUNCE_MS) return;
      lastAtRef.current = now;
      void update({ refreshAccess: true });
    };

    const staffLike =
      u.helpTier === "admin" ||
      u.helpTier === "mod" ||
      u.canModerate === true ||
      u.subscriptionExempt === true;

    /** Session says unlocked but JWT may be stale — refresh so middleware on `/` sees updated claims. */
    if (
      u.hasDashboardAccess === true &&
      typeof window !== "undefined" &&
      window.location.pathname.startsWith("/membership")
    ) {
      bump(true);
      return;
    }

    /** Staff / exempt / subscribed on /membership while session flag is stale — refresh JWT before next navigation. */
    if (
      staffLike &&
      (u.hasActiveSubscription === true || u.subscriptionExempt === true || u.helpTier === "admin" || u.helpTier === "mod") &&
      typeof window !== "undefined" &&
      window.location.pathname.startsWith("/membership") &&
      u.hasDashboardAccess !== true
    ) {
      bump(true);
      return;
    }

    if (u.helpTier === "admin" || u.helpTier === "mod" || u.canModerate === true) return;

    if (u.hasDashboardAccess === true) return;

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
