import { resolveHelpTierAsync } from "@/lib/helpRole";
import { computeSubscriptionExempt } from "@/lib/subscriptionExemption";
import {
  getPlanById,
  getSubscriptionEnd,
  planProductTier,
} from "@/lib/subscription/subscriptionDb";
import {
  normalizeProductTier,
  tierIncludesProFeatures,
  type ProductTier,
} from "@/lib/subscription/planTiers";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

type CacheEntry = { tier: ProductTier; exp: number };
const tierCache = new Map<string, CacheEntry>();
const CACHE_MS = 90_000;

function subscriptionActiveUntil(end: string | null): boolean {
  if (!end) return false;
  const t = new Date(end).getTime();
  return Number.isFinite(t) && t > Date.now();
}

export function invalidateUserProductTierCache(discordId: string): void {
  const id = discordId.trim();
  if (id) tierCache.delete(id);
}

/** Staff, exempt list, and active Pro plan → pro; active Basic plan → basic; else basic. */
export async function resolveUserProductTier(discordId: string): Promise<ProductTier> {
  const id = discordId.trim();
  if (!id) return "basic";

  const now = Date.now();
  const hit = tierCache.get(id);
  if (hit && hit.exp > now) return hit.tier;

  const helpTier = await resolveHelpTierAsync(id).catch(() => "user");
  if (helpTier === "admin" || helpTier === "mod") {
    tierCache.set(id, { tier: "pro", exp: now + CACHE_MS });
    return "pro";
  }

  const exempt = await computeSubscriptionExempt(id).catch(() => false);
  if (exempt) {
    tierCache.set(id, { tier: "pro", exp: now + CACHE_MS });
    return "pro";
  }

  const end = await getSubscriptionEnd(id);
  if (!subscriptionActiveUntil(end)) {
    tierCache.set(id, { tier: "basic", exp: now + CACHE_MS });
    return "basic";
  }

  const db = getSupabaseAdmin();
  if (!db) {
    tierCache.set(id, { tier: "basic", exp: now + CACHE_MS });
    return "basic";
  }

  const { data: sub, error } = await db
    .from("subscriptions")
    .select("plan_id")
    .eq("discord_id", id)
    .maybeSingle();

  if (error || !sub?.plan_id) {
    tierCache.set(id, { tier: "basic", exp: now + CACHE_MS });
    return "basic";
  }

  const plan = await getPlanById(String(sub.plan_id));
  const tier = plan ? planProductTier(plan) : normalizeProductTier(null);
  tierCache.set(id, { tier, exp: now + CACHE_MS });
  return tier;
}

export async function userHasProFeatures(discordId: string): Promise<boolean> {
  const tier = await resolveUserProductTier(discordId);
  return tierIncludesProFeatures(tier);
}

export type ProGateFail = {
  ok: false;
  response: Response;
};

export type ProGateOk = { ok: true; tier: ProductTier };

export async function requireProFeatures(discordId: string): Promise<ProGateOk | ProGateFail> {
  const tier = await resolveUserProductTier(discordId);
  if (tierIncludesProFeatures(tier)) {
    return { ok: true, tier };
  }
  return {
    ok: false,
    response: Response.json(
      {
        success: false,
        code: "pro_required",
        error: "This feature requires a Pro membership. Upgrade on the membership page.",
        productTier: tier,
      },
      { status: 403 }
    ),
  };
}
