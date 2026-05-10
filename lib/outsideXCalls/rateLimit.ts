import type { SupabaseClient } from "@supabase/supabase-js";
import {
  OUTSIDE_X_SUBMIT_COOLDOWN_MS_DEFAULT,
  OUTSIDE_X_SUBMIT_COOLDOWN_MS_ELEVATED,
} from "@/lib/outsideXCalls/constants";

export type OutsideSubmitCooldownTier = "default" | "elevated";

export function submitCooldownMsForTier(tier: OutsideSubmitCooldownTier): number {
  return tier === "elevated" ? OUTSIDE_X_SUBMIT_COOLDOWN_MS_ELEVATED : OUTSIDE_X_SUBMIT_COOLDOWN_MS_DEFAULT;
}

/**
 * Trusted Pro flag from `public.users` (Discord role sync at sign-in).
 */
export async function fetchUserTrustedProFlag(
  db: SupabaseClient,
  discordId: string
): Promise<boolean> {
  const { data, error } = await db
    .from("users")
    .select("trusted_pro")
    .eq("discord_id", discordId.trim())
    .maybeSingle();
  if (error || !data) return false;
  return (data as { trusted_pro?: boolean }).trusted_pro === true;
}

/**
 * Latest fully approved outside-source submission time for rolling rate limits.
 */
export async function fetchLastApprovedSubmissionResolvedAt(
  db: SupabaseClient,
  submitterDiscordId: string
): Promise<string | null> {
  const { data, error } = await db
    .from("outside_source_submissions")
    .select("resolved_at")
    .eq("submitter_discord_id", submitterDiscordId.trim())
    .eq("status", "approved")
    .not("resolved_at", "is", null)
    .order("resolved_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  const at = (data as { resolved_at?: string | null }).resolved_at;
  return typeof at === "string" && at ? at : null;
}

export function msSinceLastResolved(resolvedAtIso: string | null): number | null {
  if (!resolvedAtIso) return null;
  const t = new Date(resolvedAtIso).getTime();
  if (!Number.isFinite(t)) return null;
  return Date.now() - t;
}
