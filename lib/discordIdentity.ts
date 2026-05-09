import type { SupabaseClient } from "@supabase/supabase-js";
import { CALL_PERFORMANCE_ELIGIBLE_FOR_PUBLIC_STATS_OR } from "@/lib/callPerformanceDashboardVisibility";

/** Discord snowflake id (numeric string, typical length 17–20). */
export function looksLikeDiscordSnowflake(raw: string | null | undefined): boolean {
  const s = String(raw ?? "").trim();
  if (!s) return false;
  return /^\d{17,21}$/.test(s);
}

/**
 * Resolve `/user/[id]` route param to a Discord user id.
 * - Numeric snowflake → returned as-is.
 * - Otherwise treat as display name / handle: match latest `call_performance.username` (case-insensitive).
 */
export async function resolveDiscordIdFromProfileRouteParam(
  supabase: SupabaseClient,
  rawParam: string
): Promise<string | null> {
  const trimmed = String(rawParam ?? "").trim();
  if (!trimmed) return null;
  if (looksLikeDiscordSnowflake(trimmed)) return trimmed;

  const decoded = decodeURIComponent(trimmed).trim();
  if (!decoded) return null;

  const safePattern = decoded
    .replace(/\\/g, "\\\\")
    .replace(/%/g, "\\%")
    .replace(/_/g, "\\_");

  const { data, error } = await supabase
    .from("call_performance")
    .select("discord_id")
    .ilike("username", safePattern)
    .or(CALL_PERFORMANCE_ELIGIBLE_FOR_PUBLIC_STATS_OR)
    .order("call_time", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("[resolveDiscordIdFromProfileRouteParam]", error);
    return null;
  }

  const row = data as { discord_id?: unknown } | null;
  const id =
    row && typeof row.discord_id === "string"
      ? row.discord_id.trim()
      : row
        ? String(row.discord_id ?? "").trim()
        : "";
  return id || null;
}

/** Discord default avatar sprite when the user has no custom avatar (from snowflake). */
export function discordDefaultEmbedAvatarUrl(discordId: string): string {
  const s = String(discordId ?? "").trim();
  if (!s) return "https://cdn.discordapp.com/embed/avatars/0.png";
  try {
    const id = BigInt(s);
    const idx = Number((id >> BigInt(22)) % BigInt(6));
    return `https://cdn.discordapp.com/embed/avatars/${idx}.png`;
  } catch {
    return "https://cdn.discordapp.com/embed/avatars/0.png";
  }
}
