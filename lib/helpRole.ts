import { staffTierFromDiscord } from "@/lib/discordStaffTier";

/** Dashboard help / doc tier (maps to Discord env lists until Supabase `users.role`). */
export type HelpTier = "user" | "mod" | "admin";

export type HelpTierSource = "development_override" | "discord_guild" | "env_allowlist";

const tierAsyncCache = new Map<string, { tier: HelpTier; source: HelpTierSource; exp: number }>();
const TIER_ASYNC_CACHE_MS = 45_000;

function idSet(raw: string | undefined): Set<string> {
  if (!raw?.trim()) return new Set();
  return new Set(
    raw
      .split(/[\s,]+/)
      .map((s) => s.trim())
      .filter(Boolean)
  );
}

/**
 * - `DISCORD_ADMIN_IDS` → admin
 * - `DISCORD_MOD_IDS` → mod (if not admin)
 * - `GUIDE_ROLE_OVERRIDE` / `HELP_ROLE_OVERRIDE` — only in development
 */
export function resolveHelpTier(discordUserId: string): HelpTier {
  if (process.env.NODE_ENV === "development") {
    const o =
      process.env.HELP_ROLE_OVERRIDE?.trim().toLowerCase() ??
      process.env.GUIDE_ROLE_OVERRIDE?.trim().toLowerCase();
    if (o === "admin" || o === "mod" || o === "user") {
      return o as HelpTier;
    }
  }

  const admins = idSet(process.env.DISCORD_ADMIN_IDS);
  const mods = idSet(process.env.DISCORD_MOD_IDS);
  if (admins.has(discordUserId)) return "admin";
  if (mods.has(discordUserId)) return "mod";
  return "user";
}

/**
 * Same as {@link resolveHelpTier} but prefers live Discord guild roles when
 * `DISCORD_GUILD_ID` + `DISCORD_BOT_TOKEN` (or `DISCORD_TOKEN`) are set.
 * Falls back to env id lists only if Discord is not configured or the API call fails.
 */
export async function resolveHelpTierAsync(discordUserId: string): Promise<HelpTier> {
  const { tier } = await resolveHelpTierWithSource(discordUserId);
  return tier;
}

export async function resolveHelpTierWithSource(
  discordUserId: string
): Promise<{ tier: HelpTier; source: HelpTierSource }> {
  const id = discordUserId.trim();
  if (!id) return { tier: "user", source: "env_allowlist" };

  if (process.env.NODE_ENV === "development") {
    const o =
      process.env.HELP_ROLE_OVERRIDE?.trim().toLowerCase() ??
      process.env.GUIDE_ROLE_OVERRIDE?.trim().toLowerCase();
    if (o === "admin" || o === "mod" || o === "user") {
      return { tier: o as HelpTier, source: "development_override" };
    }
  }

  const now = Date.now();
  const hit = tierAsyncCache.get(id);
  if (hit && hit.exp > now) {
    return { tier: hit.tier, source: hit.source };
  }

  const fromDiscord = await staffTierFromDiscord(id);
  let tier: HelpTier;
  let source: HelpTierSource;
  if (fromDiscord !== null) {
    tier = fromDiscord;
    source = "discord_guild";
  } else {
    tier = resolveHelpTier(id);
    source = "env_allowlist";
  }

  tierAsyncCache.set(id, { tier, source, exp: now + TIER_ASYNC_CACHE_MS });
  return { tier, source };
}

export type HelpDocSlug = "caller" | "moderator" | "admin";

export function isHelpDocSlug(s: string): s is HelpDocSlug {
  return s === "caller" || s === "moderator" || s === "admin";
}

/** Whether the signed-in tier may open this doc. */
export function canViewHelpDoc(tier: HelpTier, slug: HelpDocSlug): boolean {
  if (slug === "caller") return true;
  if (slug === "moderator") return tier === "mod" || tier === "admin";
  return tier === "admin";
}

/**
 * Gate for `/moderation` APIs. Set `MODERATION_MIN_TIER=admin` to require Discord admin (or env
 * admin id list) only; default `mod` allows both mod and admin.
 */
export function meetsModerationMinTier(tier: HelpTier): boolean {
  const min = (process.env.MODERATION_MIN_TIER ?? "mod").trim().toLowerCase();
  if (min === "admin") return tier === "admin";
  return tier === "mod" || tier === "admin";
}
