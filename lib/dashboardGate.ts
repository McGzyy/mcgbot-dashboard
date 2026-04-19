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

/**
 * Live check (Discord staff + Supabase subscription). Used when JWT cookie is stale.
 * Cached briefly to avoid hammering Discord/Supabase on every navigation.
 */
export async function liveDashboardAccessForDiscordId(discordId: string): Promise<boolean> {
  const id = discordId.trim();
  if (!id) return false;

  const now = Date.now();
  const hit = accessCache.get(id);
  if (hit && hit.exp > now) {
    return hit.ok;
  }

  let exempt = false;
  try {
    exempt = await computeSubscriptionExempt(id);
  } catch (e) {
    console.warn("[dashboardGate] computeSubscriptionExempt:", e);
  }
  if (exempt === true) {
    accessCache.set(id, { ok: true, exp: now + CACHE_MS });
    return true;
  }

  let end: string | null = null;
  try {
    end = await getSubscriptionEnd(id);
  } catch (e) {
    console.warn("[dashboardGate] getSubscriptionEnd:", e);
  }
  const ok = subscriptionActiveUntil(end);
  accessCache.set(id, { ok, exp: now + CACHE_MS });
  return ok;
}
