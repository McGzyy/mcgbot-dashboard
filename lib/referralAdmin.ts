import { getReferralPerformanceForOwner } from "@/lib/referralPerformance";
import {
  getReferralCreditBalanceCents,
  getReferralRewardSummaryForOwner,
} from "@/lib/referralRewards";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { isValidDiscordSnowflake } from "@/lib/subscription/exemptAllowlistDb";

export type ReferralAdminRewardRow = {
  id: string;
  status: string;
  creditCents: number;
  paymentAmountCents: number | null;
  referredUserId: string;
  source: string | null;
  stripeInvoiceId: string | null;
  availableAt: string | null;
  createdAt: string | null;
};

export type ReferralAdminSnapshot = {
  ownerDiscordId: string;
  displayName: string | null;
  referralSlug: string | null;
  rewardSummary: NonNullable<Awaited<ReturnType<typeof getReferralRewardSummaryForOwner>>>;
  balanceCents: number;
  referrals: Array<{
    referredUserId: string;
    joinedAt: number;
    attributionSource: string | null;
    displayName: string | null;
  }>;
  recentRewards: ReferralAdminRewardRow[];
  performance: Awaited<ReturnType<typeof getReferralPerformanceForOwner>>;
};

export async function resolveOwnerDiscordIdFromQuery(raw: string): Promise<string | null> {
  const q = raw.trim();
  if (!q) return null;
  if (isValidDiscordSnowflake(q)) return q;

  const slug = q.toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$/.test(slug)) return null;

  const db = getSupabaseAdmin();
  if (!db) return null;
  const { data } = await db.from("users").select("discord_id").eq("referral_slug", slug).maybeSingle();
  if (!data || typeof data !== "object") return null;
  const id = typeof (data as { discord_id?: string }).discord_id === "string"
    ? (data as { discord_id: string }).discord_id.trim()
    : "";
  return isValidDiscordSnowflake(id) ? id : null;
}

export async function getReferralAdminSnapshot(ownerDiscordId: string): Promise<ReferralAdminSnapshot | null> {
  const owner = ownerDiscordId.trim();
  if (!isValidDiscordSnowflake(owner)) return null;

  const db = getSupabaseAdmin();
  if (!db) return null;

  const [{ data: userRow }, { data: refRows }, { data: rewardRows }] = await Promise.all([
    db.from("users").select("discord_display_name, referral_slug").eq("discord_id", owner).maybeSingle(),
    db.from("referrals").select("referred_user_id, joined_at, attribution_source").eq("owner_discord_id", owner),
    db
      .from("referral_rewards")
      .select(
        "id, status, credit_cents, payment_amount_cents, referred_user_id, source, stripe_invoice_id, available_at, created_at"
      )
      .eq("owner_discord_id", owner)
      .order("created_at", { ascending: false })
      .limit(80),
  ]);

  const displayName =
    userRow && typeof userRow === "object" && typeof (userRow as { discord_display_name?: string }).discord_display_name === "string"
      ? String((userRow as { discord_display_name: string }).discord_display_name).trim() || null
      : null;
  const referralSlug =
    userRow && typeof userRow === "object" && typeof (userRow as { referral_slug?: string }).referral_slug === "string"
      ? String((userRow as { referral_slug: string }).referral_slug).trim().toLowerCase() || null
      : null;

  const referredIds = Array.from(
    new Set(
      (Array.isArray(refRows) ? refRows : [])
        .map((r) => String((r as { referred_user_id?: string }).referred_user_id ?? "").trim())
        .filter(Boolean)
    )
  );

  const usersById: Record<string, string | null> = {};
  if (referredIds.length > 0) {
    const { data: users } = await db
      .from("users")
      .select("discord_id, discord_display_name")
      .in("discord_id", referredIds);
    if (Array.isArray(users)) {
      for (const u of users as { discord_id?: string; discord_display_name?: string }[]) {
        const id = String(u.discord_id ?? "").trim();
        if (!id) continue;
        usersById[id] =
          typeof u.discord_display_name === "string" && u.discord_display_name.trim()
            ? u.discord_display_name.trim()
            : null;
      }
    }
  }

  const referrals = (Array.isArray(refRows) ? refRows : []).map((r) => {
    const referredUserId = String((r as { referred_user_id?: string }).referred_user_id ?? "").trim();
    const joinedAt = Number((r as { joined_at?: unknown }).joined_at);
    return {
      referredUserId,
      joinedAt: Number.isFinite(joinedAt) ? joinedAt : 0,
      attributionSource:
        typeof (r as { attribution_source?: string }).attribution_source === "string"
          ? (r as { attribution_source: string }).attribution_source
          : null,
      displayName: usersById[referredUserId] ?? null,
    };
  });

  const recentRewards: ReferralAdminRewardRow[] = (Array.isArray(rewardRows) ? rewardRows : []).map((r) => ({
    id: String((r as { id?: string }).id ?? ""),
    status: String((r as { status?: string }).status ?? ""),
    creditCents: Math.floor(Number((r as { credit_cents?: unknown }).credit_cents)) || 0,
    paymentAmountCents: Number.isFinite(Number((r as { payment_amount_cents?: unknown }).payment_amount_cents))
      ? Math.floor(Number((r as { payment_amount_cents: number }).payment_amount_cents))
      : null,
    referredUserId: String((r as { referred_user_id?: string }).referred_user_id ?? ""),
    source: typeof (r as { source?: string }).source === "string" ? (r as { source: string }).source : null,
    stripeInvoiceId:
      typeof (r as { stripe_invoice_id?: string }).stripe_invoice_id === "string"
        ? (r as { stripe_invoice_id: string }).stripe_invoice_id
        : null,
    availableAt:
      typeof (r as { available_at?: string }).available_at === "string"
        ? (r as { available_at: string }).available_at
        : null,
    createdAt:
      typeof (r as { created_at?: string }).created_at === "string" ? (r as { created_at: string }).created_at : null,
  }));

  const rewardSummary = await getReferralRewardSummaryForOwner(owner);
  if (!rewardSummary) return null;

  const balanceCents = await getReferralCreditBalanceCents(owner);
  const performance = await getReferralPerformanceForOwner(owner);

  return {
    ownerDiscordId: owner,
    displayName,
    referralSlug,
    rewardSummary,
    balanceCents,
    referrals: referrals.sort((a, b) => b.joinedAt - a.joinedAt),
    recentRewards,
    performance,
  };
}
