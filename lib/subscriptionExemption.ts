import { getDiscordGuildMemberRoleIds } from "@/lib/discordGuildMember";
import {
  meetsModerationMinTier,
  resolveHelpTier,
  resolveHelpTierWithSource,
} from "@/lib/helpRole";
import { isDiscordIdInExemptAllowlist } from "@/lib/subscription/exemptAllowlistDb";

function idSet(raw: string | undefined): Set<string> {
  if (!raw?.trim()) return new Set();
  return new Set(
    raw
      .split(/[\s,]+/)
      .map((s) => s.trim())
      .filter(Boolean)
  );
}

function staffExemptionEnabled(): boolean {
  const v = (process.env.SUBSCRIPTION_EXEMPT_STAFF ?? "").trim().toLowerCase();
  if (v === "0" || v === "false" || v === "no" || v === "off") return false;
  if (v === "1" || v === "true" || v === "yes" || v === "on") return true;
  return true;
}

function exemptByExplicitUserIds(discordUserId: string): boolean {
  return idSet(process.env.SUBSCRIPTION_EXEMPT_DISCORD_IDS).has(discordUserId.trim());
}

function subscriptionExemptRoleIdSet(): Set<string> {
  const a = idSet(process.env.SUBSCRIPTION_EXEMPT_DISCORD_ROLE_IDS);
  const b = idSet(process.env.SUBSCRIPTION_EXEMPT_ROLE_IDS);
  return new Set([...a, ...b]);
}

async function exemptByExplicitRoleIds(discordUserId: string): Promise<boolean> {
  const wanted = subscriptionExemptRoleIdSet();
  if (wanted.size === 0) return false;
  const memberRoles = await getDiscordGuildMemberRoleIds(discordUserId);
  if (memberRoles == null) return false;
  return memberRoles.some((r) => wanted.has(r));
}

async function exemptByStaffTier(discordUserId: string): Promise<boolean> {
  if (!staffExemptionEnabled()) return false;
  const { tier } = await resolveHelpTierWithSource(discordUserId);
  return meetsModerationMinTier(tier);
}

/**
 * Users matching any rule bypass subscription middleware / API gating.
 *
 * - SUBSCRIPTION_EXEMPT_DISCORD_IDS — comma-separated Discord user snowflakes
 * - `subscription_exempt_allowlist` (Supabase) — same effect; managed from the dashboard admin panel
 * - SUBSCRIPTION_EXEMPT_DISCORD_ROLE_IDS — comma-separated role ids (member must have one)
 * - SUBSCRIPTION_EXEMPT_ROLE_IDS — same as above (shorter alias; merged with DISCORD list)
 * - SUBSCRIPTION_EXEMPT_STAFF — default on: dashboard mod/admin (same tier as moderation) is exempt.
 *   Set to 0 / false / off to disable staff auto-exemption.
 */
/**
 * Env-only staff (DISCORD_ADMIN_IDS / DISCORD_MOD_IDS) — no Discord API.
 * Edge-safe and avoids a failed network call blocking admins listed in env.
 */
function exemptByEnvStaffListsSync(discordUserId: string): boolean {
  if (!staffExemptionEnabled()) return false;
  return meetsModerationMinTier(resolveHelpTier(discordUserId));
}

export async function computeSubscriptionExempt(discordUserId: string): Promise<boolean> {
  const id = discordUserId.trim();
  if (!id) return false;
  if (exemptByExplicitUserIds(id)) return true;
  if (await isDiscordIdInExemptAllowlist(id)) return true;
  if (exemptByEnvStaffListsSync(id)) return true;
  if (await exemptByExplicitRoleIds(id)) return true;
  if (await exemptByStaffTier(id)) return true;
  return false;
}
