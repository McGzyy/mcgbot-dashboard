import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export async function recordAffiliateLinkClick(input: {
  affiliateId: string;
  campaignId?: string | null;
  referrer?: string | null;
  landingPath?: string | null;
}): Promise<boolean> {
  const affiliateId = input.affiliateId.trim();
  if (!affiliateId) return false;

  const db = getSupabaseAdmin();
  if (!db) return false;

  const referrer =
    typeof input.referrer === "string" && input.referrer.trim()
      ? input.referrer.trim().slice(0, 2000)
      : null;
  const landingPath =
    typeof input.landingPath === "string" && input.landingPath.trim()
      ? input.landingPath.trim().slice(0, 500)
      : null;

  const { error } = await db.from("affiliate_link_clicks").insert({
    affiliate_id: affiliateId,
    campaign_id: input.campaignId?.trim() || null,
    clicked_at: Date.now(),
    referrer,
    landing_path: landingPath,
  });

  if (error) {
    console.error("[affiliateLinkClicks] record", error);
    return false;
  }
  return true;
}

export async function countAffiliateLinkClicks(
  affiliateId: string,
  options?: { campaignId?: string | null; sinceMs?: number }
): Promise<number> {
  const db = getSupabaseAdmin();
  if (!db) return 0;

  let q = db
    .from("affiliate_link_clicks")
    .select("*", { count: "exact", head: true })
    .eq("affiliate_id", affiliateId.trim());

  if (options?.campaignId) {
    q = q.eq("campaign_id", options.campaignId);
  } else if (options?.campaignId === null) {
    q = q.is("campaign_id", null);
  }

  if (options?.sinceMs && Number.isFinite(options.sinceMs)) {
    q = q.gte("clicked_at", Math.floor(options.sinceMs));
  }

  const { count } = await q;
  return count ?? 0;
}
