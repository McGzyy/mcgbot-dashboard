/** Canonical Discord server invite (join flow when not in guild). */
export const DISCORD_SERVER_INVITE_URL = "https://discord.gg/22p8tzPHYf";

const DEFAULT_GUILD_ID = "1474358041372655739";
const DEFAULT_VERIFY_CHANNEL_ID = "1482445240924242150";

/** Deep link to #verification for members already in the guild. */
export function discordVerificationChannelUrl(): string {
  const direct = (process.env.NEXT_PUBLIC_DISCORD_VERIFY_CHANNEL_URL ?? "").trim();
  if (direct) return direct;

  const guildId = (process.env.NEXT_PUBLIC_DISCORD_GUILD_ID ?? DEFAULT_GUILD_ID).trim();
  const channelId = (
    process.env.NEXT_PUBLIC_DISCORD_VERIFY_CHANNEL_ID ?? DEFAULT_VERIFY_CHANNEL_ID
  ).trim();
  if (guildId && channelId) {
    return `https://discord.com/channels/${guildId}/${channelId}`;
  }
  return `https://discord.com/channels/${DEFAULT_GUILD_ID}/${DEFAULT_VERIFY_CHANNEL_ID}`;
}

/** Invite when not in guild; verification channel when already a member. */
export function resolveDiscordEntryUrl(opts: {
  inGuild?: boolean | null;
  siteInviteUrl?: string | null;
}): string {
  if (opts.inGuild === true) {
    return discordVerificationChannelUrl();
  }
  const fromSite = opts.siteInviteUrl?.trim();
  return fromSite || DISCORD_SERVER_INVITE_URL;
}
