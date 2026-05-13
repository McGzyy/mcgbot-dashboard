type GuildBotConfig = { guildId: string; botToken: string } | null;

function readGuildBotConfig(): GuildBotConfig {
  const guildId = (process.env.DISCORD_GUILD_ID ?? "").trim();
  const botToken = (process.env.DISCORD_BOT_TOKEN ?? process.env.DISCORD_TOKEN ?? "").trim();
  if (!guildId || !botToken) return null;
  return { guildId, botToken };
}

async function modifyGuildMemberRole(
  cfg: { guildId: string; botToken: string },
  discordUserId: string,
  roleId: string,
  method: "PUT" | "DELETE"
): Promise<{ ok: true } | { ok: false; status: number; detail: string }> {
  const uid = discordUserId.trim();
  const rid = roleId.trim();
  if (!uid || !rid) return { ok: false, status: 400, detail: "missing_id" };

  const url =
    `https://discord.com/api/v10/guilds/${encodeURIComponent(cfg.guildId)}/members/` +
    `${encodeURIComponent(uid)}/roles/${encodeURIComponent(rid)}`;

  try {
    const res = await fetch(url, {
      method,
      headers: { Authorization: `Bot ${cfg.botToken}` },
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

export async function grantDiscordGuildMemberRole(
  discordUserId: string,
  roleId: string,
  logLabel: string
): Promise<void> {
  const cfg = readGuildBotConfig();
  if (!cfg) return;
  const res = await modifyGuildMemberRole(cfg, discordUserId, roleId, "PUT");
  if (!res.ok && res.status !== 404) {
    console.warn(`[${logLabel}] grant failed`, discordUserId, res.status, res.detail);
  }
}

export async function revokeDiscordGuildMemberRole(
  discordUserId: string,
  roleId: string,
  logLabel: string
): Promise<void> {
  const cfg = readGuildBotConfig();
  if (!cfg) return;
  const res = await modifyGuildMemberRole(cfg, discordUserId, roleId, "DELETE");
  if (!res.ok && res.status !== 404) {
    console.warn(`[${logLabel}] revoke failed`, discordUserId, res.status, res.detail);
  }
}
