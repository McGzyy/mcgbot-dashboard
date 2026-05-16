import { getDiscordGuildMemberRoleIds } from "@/lib/discordGuildMember";
import { computeSubscriptionExempt } from "@/lib/subscriptionExemption";
import { resolveUserProductTier } from "@/lib/subscription/productTierAccess";
import { getSubscriptionEnd } from "@/lib/subscription/subscriptionDb";
import type { ProductTier } from "@/lib/subscription/planTiers";

function parseIdSet(raw: string | undefined): Set<string> {
  if (!raw?.trim()) return new Set();
  return new Set(
    raw
      .split(/[\s,]+/)
      .map((s) => s.trim())
      .filter(Boolean)
  );
}

function parseSingleId(raw: string | undefined): string {
  return typeof raw === "string" ? raw.trim() : "";
}

export type MembershipRoleConfig = {
  guildId: string;
  botToken: string;
  unverifiedIds: Set<string>;
  unpaidId: string;
  trencherId: string;
  proId: string;
};

/** Resolved Discord role snowflakes for the membership ladder. */
export function readMembershipRoleConfig(): MembershipRoleConfig | null {
  const guildId = (process.env.DISCORD_GUILD_ID ?? "").trim();
  const botToken = (process.env.DISCORD_BOT_TOKEN ?? process.env.DISCORD_TOKEN ?? "").trim();
  if (!guildId || !botToken) return null;

  const unverifiedIds = parseIdSet(process.env.DISCORD_UNVERIFIED_ROLE_IDS);
  const singularUnverified = parseSingleId(process.env.DISCORD_UNVERIFIED_ROLE_ID);
  if (singularUnverified) unverifiedIds.add(singularUnverified);

  const unpaidId =
    parseSingleId(process.env.DISCORD_UNPAID_ROLE_ID) ||
    parseSingleId(process.env.HUMAN_VERIFIED_ROLE_ID);

  const trencherId =
    parseSingleId(process.env.DISCORD_TRENCHER_ROLE_ID) ||
    parseSingleId(process.env.DISCORD_PREMIUM_ROLE_ID);

  const proId = parseSingleId(process.env.DISCORD_PRO_ROLE_ID);

  if (unverifiedIds.size === 0 && !unpaidId && !trencherId && !proId) {
    return null;
  }

  return { guildId, botToken, unverifiedIds, unpaidId, trencherId, proId };
}

export function membershipRolesConfigured(): boolean {
  return readMembershipRoleConfig() !== null;
}

export type MembershipAccessGateResult =
  | { ok: true; paidTier: ProductTier | null }
  | { ok: false; reason: "unverified_role" | "unpaid_role" | "missing_required_role" };

/**
 * Discord role ladder for dashboard access (when membership roles are configured):
 * - Deny if member has Unverified or Unpaid
 * - Require Trencher (Basic) or Pro when paid-role ids are configured
 *
 * Legacy `DISCORD_UNVERIFIED_ROLE_IDS` / `DISCORD_REQUIRED_MEMBER_ROLE_IDS` are merged in.
 */
export function membershipAccessGateFromRoleIds(
  roleIds: readonly string[]
): MembershipAccessGateResult | null {
  const cfg = readMembershipRoleConfig();
  const legacyUnverified = parseIdSet(process.env.DISCORD_UNVERIFIED_ROLE_IDS);
  const legacyRequired = parseIdSet(process.env.DISCORD_REQUIRED_MEMBER_ROLE_IDS);

  const unverifiedDeny = new Set<string>(legacyUnverified);
  const paidIds = new Set<string>(legacyRequired);
  let unpaidDeny = "";

  if (cfg) {
    for (const id of cfg.unverifiedIds) unverifiedDeny.add(id);
    unpaidDeny = cfg.unpaidId;
    if (cfg.trencherId) paidIds.add(cfg.trencherId);
    if (cfg.proId) paidIds.add(cfg.proId);
  }

  if (unverifiedDeny.size === 0 && !unpaidDeny && paidIds.size === 0) {
    return null;
  }

  const has = (id: string) => Boolean(id && roleIds.includes(id));

  for (const id of unverifiedDeny) {
    if (has(id)) return { ok: false, reason: "unverified_role" };
  }
  if (unpaidDeny && has(unpaidDeny)) {
    return { ok: false, reason: "unpaid_role" };
  }

  if (cfg?.proId && has(cfg.proId)) {
    return { ok: true, paidTier: "pro" };
  }
  if (cfg?.trencherId && has(cfg.trencherId)) {
    return { ok: true, paidTier: "basic" };
  }

  if (paidIds.size > 0) {
    const hasPaid = [...paidIds].some((id) => has(id));
    if (!hasPaid) return { ok: false, reason: "missing_required_role" };
    return { ok: true, paidTier: null };
  }

  return { ok: true, paidTier: null };
}

