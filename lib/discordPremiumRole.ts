import { computeSubscriptionExempt } from "@/lib/subscriptionExemption";
import { getSubscriptionEnd } from "@/lib/subscription/subscriptionDb";

type DiscordPremiumRoleConfig =
  | { ok: true; guildId: string; botToken: string; roleId: string }
  | { ok: false };

function readDiscordPremiumRoleConfig(): DiscordPremiumRoleConfig {
  const guildId = (process.env.DISCORD_GUILD_ID ?? "").trim();
  const botToken = (process.env.DISCORD_BOT_TOKEN ?? process.env.DISCORD_TOKEN ?? "").trim();
  const roleId = (process.env.DISCORD_PREMIUM_ROLE_ID ?? "").trim();
  if (!guildId || !botToken || !roleId) return { ok: false };
  return { ok: true, guildId, botToken, roleId };
}

function subscriptionPeriodActive(isoEnd: string | null): boolean {
  if (!isoEnd) return false;
  const t = new Date(isoEnd).getTime();
  return Number.isFinite(t) && t > Date.now();
}

async function discordModifyGuildMemberRole(
  cfg: { guildId: string; botToken: string; roleId: string },
  discordUserId: string,
  method: "PUT" | "DELETE"
): Promise<{ ok: true } | { ok: false; status: number; detail: string }> {
  const uid = discordUserId.trim();
  if (!uid) return { ok: false, status: 400, detail: "missing_discord_user" };

  const url =
    `https://discord.com/api/v10/guilds/${encodeURIComponent(cfg.guildId)}/members/` +
    `${encodeURIComponent(uid)}/roles/${encodeURIComponent(cfg.roleId)}`;

  try {
    const res = await fetch(url, {
      method,
      headers: {
        Authorization: `Bot ${cfg.botToken}`,
      },
      cache: "no-store",
    });
    if (res.ok || res.status === 204) return { ok: true };
    const detail = await res.text().catch(() => "");
    return { ok: false, status: res.status, detail: detail.slice(0, 280) };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "fetch_failed";
    return { ok: false, status: 0, detail: msg };
  }
}

/** Grants `DISCORD_PREMIUM_ROLE_ID` if configured; no-op when unset. */
export async function grantPremiumDiscordRole(discordUserId: string): Promise<void> {
  const cfg = readDiscordPremiumRoleConfig();
  if (!cfg.ok) return;
  const res = await discordModifyGuildMemberRole(cfg, discordUserId, "PUT");
  if (!res.ok && res.status !== 404) {
    console.warn("[discordPremiumRole] grant failed", discordUserId, res.status, res.detail);
  }
}

/** Removes `DISCORD_PREMIUM_ROLE_ID` if configured; no-op when unset. */
export async function revokePremiumDiscordRole(discordUserId: string): Promise<void> {
  const cfg = readDiscordPremiumRoleConfig();
  if (!cfg.ok) return;
  const res = await discordModifyGuildMemberRole(cfg, discordUserId, "DELETE");
  if (!res.ok && res.status !== 404) {
    console.warn("[discordPremiumRole] revoke failed", discordUserId, res.status, res.detail);
  }
}

/**
 * Keeps Discord in sync with the dashboard subscription row:
 * active paid window → grant; expired → revoke (skipped for subscription-exempt accounts).
 */
export async function syncPremiumDiscordRoleAfterSubscriptionChange(discordUserId: string): Promise<void> {
  const cfg = readDiscordPremiumRoleConfig();
  if (!cfg.ok) return;

  const id = discordUserId.trim();
  if (!id) return;

  const end = await getSubscriptionEnd(id);
  if (subscriptionPeriodActive(end)) {
    await grantPremiumDiscordRole(id);
    return;
  }

  let exempt = false;
  try {
    exempt = await computeSubscriptionExempt(id);
  } catch (e) {
    console.warn("[discordPremiumRole] computeSubscriptionExempt", id, e);
  }
  if (!exempt) {
    await revokePremiumDiscordRole(id);
  }
}
