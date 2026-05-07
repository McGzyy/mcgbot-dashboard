import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

/**
 * True → caller should treat profile as not found for this viewer (404).
 * Owner + staff always see data.
 */
export async function isPublicProfileHiddenFromViewer(profileDiscordId: string): Promise<boolean> {
  const pid = profileDiscordId.trim();
  if (!pid) return true;

  const session = await getServerSession(authOptions);
  const viewerId = session?.user?.id?.trim() ?? "";
  if (viewerId && viewerId === pid) return false;

  const tier = session?.user?.helpTier;
  if (tier === "admin" || tier === "mod") return false;

  const db = getSupabaseAdmin();
  if (!db) return false;

  const { data, error } = await db
    .from("users")
    .select("guild_member_active")
    .eq("discord_id", pid)
    .maybeSingle();

  if (error) {
    console.warn("[profileGuildVisibility] gate:", error.message);
    return false;
  }

  if (!data || typeof data !== "object") return false;

  const active = (data as { guild_member_active?: unknown }).guild_member_active;
  return active === false;
}
