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

  const [exempt, end] = await Promise.all([
    computeSubscriptionExempt(id),
    getSubscriptionEnd(id),
  ]);
  const ok = exempt === true || subscriptionActiveUntil(end);
  accessCache.set(id, { ok, exp: now + CACHE_MS });
  return ok;
}
