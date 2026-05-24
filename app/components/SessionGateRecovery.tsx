"use client";

import { membershipUrlAllowsEntitledStay, peekMembershipWelcome } from "@/lib/membershipActivation";
import { useSession } from "next-auth/react";
import { useEffect, useRef } from "react";

const FOCUS_DEBOUNCE_MS = 12_000;

/**
 * Refetch session when Discord/subscription gates look stuck (stale JWT).
 * Also helps entitled users leave /membership once after OAuth (without refresh loops).
 */
export function SessionGateRecovery() {
  const { data: session, status, update } = useSession();
  const lastAtRef = useRef(0);
  const mountedRefreshRef = useRef(false);
  const membershipEscapeStartedRef = useRef(false);

  useEffect(() => {
    if (status !== "authenticated") return;
    if (typeof window === "undefined") return;

    const pathname = window.location.pathname;
    if (!pathname.startsWith("/membership")) {
      membershipEscapeStartedRef.current = false;
    }

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

    /** Entitled users should not linger on /membership — refresh JWT once, then hard-nav to `/`. */
    if (
      u.hasDashboardAccess === true &&
      pathname.startsWith("/membership") &&
      !membershipEscapeStartedRef.current
    ) {
      if (peekMembershipWelcome()) return;
      if (membershipUrlAllowsEntitledStay(window.location.search)) return;

      membershipEscapeStartedRef.current = true;
      void (async () => {
        try {
          await update({ refreshAccess: true });
        } catch {
          /* still navigate — middleware may have a fresh enough JWT */
        }
        window.location.replace("/");
      })();
      return;
    }

    /** Staff / exempt / subscribed on /membership while session flag is stale — one refresh per mount. */
    if (
      staffLike &&
      (u.hasActiveSubscription === true ||
        u.subscriptionExempt === true ||
        u.helpTier === "admin" ||
        u.helpTier === "mod") &&
      pathname.startsWith("/membership") &&
      u.hasDashboardAccess !== true &&
      !mountedRefreshRef.current
    ) {
      mountedRefreshRef.current = true;
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
