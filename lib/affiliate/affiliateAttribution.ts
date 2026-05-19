import { getAffiliateCampaignById } from "@/lib/affiliate/affiliateCampaigns";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export type AffiliateAttributionSource =
  | "affiliate_link"
  | "web_cookie_checkout"
  | "web_cookie_sol_checkout";

async function resolveCampaignIdForAffiliate(
  campaignId: string | null | undefined,
  affiliateId: string
): Promise<string | null> {
  const id = campaignId?.trim() || null;
  if (!id) return null;
  const campaign = await getAffiliateCampaignById(id);
  if (!campaign || campaign.affiliateId !== affiliateId.trim()) return null;
  return campaign.id;
}

export async function upsertAffiliateAttribution(input: {
  referredUserId: string;
  affiliateId: string;
  campaignId?: string | null;
  attributionSource?: AffiliateAttributionSource;
}): Promise<boolean> {
  const referred = input.referredUserId.trim();
  const affiliateId = input.affiliateId.trim();
  if (!referred || !affiliateId) return false;

  const db = getSupabaseAdmin();
  if (!db) return false;

  const campaignId = await resolveCampaignIdForAffiliate(input.campaignId, affiliateId);

  const { data: existing, error: readErr } = await db
    .from("affiliate_attributions")
    .select("affiliate_id, campaign_id")
    .eq("referred_user_id", referred)
    .maybeSingle();

  if (readErr) {
    console.error("[affiliateAttribution] read", readErr);
    return false;
  }

  if (existing && typeof existing === "object") {
    const patch: { campaign_id?: string; updated_at?: string } = {};
    const existingCampaign =
      typeof (existing as { campaign_id?: string | null }).campaign_id === "string"
        ? (existing as { campaign_id: string }).campaign_id
        : null;
    if (!existingCampaign && campaignId) {
      patch.campaign_id = campaignId;
    }
    if (Object.keys(patch).length === 0) return true;
    const { error: upErr } = await db
      .from("affiliate_attributions")
      .update(patch)
      .eq("referred_user_id", referred);
    if (upErr) {
      console.error("[affiliateAttribution] update campaign", upErr);
      return false;
    }
    return true;
  }

  const { error } = await db.from("affiliate_attributions").insert({
    referred_user_id: referred,
    affiliate_id: affiliateId,
    joined_at: Date.now(),
    attribution_source: input.attributionSource ?? "affiliate_link",
    campaign_id: campaignId,
  });

  if (error) {
    if (error.code === "23505" && campaignId) {
      const { error: upErr } = await db
        .from("affiliate_attributions")
        .update({ campaign_id: campaignId })
        .eq("referred_user_id", referred)
        .is("campaign_id", null);
      if (upErr) {
        console.error("[affiliateAttribution] race update campaign", upErr);
        return false;
      }
      return true;
    }
    console.error("[affiliateAttribution] insert", error);
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
