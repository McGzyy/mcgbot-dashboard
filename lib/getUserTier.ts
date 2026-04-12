import { createClient } from "@supabase/supabase-js";

/**
 * Looks up tier for a Discord user. Does not create rows or enforce access.
 * Missing env, errors, or unknown users → "free".
 */
export async function getUserTier(discordId: string): Promise<string> {
  const id = String(discordId ?? "").trim();
  if (!id) return "free";

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) return "free";

  const supabase = createClient(url, key);

  const { data, error } = await supabase
    .from("users")
    .select("tier")
    .eq("discord_id", id)
    .maybeSingle();

  if (error || !data) return "free";

  const tier =
    typeof data.tier === "string" && data.tier.trim() !== ""
      ? data.tier.trim()
      : "free";

  return tier;
}
