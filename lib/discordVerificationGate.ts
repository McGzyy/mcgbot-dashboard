import {
  humanVerificationGateFromRoleIds,
  type HumanVerificationGateResult,
} from "@/lib/discordMembershipRoles";

export type DiscordVerificationGateResult = HumanVerificationGateResult;

/** Human verification gate only — Unpaid does not block (use for checkout / verify redirects). */
export function discordVerificationGateFromRoleIds(
  roleIds: readonly string[]
): DiscordVerificationGateResult | null {
  return humanVerificationGateFromRoleIds(roleIds);
}
