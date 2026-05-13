import { getDiscordGuildMemberRoleIds } from "@/lib/discordGuildMember";
import { discordTopCallerRoleId, discordTrustedProRoleId } from "@/lib/discordHonorRoleIds";
import { TOP_CALLER_BADGE_KEY } from "@/lib/topCallerBadgeDisplay";

export type HonorRolePresence = {
  hasTrustedProRole: boolean;
  hasTopCallerRole: boolean;
};

function guildBotConfigured(): boolean {
  const guildId = (process.env.DISCORD_GUILD_ID ?? "").trim();
  const token = (process.env.DISCORD_BOT_TOKEN ?? process.env.DISCORD_TOKEN ?? "").trim();
  return Boolean(guildId && token);
}

/**
 * When guild + bot token are set, returns a map of Discord user id → whether they currently
 * have Trusted Pro / Top Caller roles in the guild. Used to hide honor UI when roles were removed.
 * Returns `null` when Discord is not configured — callers should skip filtering (e.g. local dev).
 */
export async function fetchHonorRolePresenceBatch(
  discordUserIds: string[]
): Promise<Map<string, HonorRolePresence> | null> {
  if (!guildBotConfigured()) return null;

  const trustedRole = discordTrustedProRoleId();
  const topCallerRole = discordTopCallerRoleId();
  if (!trustedRole || !topCallerRole) return null;

  const uniq = [...new Set(discordUserIds.map((id) => id.trim()).filter(Boolean))];
  const out = new Map<string, HonorRolePresence>();
  const chunkSize = 5;

  for (let i = 0; i < uniq.length; i += chunkSize) {
    const chunk = uniq.slice(i, i + chunkSize);
    await Promise.all(
      chunk.map(async (id) => {
        const roles = await getDiscordGuildMemberRoleIds(id);
        if (roles === null) {
          out.set(id, { hasTrustedProRole: false, hasTopCallerRole: false });
          return;
        }
        out.set(id, {
          hasTrustedProRole: roles.includes(trustedRole),
          hasTopCallerRole: roles.includes(topCallerRole),
        });
      })
    );
  }

  return out;
}

export function isTopCallerBadgeToken(token: string): boolean {
  const t = token.trim();
  return t === TOP_CALLER_BADGE_KEY || /^top_caller×\d+$/.test(t);
}

export function filterHonorBadgeTokens(tokens: string[], presence: HonorRolePresence): string[] {
  return tokens.filter((t) => {
    if (t === "trusted_pro") return presence.hasTrustedProRole;
    if (isTopCallerBadgeToken(t)) return presence.hasTopCallerRole;
    return true;
  });
}
