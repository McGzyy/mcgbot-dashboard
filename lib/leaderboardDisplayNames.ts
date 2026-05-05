import type { SupabaseClient } from "@supabase/supabase-js";

export type DiscordLeaderExtras = {
  displayNames: Record<string, string>;
  /** `users.discord_avatar_url` when set — HTTPS URL. */
  avatarUrls: Record<string, string>;
};

const MAX_AVATAR_URL_LEN = 800;

function uniqDiscordIds(discordIds: string[]): string[] {
  return [
    ...new Set(
      discordIds
        .map((id) => String(id || "").trim())
        .filter((id) => id.length > 0)
    ),
  ];
}

/** Load display names and avatar URLs from `public.users` for leaderboard rows. */
export async function fetchDiscordLeaderExtras(
  supabase: SupabaseClient,
  discordIds: string[]
): Promise<DiscordLeaderExtras> {
  const uniq = uniqDiscordIds(discordIds);
  if (uniq.length === 0) return { displayNames: {}, avatarUrls: {} };

  const { data, error } = await supabase
    .from("users")
    .select("discord_id, discord_display_name, discord_avatar_url")
    .in("discord_id", uniq);

  if (error || !Array.isArray(data)) {
    return { displayNames: {}, avatarUrls: {} };
  }

  const displayNames: Record<string, string> = {};
  const avatarUrls: Record<string, string> = {};
  for (const row of data as {
    discord_id?: string | null;
    discord_display_name?: string | null;
    discord_avatar_url?: string | null;
  }[]) {
    const id = String(row.discord_id ?? "").trim();
    if (!id) continue;
    const dn =
      typeof row.discord_display_name === "string"
        ? row.discord_display_name.trim()
        : "";
    if (dn) displayNames[id] = dn;
    const av =
      typeof row.discord_avatar_url === "string"
        ? row.discord_avatar_url.trim()
        : "";
    if (av) avatarUrls[id] = av.slice(0, MAX_AVATAR_URL_LEN);
  }
  return { displayNames, avatarUrls };
}

/** Load `discord_display_name` from `public.users` for leaderboard rows. */
export async function fetchDiscordDisplayNameMap(
  supabase: SupabaseClient,
  discordIds: string[]
): Promise<Record<string, string>> {
  const { displayNames } = await fetchDiscordLeaderExtras(supabase, discordIds);
  return displayNames;
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
