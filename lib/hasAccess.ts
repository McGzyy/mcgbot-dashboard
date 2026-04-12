import { createClient } from "@supabase/supabase-js";
import { getUserTier } from "@/lib/getUserTier";

type FeatureRow = {
  free: boolean;
  pro: boolean;
  elite: boolean;
};

function tierAllows(row: FeatureRow, tier: string): boolean {
  const t = tier.toLowerCase().trim();
  if (t === "elite") return Boolean(row.elite);
  if (t === "pro") return Boolean(row.pro);
  if (t === "free") return Boolean(row.free);
  return false;
}

/**
 * Returns whether the user's tier is allowed for a feature.
 * Unknown feature_key, missing row, or missing env → false.
 */
export async function hasAccess(
  discordId: string,
  featureKey: string
): Promise<boolean> {
  const key = String(featureKey ?? "").trim();
  if (!key) return false;

  const tier = await getUserTier(discordId);

  const url = process.env.SUPABASE_URL;
  const anon = process.env.SUPABASE_ANON_KEY;
  if (!url || !anon) return false;

  const supabase = createClient(url, anon);

  const { data, error } = await supabase
    .from("feature_access")
    .select("free, pro, elite")
    .eq("feature_key", key)
    .maybeSingle();

  if (error || !data) return false;

  return tierAllows(data as FeatureRow, tier);
}
