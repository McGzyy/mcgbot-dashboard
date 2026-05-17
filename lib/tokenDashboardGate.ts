import { resolveHelpTier } from "@/lib/helpRole";

export function discordIdFromTokenFields(token: Record<string, unknown> | null): string {
  if (!token) return "";
  const pick = (v: unknown): string => {
    if (typeof v === "string" && v.trim()) return v.trim();
    return "";
  };
  const fromDiscord = pick(token.discord_id);
  if (fromDiscord) return fromDiscord;
  const sub = pick(token.sub);
  if (sub) return sub;
  return pick(token.id);
}

export function subscriptionActiveFromToken(token: Record<string, unknown> | null): boolean {
  const end = token?.subscriptionActiveUntil;
  if (typeof end !== "string" || !end) return false;
  const t = new Date(end).getTime();
  return Number.isFinite(t) && t > Date.now();
}

/** Staff/mod from JWT and env allowlists (DISCORD_ADMIN_IDS / DISCORD_MOD_IDS). */
export function isStaffFromToken(token: Record<string, unknown>, discordId?: string): boolean {
  if (token.helpTier === "admin" || token.helpTier === "mod") return true;
  if (token.canModerate === true) return true;
  const id = (discordId ?? discordIdFromTokenFields(token)).trim();
  if (!id) return false;
  const env = resolveHelpTier(id);
  return env === "admin" || env === "mod";
}

/** Do not treat transient Discord "not in guild" as a hard deny (subscription / staff). */
export function isProtectedFromGuildFalsePositive(
  token: Record<string, unknown>,
  discordId?: string
): boolean {
  return (
    isStaffFromToken(token, discordId) ||
    token.subscriptionExempt === true ||
    subscriptionActiveFromToken(token)
  );
}
