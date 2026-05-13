/** Default Discord role for Trusted Pro (override `DISCORD_TRUSTED_PRO_ROLE_ID`). */
export const DEFAULT_DISCORD_TRUSTED_PRO_ROLE_ID = "1490638667386191884";

/** Default Discord role for monthly #1 Top Caller (override `DISCORD_TOP_CALLER_ROLE_ID`). */
export const DEFAULT_DISCORD_TOP_CALLER_ROLE_ID = "1489081922666758264";

export function discordTrustedProRoleId(): string {
  return (process.env.DISCORD_TRUSTED_PRO_ROLE_ID ?? DEFAULT_DISCORD_TRUSTED_PRO_ROLE_ID).trim();
}

export function discordTopCallerRoleId(): string {
  return (process.env.DISCORD_TOP_CALLER_ROLE_ID ?? DEFAULT_DISCORD_TOP_CALLER_ROLE_ID).trim();
}
