import { generateUniqueReferralCode, normalizeReferralCode } from "@/lib/affiliate/affiliateReferralCode";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { isValidAffiliateSlug, normalizeAffiliateSlug } from "@/lib/affiliate/affiliateSlug";

export type AffiliateCampaignRow = {
  id: string;
  affiliateId: string;
  slug: string;
  name: string;
  linkCode: string | null;
  createdAt: string;
};

export type AffiliateCampaignWithStats = AffiliateCampaignRow & {
  clickCount: number;
  signupCount: number;
  payingCount: number;
};

function mapCampaignRow(data: Record<string, unknown>): AffiliateCampaignRow | null {
  const id = typeof data.id === "string" ? data.id : "";
  const affiliateId = typeof data.affiliate_id === "string" ? data.affiliate_id : "";
  const slug = typeof data.slug === "string" ? data.slug.trim().toLowerCase() : "";
  const name = typeof data.name === "string" ? data.name.trim() : "";
  if (!id || !affiliateId || !slug || !name) return null;
  return {
    id,
    affiliateId,
    slug,
    name,
    linkCode:
      typeof data.link_code === "string" && data.link_code.trim()
        ? normalizeReferralCode(data.link_code)
        : null,
    createdAt: typeof data.created_at === "string" ? data.created_at : "",
  };
}

export async function listAffiliateCampaigns(affiliateId: string): Promise<AffiliateCampaignRow[]> {
  const db = getSupabaseAdmin();
  if (!db) return [];
  const { data, error } = await db
    .from("affiliate_campaigns")
    .select("id, affiliate_id, slug, name, link_code, created_at")
    .eq("affiliate_id", affiliateId.trim())
    .order("created_at", { ascending: false })
    .limit(50);
  if (error || !Array.isArray(data)) return [];
  return data
    .map((r) => mapCampaignRow(r as Record<string, unknown>))
    .filter((r): r is AffiliateCampaignRow => Boolean(r));
}

export async function getAffiliateCampaignById(
  campaignId: string
): Promise<AffiliateCampaignRow | null> {
  const db = getSupabaseAdmin();
  if (!db) return null;
  const id = campaignId.trim();
  if (!id) return null;
  const { data, error } = await db
    .from("affiliate_campaigns")
    .select("id, affiliate_id, slug, name, link_code, created_at")
    .eq("id", id)
    .maybeSingle();
  if (error || !data || typeof data !== "object") return null;
  return mapCampaignRow(data as Record<string, unknown>);
}

export async function getAffiliateCampaignByLinkCode(
  linkCode: string
): Promise<AffiliateCampaignRow | null> {
  const db = getSupabaseAdmin();
  if (!db) return null;
  const code = normalizeReferralCode(linkCode);
  if (!code) return null;
  const { data, error } = await db
    .from("affiliate_campaigns")
    .select("id, affiliate_id, slug, name, link_code, created_at")
    .eq("link_code", code)
    .maybeSingle();
  if (error || !data || typeof data !== "object") return null;
  return mapCampaignRow(data as Record<string, unknown>);
}

export async function ensureAffiliateCampaignLinkCode(campaignId: string): Promise<string | null> {
  const db = getSupabaseAdmin();
  if (!db) return null;
  const { data, error } = await db
    .from("affiliate_campaigns")
    .select("id, affiliate_id, slug, name, link_code, created_at")
    .eq("id", campaignId.trim())
    .maybeSingle();
  if (error || !data) return null;
  const row = mapCampaignRow(data as Record<string, unknown>);
  if (!row) return null;
  if (row.linkCode) return row.linkCode;

  const linkCode = await generateUniqueReferralCode();
  const { error: upErr } = await db
    .from("affiliate_campaigns")
    .update({ link_code: linkCode })
    .eq("id", row.id);
  if (upErr) {
    console.error("[affiliateCampaigns] ensureAffiliateCampaignLinkCode", upErr);
    return null;
  }
  return linkCode;
}

export async function getAffiliateCampaignBySlug(
  affiliateId: string,
  campaignSlug: string
): Promise<AffiliateCampaignRow | null> {
  const db = getSupabaseAdmin();
  if (!db) return null;
  const slug = normalizeAffiliateSlug(campaignSlug);
  if (!slug) return null;
  const { data, error } = await db
    .from("affiliate_campaigns")
    .select("id, affiliate_id, slug, name, link_code, created_at")
    .eq("affiliate_id", affiliateId.trim())
    .eq("slug", slug)
    .maybeSingle();
  if (error || !data || typeof data !== "object") return null;
  return mapCampaignRow(data as Record<string, unknown>);
}

