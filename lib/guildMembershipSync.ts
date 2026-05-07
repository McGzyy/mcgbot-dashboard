import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

/**
 * Mirrors Discord guild membership into `users` so public APIs can hide profiles and skip leaderboards
 * without calling Discord on every request.
 */
export async function syncGuildMembershipToUsers(
  discordId: string,
  inGuild: boolean | null
): Promise<void> {
  if (inGuild === null) return;
  const id = discordId.trim();
  if (!id) return;

  const db = getSupabaseAdmin();
  if (!db) return;

  const now = new Date().toISOString();
  const { error } = await db.from("users").upsert(
    {
      discord_id: id,
      guild_member_active: inGuild,
      guild_membership_checked_at: now,
    },
    { onConflict: "discord_id" }
  );
  if (error) {
    console.warn("[guildMembershipSync] upsert:", error.message);
  }
}

/** Discord ids whose profiles/stats should not appear publicly or on leaderboards. */
export async function fetchDiscordIdsExcludedFromLeaderboards(): Promise<Set<string>> {
  const db = getSupabaseAdmin();
  if (!db) return new Set();

  const { data, error } = await db
    .from("users")
    .select("discord_id")
    .eq("guild_member_active", false);

  if (error) {
    console.warn("[guildMembershipSync] inactive fetch:", error.message);
    return new Set();
  }

  const out = new Set<string>();
  for (const row of data ?? []) {
    const id =
      row &&
      typeof (row as { discord_id?: unknown }).discord_id === "string"
        ? (row as { discord_id: string }).discord_id.trim()
        : "";
    if (id) out.add(id);
  }
  return out;
}
