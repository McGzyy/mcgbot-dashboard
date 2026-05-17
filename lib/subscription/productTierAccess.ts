import { resolveHelpTierAsync } from "@/lib/helpRole";
import { computeSubscriptionExempt } from "@/lib/subscriptionExemption";
import {
  getPlanById,
  getSubscriptionEnd,
  planProductTier,
} from "@/lib/subscription/subscriptionDb";
import {
  BASIC_OUTSIDE_CALLS_PER_DAY,
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

/** Start of current UTC calendar day (ISO). */
export function utcDayStartIso(): string {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())).toISOString();
}

export type OutsideCallsAccess = {
  tier: ProductTier;
  unlimited: boolean;
  dailyLimit: number | null;
  dayStartIso: string;
};

/** Active subscription (or staff/exempt) required; Basic is capped per UTC day. */
export async function resolveOutsideCallsAccess(
  discordId: string
): Promise<OutsideCallsAccess | null> {
  const id = discordId.trim();
  if (!id) return null;

  const helpTier = await resolveHelpTierAsync(id).catch(() => "user");
  if (helpTier === "admin" || helpTier === "mod") {
    return {
      tier: "pro",
      unlimited: true,
      dailyLimit: null,
      dayStartIso: utcDayStartIso(),
    };
  }

  const exempt = await computeSubscriptionExempt(id).catch(() => false);
  if (exempt) {
    return {
      tier: "pro",
      unlimited: true,
      dailyLimit: null,
      dayStartIso: utcDayStartIso(),
    };
  }

  const end = await getSubscriptionEnd(id);
  if (!subscriptionActiveUntil(end)) return null;

  const tier = await resolveUserProductTier(id);
  const unlimited = tierIncludesProFeatures(tier);
  return {
    tier,
    unlimited,
    dailyLimit: unlimited ? null : BASIC_OUTSIDE_CALLS_PER_DAY,
    dayStartIso: utcDayStartIso(),
  };
}

export type OutsideCallsGateFail = {
  ok: false;
  response: Response;
};

export type OutsideCallsGateOk = { ok: true; access: OutsideCallsAccess };

export async function requireOutsideCallsAccess(
  discordId: string
): Promise<OutsideCallsGateOk | OutsideCallsGateFail> {
  const access = await resolveOutsideCallsAccess(discordId);
  if (!access) {
    return {
      ok: false,
      response: Response.json(
        {
          success: false,
          code: "membership_required",
          error: "An active membership is required for Outside Calls.",
        },
        { status: 403 }
      ),
    };
  }
  return { ok: true, access };
}

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
