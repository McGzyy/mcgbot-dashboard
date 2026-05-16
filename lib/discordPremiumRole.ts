import { syncMembershipDiscordRoles } from "@/lib/discordMembershipRoles";

/** @deprecated Use `syncMembershipDiscordRoles` — kept for existing imports. */
export async function syncPremiumDiscordRoleAfterSubscriptionChange(
  discordUserId: string
): Promise<void> {
  await syncMembershipDiscordRoles(discordUserId);
}

export async function grantPremiumDiscordRole(discordUserId: string): Promise<void> {
  await syncMembershipDiscordRoles(discordUserId);
}

export async function revokePremiumDiscordRole(discordUserId: string): Promise<void> {
  await syncMembershipDiscordRoles(discordUserId);
}
