import { resolveHelpTierAsync } from "@/lib/helpRole";

/**
 * Edge middleware only — do not import `adminGate` here (it pulls `auth.ts` / Supabase).
 * JWT admin claim first, then live Discord guild admin (matches server `isDashboardAdminUser`).
 */
export async function isDashboardAdminFromJwt(
  token: Record<string, unknown> | null,
  discordId: string
): Promise<boolean> {
  const tier = typeof token?.helpTier === "string" ? token.helpTier.trim().toLowerCase() : "";
  if (tier === "admin") return true;
  const id = discordId.trim();
  if (!id) return false;
  return (await resolveHelpTierAsync(id)) === "admin";
}
