import { grantDiscordGuildMemberRole } from "@/lib/discordGuildMemberRole";
import { discordTopCallerRoleId, discordTrustedProRoleId } from "@/lib/discordHonorRoleIds";

export async function grantTrustedProDiscordRole(discordUserId: string): Promise<void> {
  await grantDiscordGuildMemberRole(discordUserId, discordTrustedProRoleId(), "discordHonorRoles/trustedPro");
}

export async function grantTopCallerDiscordRole(discordUserId: string): Promise<void> {
  await grantDiscordGuildMemberRole(discordUserId, discordTopCallerRoleId(), "discordHonorRoles/topCaller");
}
