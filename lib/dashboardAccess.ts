import { liveDashboardAccessForDiscordId } from "@/lib/dashboardGate";
import {
  isAwaitingMembershipRole,
  membershipAccessGateFromRoleIds,
} from "@/lib/discordMembershipRoles";
import { resolveHelpTier } from "@/lib/helpRole";
import {
  discordIdFromTokenFields,
  isProtectedFromGuildFalsePositive,
  isStaffFromToken,
  subscriptionActiveFromToken,
} from "@/lib/tokenDashboardGate";

export type DiscordGateStatus = "ok" | "needs_verification" | "not_in_guild";

/** Discord guild + human-verification gate from JWT claims (Edge-safe, no I/O). */
export function discordGateStatusFromToken(
  token: Record<string, unknown> | null
): DiscordGateStatus {
  if (!token) return "not_in_guild";

  const discordId = discordIdFromTokenFields(token);
  const staffBypass = isStaffFromToken(token, discordId);
  const inGuild = (token as { discordInGuild?: unknown }).discordInGuild;

  if (
    inGuild === false &&
    !staffBypass &&
    !isProtectedFromGuildFalsePositive(token, discordId)
  ) {
    return "not_in_guild";
  }

  const needsVerification =
    (token as { discordNeedsVerification?: unknown }).discordNeedsVerification === true;
  const blockedReason = (token as { discordBlockedReason?: unknown }).discordBlockedReason;

  if (needsVerification && !staffBypass) {
    const reason = typeof blockedReason === "string" ? blockedReason : null;
    if (isAwaitingMembershipRole(reason)) return "ok";
    return "needs_verification";
  }

  return "ok";
}

/** Paid / staff / exempt / Discord paid-role claims in the JWT (no network). */
export function jwtGrantsDashboardAccess(token: Record<string, unknown> | null): boolean {
  if (!token) return false;
  if (isStaffFromToken(token)) return true;
  if (token.subscriptionExempt === true) return true;
  if (subscriptionActiveFromToken(token)) return true;

  const roleIds = (token as { discordGuildRoleIds?: unknown }).discordGuildRoleIds;
  if (Array.isArray(roleIds)) {
    const gate = membershipAccessGateFromRoleIds(roleIds);
    if (gate?.ok === true) return true;
  }

  return false;
}

/** Last-known JWT entitlement — used to fail open when live checks flake. */
export function jwtGraceEntitlement(
  token: Record<string, unknown>,
  discordId: string
): boolean {
  if (jwtGrantsDashboardAccess(token)) return true;
  if (isProtectedFromGuildFalsePositive(token, discordId)) return true;
  const envTier = resolveHelpTier(discordId);
  return envTier === "admin" || envTier === "mod";
}

/**
 * Server-side dashboard access (middleware + API). Trusts JWT first, then live Discord/Supabase.
 * Fail open on live-check errors when JWT/env still show entitlement.
 */
export async function resolveDashboardAccessForToken(
  token: Record<string, unknown> | null
): Promise<boolean> {
  if (!token) return false;
  if (jwtGrantsDashboardAccess(token)) return true;

  const id = discordIdFromTokenFields(token);
  const gate = discordGateStatusFromToken(token);

  if (gate === "needs_verification") {
    if (isStaffFromToken(token, id)) return true;
    return jwtGrantsDashboardAccess(token);
  }

  if (gate === "not_in_guild") {
    if (isProtectedFromGuildFalsePositive(token, id) || isStaffFromToken(token, id)) {
      // Fall through — protected members may keep discordInGuild=false during API flakes.
    } else if (!id) {
      return false;
    } else {
      try {
        if (await liveDashboardAccessForDiscordId(id)) return true;
      } catch (e) {
        console.warn("[dashboardAccess] live access (not_in_guild):", e);
      }
      return jwtGraceEntitlement(token, id);
    }
  }

  if (!id) return false;

  const envTier = resolveHelpTier(id);
  if (envTier === "admin" || envTier === "mod") return true;

  const jwtGrace = jwtGraceEntitlement(token, id);

  try {
    if (await liveDashboardAccessForDiscordId(id)) return true;
    return jwtGrace;
  } catch (e) {
    console.warn("[dashboardAccess] live check failed, retry once:", e);
    try {
      await new Promise((r) => setTimeout(r, 150));
      if (await liveDashboardAccessForDiscordId(id)) return true;
      return jwtGrace;
    } catch {
      return jwtGrace;
    }
  }
}

/** Session `user.hasDashboardAccess` — same rules as middleware, plus TOTP + guild UX fields. */
export function computeSessionHasDashboardAccess(args: {
  token: Record<string, unknown>;
  discordId: string;
  hasActiveSubscription: boolean;
  exempt: boolean;
  totpSatisfied: boolean;
  effectiveNeedsVerification: boolean;
}): boolean {
  const { token, discordId, hasActiveSubscription, exempt, totpSatisfied, effectiveNeedsVerification } =
    args;

  const staffBypass = isStaffFromToken(token, discordId);
  const protectedMember = isProtectedFromGuildFalsePositive(token, discordId);
  const guildAllowsDashboard =
    staffBypass ||
    protectedMember ||
    (token as { discordInGuild?: unknown }).discordInGuild !== false;

  const roleIds = (token as { discordGuildRoleIds?: unknown }).discordGuildRoleIds;
  const discordRoleGrantsAccess =
    Array.isArray(roleIds) && membershipAccessGateFromRoleIds(roleIds)?.ok === true;

  return (
    guildAllowsDashboard &&
    !effectiveNeedsVerification &&
    totpSatisfied &&
    (staffBypass || exempt || hasActiveSubscription || discordRoleGrantsAccess)
  );
}

export type DashboardAccessState = "loading" | "granted" | "denied";

/** Client-side: only treat access as denied after session has loaded. */
export function dashboardAccessStateFromSession(
  status: "loading" | "authenticated" | "unauthenticated",
  user:
    | {
        hasDashboardAccess?: boolean;
        subscriptionExempt?: boolean;
        helpTier?: string;
        canModerate?: boolean;
        discordInGuild?: boolean | null;
      }
    | undefined
): DashboardAccessState {
  if (status === "loading") return "loading";
  if (status !== "authenticated" || !user) return "denied";

  if (user.hasDashboardAccess === true) return "granted";
  if (user.subscriptionExempt === true) return "granted";
  if (user.helpTier === "admin" || user.helpTier === "mod" || user.canModerate === true) {
    return "granted";
  }

  if (user.discordInGuild === null || user.discordInGuild === undefined) return "loading";

  return "denied";
}
