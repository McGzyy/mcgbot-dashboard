function parseIdSet(raw: string | undefined): Set<string> {
  if (!raw?.trim()) return new Set();
  return new Set(
    raw
      .split(/[\s,]+/)
      .map((s) => s.trim())
      .filter(Boolean)
  );
}

export type DiscordVerificationGateResult =
  | { ok: true }
  | { ok: false; reason: "unverified_role" | "missing_required_role" };

/**
 * Verification gating is configured by env:
 * - DISCORD_UNVERIFIED_ROLE_IDS: deny if the member has any of these roles.
 * - DISCORD_REQUIRED_MEMBER_ROLE_IDS: if set, require the member to have at least one of these roles.
 *
 * If both env vars are unset/empty, this returns `null` (no verification gate configured).
 */
export function discordVerificationGateFromRoleIds(
  roleIds: readonly string[]
): DiscordVerificationGateResult | null {
  const unverifiedIds = parseIdSet(process.env.DISCORD_UNVERIFIED_ROLE_IDS);
  const requiredIds = parseIdSet(process.env.DISCORD_REQUIRED_MEMBER_ROLE_IDS);
  if (unverifiedIds.size === 0 && requiredIds.size === 0) return null;

  if (roleIds.some((id) => unverifiedIds.has(id))) {
    return { ok: false, reason: "unverified_role" };
  }

  if (requiredIds.size > 0 && !roleIds.some((id) => requiredIds.has(id))) {
    return { ok: false, reason: "missing_required_role" };
  }

  return { ok: true };
}

