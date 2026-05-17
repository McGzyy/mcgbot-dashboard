import { BASIC_DAILY_CALLS_LIMIT, tierIncludesProFeatures } from "@/lib/subscription/planTiers";
import { resolveUserProductTier, utcDayStartIso } from "@/lib/subscription/productTierAccess";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export type DeskCallQuota = {
  tier: "basic" | "pro";
  unlimited: boolean;
  dailyLimit: number | null;
  usedToday: number;
  remaining: number | null;
  dayStartIso: string;
};

/** Count user desk calls (`call_performance.source = user`) since UTC midnight. */
export async function countUserDeskCallsToday(discordId: string): Promise<number> {
  const id = discordId.trim();
  if (!id) return 0;

  const db = getSupabaseAdmin();
  if (!db) return 0;

  const dayStart = utcDayStartIso();
  const { count, error } = await db
    .from("call_performance")
    .select("id", { count: "exact", head: true })
    .eq("discord_id", id)
    .eq("source", "user")
    .gte("call_time", dayStart);

  if (error) {
    console.warn("[deskCallLimits] count:", error.message);
    return 0;
  }
  return typeof count === "number" && count >= 0 ? count : 0;
}

export async function resolveDeskCallQuota(discordId: string): Promise<DeskCallQuota> {
  const tier = await resolveUserProductTier(discordId);
  const unlimited = tierIncludesProFeatures(tier);
  const usedToday = await countUserDeskCallsToday(discordId);
  const dayStartIso = utcDayStartIso();

  if (unlimited) {
    return {
      tier,
      unlimited: true,
      dailyLimit: null,
      usedToday,
      remaining: null,
      dayStartIso,
    };
  }

  const dailyLimit = BASIC_DAILY_CALLS_LIMIT;
  return {
    tier,
    unlimited: false,
    dailyLimit,
    usedToday,
    remaining: Math.max(0, dailyLimit - usedToday),
    dayStartIso,
  };
}

export type DeskCallLimitFail = {
  ok: false;
  response: Response;
  quota: DeskCallQuota;
};

export type DeskCallLimitOk = { ok: true; quota: DeskCallQuota };

export async function requireDeskCallAllowance(
  discordId: string
): Promise<DeskCallLimitOk | DeskCallLimitFail> {
  const quota = await resolveDeskCallQuota(discordId);
  if (quota.unlimited || (quota.remaining != null && quota.remaining > 0)) {
    return { ok: true, quota };
  }
  return {
    ok: false,
    quota,
    response: Response.json(
      {
        success: false,
        code: "daily_call_limit",
        error: `Basic membership includes ${quota.dailyLimit} desk calls per UTC day. Upgrade to Pro for unlimited calls.`,
        deskCallQuota: quota,
      },
      { status: 429 }
    ),
  };
}
