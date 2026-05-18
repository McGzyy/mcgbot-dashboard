import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export type AffiliateAttributionSource =
  | "affiliate_link"
  | "web_cookie_checkout"
  | "web_cookie_sol_checkout";

export async function upsertAffiliateAttribution(input: {
  referredUserId: string;
  affiliateId: string;
  attributionSource?: AffiliateAttributionSource;
}): Promise<boolean> {
  const referred = input.referredUserId.trim();
  const affiliateId = input.affiliateId.trim();
  if (!referred || !affiliateId) return false;

  const db = getSupabaseAdmin();
  if (!db) return false;

  const { error } = await db.from("affiliate_attributions").upsert(
    {
      referred_user_id: referred,
      affiliate_id: affiliateId,
      joined_at: Date.now(),
      attribution_source: input.attributionSource ?? "affiliate_link",
    },
    { onConflict: "referred_user_id" }
  );
  if (error) {
    console.error("[affiliateAttribution] upsert", error);
    return false;
  }
  return true;
}

export async function getAffiliateIdForReferredUser(referredUserId: string): Promise<string | null> {
  const referred = referredUserId.trim();
  if (!referred) return null;
  const db = getSupabaseAdmin();
  if (!db) return null;
  const { data, error } = await db
    .from("affiliate_attributions")
    .select("affiliate_id")
    .eq("referred_user_id", referred)
    .maybeSingle();
  if (error || !data || typeof data !== "object") return null;
  const id = typeof (data as { affiliate_id?: string }).affiliate_id === "string"
    ? (data as { affiliate_id: string }).affiliate_id.trim()
    : "";
  return id || null;
}
