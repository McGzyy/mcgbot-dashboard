/**
 * Returns whether the Discord user is currently a member of DISCORD_GUILD_ID,
 * using the same bot token as other Discord REST calls.
 */
export async function isDiscordGuildMember(discordUserId: string): Promise<boolean | null> {
  const guildId = (process.env.DISCORD_GUILD_ID ?? "").trim();
  const token = (process.env.DISCORD_BOT_TOKEN ?? process.env.DISCORD_TOKEN ?? "").trim();
  if (!guildId || !token) return null;

  const uid = discordUserId.trim();
  if (!uid) return false;

  try {
    const res = await fetch(
      `https://discord.com/api/v10/guilds/${encodeURIComponent(guildId)}/members/${encodeURIComponent(uid)}`,
      {
        headers: { Authorization: `Bot ${token}` },
        cache: "no-store",
      }
    );
    if (res.status === 200) return true;
    if (res.status === 404) return false;
    console.warn(`[discordGuildMember] unexpected status ${res.status}`);
    return null;
  } catch (e) {
    console.warn("[discordGuildMember] fetch error", e);
    return null;
  }
}

/**
 * Role ids for the member in DISCORD_GUILD_ID, or empty if not a member (404).
 * `null` if guild/token not configured or the request failed.
 */
export async function getDiscordGuildMemberRoleIds(discordUserId: string): Promise<string[] | null> {
  const guildId = (process.env.DISCORD_GUILD_ID ?? "").trim();
  const token = (process.env.DISCORD_BOT_TOKEN ?? process.env.DISCORD_TOKEN ?? "").trim();
  if (!guildId || !token) return null;

  const uid = discordUserId.trim();
  if (!uid) return null;

  try {
    const res = await fetch(
      `https://discord.com/api/v10/guilds/${encodeURIComponent(guildId)}/members/${encodeURIComponent(uid)}`,
      {
        headers: { Authorization: `Bot ${token}` },
        cache: "no-store",
      }
    );
    if (res.status === 404) return [];
    if (!res.ok) {
      console.warn(`[discordGuildMember] member roles fetch unexpected status ${res.status}`);
      return null;
    }
    const member = (await res.json().catch(() => null)) as { roles?: unknown } | null;
    if (!member || !Array.isArray(member.roles)) return [];
    return member.roles.map((r) => String(r).trim()).filter(Boolean);
  } catch (e) {
    console.warn("[discordGuildMember] member roles fetch error", e);
    return null;
  }
}
