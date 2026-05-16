import { getDiscordGuildMemberRoleIds } from "@/lib/discordGuildMember";
import { membershipAccessGateFromRoleIds, membershipRolesConfigured } from "@/lib/discordMembershipRoles";
import { resolveHelpTierAsync } from "@/lib/helpRole";
import { computeSubscriptionExempt } from "@/lib/subscriptionExemption";
import { getSubscriptionEnd } from "@/lib/subscription/subscriptionDb";

type CacheEntry = { ok: boolean; exp: number };

const accessCache = new Map<string, CacheEntry>();
const CACHE_MS = 90_000;

function subscriptionActiveUntil(end: string | null): boolean {
  if (!end) return false;
  const t = new Date(end).getTime();
  return Number.isFinite(t) && t > Date.now();
}

async function resolveHelpTierWithRetry(discordId: string): Promise<{ tier: string; failed: boolean }> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const tier = await resolveHelpTierAsync(discordId);
      return { tier, failed: false };
    } catch (e) {
      console.warn(`[dashboardGate] resolveHelpTierAsync (attempt ${attempt + 1}):`, e);
      if (attempt === 0) {
        await new Promise((r) => setTimeout(r, 120));
      }
    }
  }
  return { tier: "user", failed: true };
}

async function computeExemptWithRetry(discordId: string): Promise<{ exempt: boolean; failed: boolean }> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const exempt = await computeSubscriptionExempt(discordId);
      return { exempt, failed: false };
    } catch (e) {
      console.warn(`[dashboardGate] computeSubscriptionExempt (attempt ${attempt + 1}):`, e);
      if (attempt === 0) {
        await new Promise((r) => setTimeout(r, 120));
      }
    }
  }
  return { exempt: false, failed: true };
}

async function getSubscriptionEndWithRetry(
  discordId: string
): Promise<{ end: string | null; failed: boolean }> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const end = await getSubscriptionEnd(discordId);
      return { end, failed: false };
    } catch (e) {
      console.warn(`[dashboardGate] getSubscriptionEnd (attempt ${attempt + 1}):`, e);
      if (attempt === 0) {
        await new Promise((r) => setTimeout(r, 120));
      }
    }
  }
  return { end: null, failed: true };
}

async function discordRoleAllowsDashboard(discordId: string): Promise<boolean | null> {
  if (!membershipRolesConfigured()) return null;
  try {
    const roleIds = await getDiscordGuildMemberRoleIds(discordId);
    if (!Array.isArray(roleIds)) return null;
    const gate = membershipAccessGateFromRoleIds(roleIds);
    if (gate === null) return null;
    return gate.ok;
  } catch (e) {
    console.warn("[dashboardGate] discord role gate:", e);
    return null;
  }
}

/**
 * Live check (Discord staff + Supabase subscription + membership roles). Used when JWT cookie is stale.
 * Cached briefly to avoid hammering Discord/Supabase on every navigation.
 *
 * Does not cache a **deny** when upstream calls failed (avoids locking paying users out for CACHE_MS).
 */
export async function liveDashboardAccessForDiscordId(discordId: string): Promise<boolean> {
  const id = discordId.trim();
  if (!id) return false;

  const now = Date.now();
  const hit = accessCache.get(id);
  if (hit && hit.exp > now) {
    return hit.ok;
  }

  const { tier, failed: tierFailed } = await resolveHelpTierWithRetry(id);
  if (!tierFailed && (tier === "admin" || tier === "mod")) {
    accessCache.set(id, { ok: true, exp: now + CACHE_MS });
    return true;
  }

  const { exempt, failed: exemptFailed } = await computeExemptWithRetry(id);
  if (exempt === true) {
    accessCache.set(id, { ok: true, exp: now + CACHE_MS });
    return true;
  }

  const roleOk = await discordRoleAllowsDashboard(id);
  if (roleOk === false) {
    accessCache.set(id, { ok: false, exp: now + CACHE_MS });
    return false;
  }

  const { end, failed: subFailed } = await getSubscriptionEndWithRetry(id);
  const ok = subscriptionActiveUntil(end);

  const uncertainDeny = !ok && (tierFailed || exemptFailed || subFailed);
  if (!uncertainDeny) {
    accessCache.set(id, { ok, exp: now + CACHE_MS });
  }
  return ok;
}

/** Call after admin changes subscription bypass list so the next request re-evaluates access. */
export function invalidateLiveDashboardAccessCache(discordId: string): void {
  const id = discordId.trim();
  if (!id) return;
  accessCache.delete(id);
}
