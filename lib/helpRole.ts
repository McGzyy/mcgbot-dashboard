/** Dashboard help / doc tier (maps to Discord env lists until Supabase `users.role`). */
export type HelpTier = "user" | "mod" | "admin";

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