function subscriptionPeriodActive(isoEnd: string | null): boolean {
  if (!isoEnd) return false;
  const t = new Date(isoEnd).getTime();
  return Number.isFinite(t) && t > Date.now();
}

async function discordModifyMemberRole(
  cfg: MembershipRoleConfig,
  discordUserId: string,
  roleId: string,
  method: "PUT" | "DELETE"
): Promise<void> {
  const uid = discordUserId.trim();
  const rid = roleId.trim();
  if (!uid || !rid) return;

  const url =
    `https://discord.com/api/v10/guilds/${encodeURIComponent(cfg.guildId)}/members/` +
    `${encodeURIComponent(uid)}/roles/${encodeURIComponent(rid)}`;

  try {
    const res = await fetch(url, {
      method,
      headers: { Authorization: `Bot ${cfg.botToken}` },
      cache: "no-store",
    });
    if (!res.ok && res.status !== 404) {
      const detail = await res.text().catch(() => "");
      console.warn(
        `[discordMembershipRoles] ${method} role ${rid} for ${uid}:`,
        res.status,
        detail.slice(0, 200)
      );
    }
  } catch (e) {
    console.warn("[discordMembershipRoles] role modify failed", uid, rid, e);
  }
}

/**
 * Keeps Discord roles aligned with Supabase subscription + product tier:
 * - Active Basic → Trencher (remove Unpaid / Unverified / Pro)
 * - Active Pro → Pro (remove Unpaid / Unverified / Trencher)
 * - Expired → remove paid roles, add Unpaid when configured
 */
export async function syncMembershipDiscordRoles(discordUserId: string): Promise<void> {
  const cfg = readMembershipRoleConfig();
  if (!cfg) return;

  const id = discordUserId.trim();
  if (!id) return;

  let exempt = false;
  try {
    exempt = await computeSubscriptionExempt(id);
  } catch (e) {
    console.warn("[discordMembershipRoles] exempt check", id, e);
  }
  if (exempt) return;

  const end = await getSubscriptionEnd(id);
  const active = subscriptionPeriodActive(end);
  const tier: ProductTier = active ? await resolveUserProductTier(id) : "basic";

  const remove = async (roleId: string) => {
    if (roleId) await discordModifyMemberRole(cfg, id, roleId, "DELETE");
  };
  const add = async (roleId: string) => {
    if (roleId) await discordModifyMemberRole(cfg, id, roleId, "PUT");
  };

  for (const unverifiedId of cfg.unverifiedIds) {
    await remove(unverifiedId);
  }

  if (active) {
    await remove(cfg.unpaidId);
    if (tier === "pro") {
      await remove(cfg.trencherId);
      await add(cfg.proId);
    } else {
      await remove(cfg.proId);
      await add(cfg.trencherId);
    }
    return;
  }

  await remove(cfg.trencherId);
  await remove(cfg.proId);

  const currentRoles = await getDiscordGuildMemberRoleIds(id);
  const stillUnverified =
    Array.isArray(currentRoles) &&
    [...cfg.unverifiedIds].some((rid) => currentRoles.includes(rid));

  if (cfg.unpaidId && !stillUnverified) {
    await add(cfg.unpaidId);
  }
}
