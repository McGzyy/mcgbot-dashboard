/**
 * Fetch a Discord guild member (server-side, bot token) to normalize names for
 * webhook-authored messages. Uses DISCORD_GUILD_ID and DISCORD_BOT_TOKEN (or DISCORD_TOKEN).
 */
export type DiscordGuildMemberSummary = {
  discordUserId: string;
  /** Server nickname if present; otherwise Discord global name; otherwise username. */
  displayName: string;
  username: string;
  roleIds: string[];
};

function asObj(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : null;
}

function str(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() ? v : undefined;
}

function safeDisplayNameFromMember(member: Record<string, unknown>): string {
  const nick = str(member.nick);
  if (nick) return nick;
  const user = asObj(member.user);
  const gn = str(user?.global_name);
  if (gn) return gn;
  const un = str(user?.username);
  return un ?? "Unknown";
}

function safeUsernameFromMember(member: Record<string, unknown>): string {
  const user = asObj(member.user);
  return str(user?.username) ?? "unknown";
}

export async function fetchDiscordGuildMemberSummary(
  discordUserId: string
): Promise<DiscordGuildMemberSummary | null> {
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

    if (memberRes.status === 404) return null;
    if (!memberRes.ok) {
      console.warn(
        `[discordGuildMemberSummary] member fetch failed (${memberRes.status}) for user ${uid.slice(0, 6)}…`
      );
      return null;
    }

    const raw = (await memberRes.json().catch(() => null)) as unknown;
    const member = asObj(raw);
    if (!member) return null;

    const rolesRaw = member.roles;
    const roleIds = Array.isArray(rolesRaw)
      ? rolesRaw.map((r) => String(r).trim()).filter(Boolean)
      : [];

    return {
      discordUserId: uid,
      displayName: safeDisplayNameFromMember(member),
      username: safeUsernameFromMember(member),
      roleIds,
    };
  } catch (e) {
    console.warn("[discordGuildMemberSummary] unexpected error", e);
    return null;
  }
}

