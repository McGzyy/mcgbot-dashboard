import {
  membershipAccessGateFromRoleIds,
  type MembershipAccessGateResult,
} from "@/lib/discordMembershipRoles";

export type DiscordVerificationGateResult = MembershipAccessGateResult;

/**
 * @deprecated Prefer `membershipAccessGateFromRoleIds` — this re-exports the same ladder gate
 * (Unverified / Unpaid deny; Trencher / Pro allow) plus legacy env lists.
 */
export function discordVerificationGateFromRoleIds(
  roleIds: readonly string[]
): DiscordVerificationGateResult | null {
  return membershipAccessGateFromRoleIds(roleIds);
}
