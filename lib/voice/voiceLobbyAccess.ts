import { fetchDiscordGuildMemberRoleIds } from "@/lib/discordGuildMemberRoles";
import type { HelpTier } from "@/lib/helpRole";
import type { VoiceLobbyDefinition } from "@/lib/voice/lobbies";
import { tierMeetsLobby } from "@/lib/voice/tierGate";

/** Default OGs role id (override with DISCORD_OG_VOICE_ROLE_ID or DISCORD_OG_ROLE_ID). */
const DEFAULT_OG_VOICE_ROLE_ID = "1494216232629440533";

export function resolveOgVoiceDiscordRoleId(): string {
  const fromEnv = (
    process.env.DISCORD_OG_VOICE_ROLE_ID ??
    process.env.DISCORD_OG_ROLE_ID ??
    ""
  ).trim();
  return fromEnv || DEFAULT_OG_VOICE_ROLE_ID;
}

/**
 * Server-side gate for joining a voice lobby. OG Chat requires mod/admin **or** the configured
 * OGs Discord role; other lobbies use `minTier` only.
 */
export async function canJoinVoiceLobbyAsync(
  lobby: VoiceLobbyDefinition,
  helpTier: HelpTier,
  discordUserId: string
): Promise<boolean> {
  if (lobby.joinRule !== "og_discord_or_staff") {
    return tierMeetsLobby(lobby.minTier, helpTier);
  }

  if (tierMeetsLobby("mod", helpTier)) return true;

  const roleIds = await fetchDiscordGuildMemberRoleIds(discordUserId);
  if (!roleIds) return false;

  const ogRoleId = resolveOgVoiceDiscordRoleId();
  return roleIds.includes(ogRoleId);
}