export async function createAffiliateCampaign(input: {
  affiliateId: string;
  slug: string;
  name: string;
}): Promise<{ ok: true; campaign: AffiliateCampaignRow } | { ok: false; error: string }> {
  const affiliateId = input.affiliateId.trim();
  const slug = normalizeAffiliateSlug(input.slug);
  const name = input.name.trim();
  if (!affiliateId) return { ok: false, error: "Invalid affiliate." };
  if (!isValidAffiliateSlug(slug)) {
    return { ok: false, error: "Campaign slug must be 3–30 characters (letters, numbers, hyphens)." };
  }
  if (name.length < 2 || name.length > 80) {
    return { ok: false, error: "Campaign name must be 2–80 characters." };
  }

  const db = getSupabaseAdmin();
  if (!db) return { ok: false, error: "Database not configured." };

  const { count } = await db
    .from("affiliate_campaigns")
    .select("*", { count: "exact", head: true })
    .eq("affiliate_id", affiliateId);
  if ((count ?? 0) >= 30) {
    return { ok: false, error: "Maximum 30 campaigns per affiliate." };
  }

  const linkCode = await generateUniqueReferralCode();

  const { data, error } = await db
    .from("affiliate_campaigns")
    .insert({ affiliate_id: affiliateId, slug, name, link_code: linkCode })
    .select("id, affiliate_id, slug, name, link_code, created_at")
    .single();

  if (error) {
    if (error.code === "23505") return { ok: false, error: "That campaign slug is already in use." };
    console.error("[affiliateCampaigns] create", error);
    return { ok: false, error: "Could not create campaign." };
  }

  const campaign = mapCampaignRow(data as Record<string, unknown>);
  if (!campaign) return { ok: false, error: "Could not read created campaign." };
  return { ok: true, campaign };
}

export async function countClicksByCampaignId(
  affiliateId: string
): Promise<Map<string, number>> {
  const db = getSupabaseAdmin();
  const out = new Map<string, number>();
  if (!db) return out;

  const { data, error } = await db
    .from("affiliate_link_clicks")
    .select("campaign_id")
    .eq("affiliate_id", affiliateId.trim())
    .not("campaign_id", "is", null);

  if (error || !Array.isArray(data)) return out;
  for (const row of data as { campaign_id?: string | null }[]) {
    const id = typeof row.campaign_id === "string" ? row.campaign_id : "";
    if (!id) continue;
    out.set(id, (out.get(id) ?? 0) + 1);
  }
  return out;
}

export async function countAttributionsByCampaignId(
  affiliateId: string
): Promise<{ signups: Map<string, number>; paying: Map<string, number> }> {
  const db = getSupabaseAdmin();
  const signups = new Map<string, number>();
  const paying = new Map<string, number>();
  if (!db) return { signups, paying };

  const { data, error } = await db
    .from("affiliate_attributions")
    .select("campaign_id, payment_count")
    .eq("affiliate_id", affiliateId.trim())
    .not("campaign_id", "is", null);

  if (error || !Array.isArray(data)) return { signups, paying };

  for (const row of data as { campaign_id?: string | null; payment_count?: unknown }[]) {
    const id = typeof row.campaign_id === "string" ? row.campaign_id : "";
    if (!id) continue;
    signups.set(id, (signups.get(id) ?? 0) + 1);
    const payments = Math.floor(Number(row.payment_count)) || 0;
    if (payments > 0) paying.set(id, (paying.get(id) ?? 0) + 1);
  }
  return { signups, paying };
}

export async function listAffiliateCampaignsWithStats(
  affiliateId: string
): Promise<AffiliateCampaignWithStats[]> {
  const campaigns = await listAffiliateCampaigns(affiliateId);
  const clicks = await countClicksByCampaignId(affiliateId);
  const { signups, paying } = await countAttributionsByCampaignId(affiliateId);
  return campaigns.map((c) => ({
    ...c,
    clickCount: clicks.get(c.id) ?? 0,
    signupCount: signups.get(c.id) ?? 0,
    payingCount: paying.get(c.id) ?? 0,
  }));
}
