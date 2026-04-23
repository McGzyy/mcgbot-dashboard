type DiscordUser = {
  id: string;
  username?: string | null;
  global_name?: string | null;
  avatar?: string | null;
};

type DiscordGuildMember = {
  nick?: string | null;
  avatar?: string | null;
  user?: DiscordUser | null;
};

function botToken(): string {
  return (process.env.DISCORD_BOT_TOKEN ?? process.env.DISCORD_TOKEN ?? "").trim();
}

function guildId(): string {
  return (process.env.DISCORD_GUILD_ID ?? "").trim();
}

function discordAvatarCdnUrl(discordId: string, avatarHash: string): string {
  const ext = avatarHash.startsWith("a_") ? "gif" : "png";
  return `https://cdn.discordapp.com/avatars/${encodeURIComponent(discordId)}/${avatarHash}.${ext}?size=128`;
}

function discordGuildMemberAvatarCdnUrl(
  guildId: string,
  discordId: string,
  avatarHash: string
): string {
  const ext = avatarHash.startsWith("a_") ? "gif" : "png";
  return `https://cdn.discordapp.com/guilds/${encodeURIComponent(guildId)}/users/${encodeURIComponent(discordId)}/avatars/${avatarHash}.${ext}?size=128`;
}

/**
 * Best-effort identity from Discord API using bot token.
 * Prefers guild nick if available; returns `null` if token/guild missing or user not resolvable.
 */
export async function fetchDiscordIdentity(
  discordId: string
): Promise<{ displayName: string; avatarUrl: string | null } | null> {
  const uid = String(discordId ?? "").trim();
  if (!uid) return null;
  const token = botToken();
  const gid = guildId();
  if (!token || !gid) return null;

  try {
    const res = await fetch(
      `https://discord.com/api/v10/guilds/${encodeURIComponent(gid)}/members/${encodeURIComponent(uid)}`,
      {
        headers: { Authorization: `Bot ${token}` },
        cache: "no-store",
      }
    );

    // If not in guild, we can't ask the user endpoint without extra intents; bail.
    if (res.status === 404) return null;
    if (!res.ok) return null;

    const member = (await res.json().catch(() => null)) as DiscordGuildMember | null;
    if (!member) return null;

    const user = member.user ?? null;
    const nick = typeof member.nick === "string" ? member.nick.trim() : "";
    const globalName =
      user && typeof user.global_name === "string" ? user.global_name.trim() : "";
    const username = user && typeof user.username === "string" ? user.username.trim() : "";

    const displayName = nick || globalName || username;
    if (!displayName) return null;

    const memberAv = typeof member.avatar === "string" ? member.avatar.trim() : "";
    const userAv = user && typeof user.avatar === "string" ? user.avatar.trim() : "";

    const avatarUrl =
      memberAv && gid
        ? discordGuildMemberAvatarCdnUrl(gid, uid, memberAv)
        : userAv
          ? discordAvatarCdnUrl(uid, userAv)
          : null;

    return { displayName, avatarUrl };
  } catch {
    return null;
  }
}

