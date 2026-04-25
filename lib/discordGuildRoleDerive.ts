import type { HelpTier } from "@/lib/helpRole";
import { resolveHelpTier } from "@/lib/helpRole";

export type DiscordGuildRoleRow = {
  id: string;
  name: string;
  color: number;
  position: number;
};

function idSet(raw: string | undefined): Set<string> {
  if (!raw?.trim()) return new Set();
  return new Set(
    raw
      .split(/[\s,]+/)
      .map((s) => s.trim())
      .filter(Boolean)
  );
}

function nameSet(raw: string | undefined): Set<string> {
  if (!raw?.trim()) return new Set();
  return new Set(
    raw
      .split(/[,|]+/)
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)
  );
}

function discordColorToHex(color: number): string | undefined {
  const n = Number(color);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  const rgb = n & 0xffffff;
  return `#${rgb.toString(16).padStart(6, "0")}`;
}

/**
 * Pick the accent color Discord would show for a member name: the highest-position role that has
 * a non-default color. (Approximation of Discord's hoist/color rules for display names.)
 */
export function pickMemberRoleAccentHex(
  memberRoleIds: readonly string[],
  roles: readonly DiscordGuildRoleRow[]
): string | undefined {
  if (!memberRoleIds.length || !roles.length) return undefined;
  const byId = new Map(roles.map((r) => [r.id, r] as const));
  const candidates: DiscordGuildRoleRow[] = [];
  for (const rid of memberRoleIds) {
    const r = byId.get(rid);
    if (!r) continue;
    if (r.color > 0) candidates.push(r);
  }
  if (!candidates.length) return undefined;
  candidates.sort((a, b) => b.position - a.position);
  return discordColorToHex(candidates[0]!.color);
}

/**
 * Resolve staff tier from a member's role id list using the same precedence as
 * `staffTierFromDiscord`, but without per-user HTTP calls.
 */
export function helpTierFromMemberRoleIds(
  memberRoleIds: readonly string[],
  roles: readonly DiscordGuildRoleRow[]
): HelpTier {
  const adminIds = idSet(process.env.DISCORD_ADMIN_ROLE_IDS);
  const modIds = idSet(process.env.DISCORD_MOD_ROLE_IDS);

  if (adminIds.size > 0 || modIds.size > 0) {
    if (memberRoleIds.some((id) => adminIds.has(id))) return "admin";
    if (memberRoleIds.some((id) => modIds.has(id))) return "mod";
    return "user";
  }

  const nameById = new Map(roles.map((r) => [r.id, r.name] as const));
  const adminNames = nameSet(process.env.DISCORD_ADMIN_ROLE_NAMES ?? "ADMIN");
  const modNames = nameSet(process.env.DISCORD_MOD_ROLE_NAMES ?? "MOD");

  let isAdmin = false;
  let isMod = false;
  for (const rid of memberRoleIds) {
    const nm = (nameById.get(rid) ?? "").trim().toLowerCase();
    if (nm && adminNames.has(nm)) isAdmin = true;
    if (nm && modNames.has(nm)) isMod = true;
  }
  if (isAdmin) return "admin";
  if (isMod) return "mod";
  return "user";
}

export function mergeHelpTierWithEnv(discordUserId: string, fromRoles: HelpTier): HelpTier {
  const env = resolveHelpTier(discordUserId);
  const rank = (t: HelpTier) => (t === "admin" ? 2 : t === "mod" ? 1 : 0);
  return rank(env) >= rank(fromRoles) ? env : fromRoles;
}
