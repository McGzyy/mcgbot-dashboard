/**
 * Fetch a Discord guild member's role id list (server-side, bot token).
 * Uses DISCORD_GUILD_ID and DISCORD_BOT_TOKEN (or DISCORD_TOKEN).
 */

export async function fetchDiscordGuildMemberRoleIds(
  discordUserId: string
): Promise<string[] | null> {
  const guildId = (process.env.DISCORD_GUILD_ID ?? "").trim();
  const token = (process.env.DISCORD_BOT_TOKEN ?? process.env.DISCORD_TOKEN ?? "").trim();
  if (!guildId || !token) return null;

  const uid = discordUserId.trim();
  if (!uid) return null;

  try {
    const memberRes = await fetch(
      `https://discord.com/api/v10/guilds/${encodeURIComponent(guildId)}/members/${encodeURIComponent(uid)}`,
      {
        headers: { Authorization: `Bot ${token}` },
        cache: "no-store",
      }
    );

    if (memberRes.status === 404) {
      return [];
    }
    if (!memberRes.ok) {
      console.warn(
        `[discordGuildMemberRoles] member fetch failed (${memberRes.status}) for user ${uid.slice(0, 6)}…`
      );
      return null;
    }

    const member = (await memberRes.json().catch(() => null)) as { roles?: unknown } | null;
    if (!Array.isArray(member?.roles)) return [];

    return member!.roles.map((r) => String(r).trim()).filter(Boolean);
  } catch (e) {
    console.warn("[discordGuildMemberRoles] unexpected error", e);
    return null;
  }
}
