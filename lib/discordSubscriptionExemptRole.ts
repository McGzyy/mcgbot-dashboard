/** Default subscription-exempt Discord role (override with `DISCORD_SUBSCRIPTION_EXEMPT_ROLE_ID`). */
const DEFAULT_SUBSCRIPTION_EXEMPT_ROLE_ID = "1490660563993366589";

type DiscordSubscriptionExemptRoleConfig =
  | { ok: true; guildId: string; botToken: string; roleId: string }
  | { ok: false };

function readDiscordSubscriptionExemptRoleConfig(): DiscordSubscriptionExemptRoleConfig {
  const guildId = (process.env.DISCORD_GUILD_ID ?? "").trim();
  const botToken = (process.env.DISCORD_BOT_TOKEN ?? process.env.DISCORD_TOKEN ?? "").trim();
  const roleId = (process.env.DISCORD_SUBSCRIPTION_EXEMPT_ROLE_ID ?? DEFAULT_SUBSCRIPTION_EXEMPT_ROLE_ID).trim();
  if (!guildId || !botToken || !roleId) return { ok: false };
  return { ok: true, guildId, botToken, roleId };
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

/** Grants subscription-exempt role when guild + bot token are configured. */
export async function grantSubscriptionExemptDiscordRole(discordUserId: string): Promise<void> {
  const cfg = readDiscordSubscriptionExemptRoleConfig();
  if (!cfg.ok) return;
  const res = await discordModifyGuildMemberRole(cfg, discordUserId, "PUT");
  if (!res.ok && res.status !== 404) {
    console.warn("[discordSubscriptionExemptRole] grant failed", discordUserId, res.status, res.detail);
  }
}

/** Removes subscription-exempt role when configured. */
export async function revokeSubscriptionExemptDiscordRole(discordUserId: string): Promise<void> {
  const cfg = readDiscordSubscriptionExemptRoleConfig();
  if (!cfg.ok) return;
  const res = await discordModifyGuildMemberRole(cfg, discordUserId, "DELETE");
  if (!res.ok && res.status !== 404) {
    console.warn("[discordSubscriptionExemptRole] revoke failed", discordUserId, res.status, res.detail);
  }
}
