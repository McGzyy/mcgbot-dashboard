import type { SupabaseClient } from "@supabase/supabase-js";

/** Load `discord_display_name` from `public.users` for leaderboard rows. */
export async function fetchDiscordDisplayNameMap(
  supabase: SupabaseClient,
  discordIds: string[]
): Promise<Record<string, string>> {
  const uniq = [
    ...new Set(
      discordIds
        .map((id) => String(id || "").trim())
        .filter((id) => id.length > 0)
    ),
  ];
  if (uniq.length === 0) return {};

  const { data, error } = await supabase
    .from("users")
    .select("discord_id, discord_display_name")
    .in("discord_id", uniq);

  if (error || !Array.isArray(data)) return {};

  const map: Record<string, string> = {};
  for (const row of data as {
    discord_id?: string | null;
    discord_display_name?: string | null;
  }[]) {
    const id = String(row.discord_id ?? "").trim();
    const dn =
      typeof row.discord_display_name === "string"
        ? row.discord_display_name.trim()
        : "";
    if (id && dn) map[id] = dn;
  }
  return map;
}

export function displayNameForDiscordId(
  discordId: string,
  fallbackUsername: string,
  nameMap: Record<string, string>
): string {
  const id = String(discordId || "").trim();
  const fromMap = id ? nameMap[id] : "";
  if (typeof fromMap === "string" && fromMap.trim()) return fromMap.trim();
  return String(fallbackUsername || "").trim() || id || "—";
}
