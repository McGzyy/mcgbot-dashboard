import { isReferredUserSubscriptionActive } from "@/lib/affiliate/affiliateReferralLedger";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

type PendingRow = {
  id: string;
  kind: string;
  referred_user_id: string | null;
};

/**
 * Promote pending rev-share and annual signup bonuses to approved when the hold
 * period has passed and the referred member is still subscribed.
 */
export async function approveEligibleAffiliateCommissions(): Promise<{ approved: number }> {
  const db = getSupabaseAdmin();
  if (!db) return { approved: 0 };

  const nowIso = new Date().toISOString();
  const { data: rows, error } = await db
    .from("affiliate_commissions")
    .select("id, kind, referred_user_id")
    .eq("status", "pending")
    .lte("eligible_at", nowIso)
    .in("kind", ["revshare", "annual_signup_bonus"])
    .limit(200);

  if (error || !Array.isArray(rows)) {
    if (error) console.error("[affiliateCommissionApproval] select", error);
    return { approved: 0 };
  }

  let approved = 0;
  for (const raw of rows as PendingRow[]) {
    const id = typeof raw.id === "string" ? raw.id : "";
    if (!id) continue;

    const referred =
      typeof raw.referred_user_id === "string" ? raw.referred_user_id.trim() : "";
    if (!referred) continue;

    const active = await isReferredUserSubscriptionActive(referred);
    if (!active) continue;

    const { data: upd, error: upErr } = await db
      .from("affiliate_commissions")
      .update({ status: "approved", updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("status", "pending")
      .select("id");

    if (upErr) {
      console.error("[affiliateCommissionApproval] update", upErr);
      continue;
    }
    if (Array.isArray(upd) && upd.length > 0) approved += 1;
  }

  return { approved };
}
