import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

const DAY_MS = 86_400_000;

export type SubscriptionPlanRow = {
  id: string;
  slug: string;
  label: string;
  duration_days: number;
  price_usd: number;
  discount_percent?: number | null;
  /** Stripe Price ID (`price_...`); recurring amount/interval live in Stripe. */
  stripe_price_id?: string | null;
};

export async function listActivePlans(): Promise<SubscriptionPlanRow[]> {
  const db = getSupabaseAdmin();
  if (!db) return [];
  const { data, error } = await db
    .from("subscription_plans")
    .select("id, slug, label, duration_days, price_usd, discount_percent, stripe_price_id")
    .eq("active", true)
    .order("sort_order", { ascending: true });
  if (error || !data) return [];
  return data as SubscriptionPlanRow[];
}

export async function getPlanBySlug(slug: string): Promise<SubscriptionPlanRow | null> {
  const db = getSupabaseAdmin();
  if (!db) return null;
  const { data, error } = await db
    .from("subscription_plans")
    .select("id, slug, label, duration_days, price_usd, discount_percent, stripe_price_id")
    .eq("slug", slug)
    .eq("active", true)
    .maybeSingle();
  if (error || !data) return null;
  return data as SubscriptionPlanRow;
}

export async function getSubscriptionEnd(discordId: string): Promise<string | null> {
  const db = getSupabaseAdmin();
  if (!db) return null;
  const { data, error } = await db
    .from("subscriptions")
    .select("current_period_end")
    .eq("discord_id", discordId)
    .maybeSingle();
  if (error || !data?.current_period_end) return null;
  return String(data.current_period_end);
}

export async function getSubscriptionStripeCustomerId(discordId: string): Promise<string | null> {
  const db = getSupabaseAdmin();
  if (!db) return null;
  const { data, error } = await db
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("discord_id", discordId.trim())
    .maybeSingle();
  if (error || !data) return null;
  const c = typeof data.stripe_customer_id === "string" ? data.stripe_customer_id.trim() : "";
  return c || null;
}

export async function getPlanIdByStripeSubscriptionId(subscriptionId: string): Promise<string | null> {
  const db = getSupabaseAdmin();
  if (!db) return null;
  const { data, error } = await db
    .from("subscriptions")
    .select("plan_id")
    .eq("stripe_subscription_id", subscriptionId.trim())
    .maybeSingle();
  if (error || !data?.plan_id) return null;
  const id = String(data.plan_id).trim();
  return id || null;
}

/**
 * Writes dashboard access window from Stripe (current_period_end) and stores Stripe ids.
 * Replaces any previous period for this Discord id — Stripe is the source of truth.
 */
export async function upsertSubscriptionFromStripe(input: {
  discordId: string;
  planId: string;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string;
  currentPeriodEndIso: string;
  stripeStatus: string;
}): Promise<boolean> {
  const db = getSupabaseAdmin();
  if (!db) return false;

  const { error } = await db.from("subscriptions").upsert(
    {
      discord_id: input.discordId.trim(),
      plan_id: input.planId.trim(),
      current_period_end: input.currentPeriodEndIso,
      status: "active",
      stripe_customer_id: input.stripeCustomerId?.trim() || null,
      stripe_subscription_id: input.stripeSubscriptionId.trim(),
      stripe_status: input.stripeStatus.slice(0, 64),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "discord_id" }
  );
  if (error) {
    console.error("[subscription] upsertSubscriptionFromStripe", error);
    return false;
  }
  return true;
}

export async function createInvoiceRow(input: {
  discordId: string;
  planId: string;
  referencePubkey: string;
  treasuryPubkey: string;
  lamports: bigint;
  solUsd: number;
  quoteExpiresAt: Date;
}): Promise<string | null> {
  const db = getSupabaseAdmin();
  if (!db) return null;
  const { data, error } = await db
    .from("payment_invoices")
    .insert({
      discord_id: input.discordId,
      plan_id: input.planId,
      reference_pubkey: input.referencePubkey,
      treasury_pubkey: input.treasuryPubkey,
      lamports: Number(input.lamports),
      sol_usd: input.solUsd,
      quote_expires_at: input.quoteExpiresAt.toISOString(),
      status: "pending",
    })
    .select("id")
    .single();
  if (error || !data?.id) {
    console.error("[subscription] createInvoiceRow", error);
    return null;
  }
  return String(data.id);
}

export type PendingInvoiceRow = {
  id: string;
  discord_id: string;
  plan_id: string;
  reference_pubkey: string;
  treasury_pubkey: string;
  lamports: number;
  quote_expires_at: string;
  status: string;
};

export async function getPendingInvoiceForDiscord(input: {
  discordId: string;
  invoiceId: string;
}): Promise<PendingInvoiceRow | null> {
  const db = getSupabaseAdmin();
  if (!db) return null;
  const { data, error } = await db
    .from("payment_invoices")
    .select("id, discord_id, plan_id, reference_pubkey, treasury_pubkey, lamports, quote_expires_at, status")
    .eq("id", input.invoiceId.trim())
    .eq("discord_id", input.discordId.trim())
    .eq("status", "pending")
    .maybeSingle();
  if (error || !data) return null;
  return data as PendingInvoiceRow;
}

export async function listPendingInvoices(): Promise<PendingInvoiceRow[]> {
  const db = getSupabaseAdmin();
  if (!db) return [];
  const now = new Date().toISOString();
  const { data, error } = await db
    .from("payment_invoices")
    .select("id, discord_id, plan_id, reference_pubkey, treasury_pubkey, lamports, quote_expires_at, status")
    .eq("status", "pending")
    .gt("quote_expires_at", now);
  if (error || !data) return [];
  return data as PendingInvoiceRow[];
}

export async function markInvoicePaid(input: {
  invoiceId: string;
  txSignature: string;
  payerPubkey: string;
}): Promise<boolean> {
  const db = getSupabaseAdmin();
  if (!db) return false;
  const paidAt = new Date().toISOString();
  const { data, error } = await db
    .from("payment_invoices")
    .update({
      status: "paid",
      tx_signature: input.txSignature,
      payer_pubkey: input.payerPubkey,
      paid_at: paidAt,
    })
    .eq("id", input.invoiceId)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();
  if (error) {
    console.error("[subscription] markInvoicePaid", error);
    return false;
  }
  return Boolean(data?.id);
}

export async function getPlanDurationDays(planId: string): Promise<number | null> {
  const db = getSupabaseAdmin();
  if (!db) return null;
  const { data, error } = await db
    .from("subscription_plans")
    .select("duration_days")
    .eq("id", planId)
    .maybeSingle();
  if (error || !data?.duration_days) return null;
  return Number(data.duration_days);
}

export async function upsertSubscriptionAfterPayment(input: {
  discordId: string;
  planId: string;
  durationDays: number;
}): Promise<boolean> {
  const db = getSupabaseAdmin();
  if (!db) return false;

  const { data: existing } = await db
    .from("subscriptions")
    .select("current_period_end")
    .eq("discord_id", input.discordId)
    .maybeSingle();

  const now = Date.now();
  const base =
    existing?.current_period_end && new Date(String(existing.current_period_end)).getTime() > now
      ? new Date(String(existing.current_period_end))
      : new Date();
  const end = new Date(base.getTime() + input.durationDays * DAY_MS);

  const { error } = await db.from("subscriptions").upsert(
    {
      discord_id: input.discordId,
      plan_id: input.planId,
      current_period_end: end.toISOString(),
      status: "active",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "discord_id" }
  );
  if (error) {
    console.error("[subscription] upsertSubscriptionAfterPayment", error);
    return false;
  }
  return true;
}

/**
 * Extend an existing subscription by N days. Creates a row if none exists.
 * Does not change the user's plan_id (unless it must create the row).
 */
export async function extendSubscriptionDays(input: {
  discordId: string;
  days: number;
  fallbackPlanId?: string | null;
}): Promise<boolean> {
  const db = getSupabaseAdmin();
  if (!db) return false;

  const days = Math.max(0, Math.floor(input.days));
  if (!Number.isFinite(days) || days <= 0) return false;

  const discordId = input.discordId.trim();
  if (!discordId) return false;

  const { data: existing, error: selErr } = await db
    .from("subscriptions")
    .select("discord_id, plan_id, current_period_end")
    .eq("discord_id", discordId)
    .maybeSingle();
  if (selErr) {
    console.error("[subscription] extendSubscriptionDays select", selErr);
    return false;
  }

  const now = Date.now();
  const base =
    existing?.current_period_end && new Date(String(existing.current_period_end)).getTime() > now
      ? new Date(String(existing.current_period_end))
      : new Date();
  const end = new Date(base.getTime() + days * DAY_MS);

  const planId =
    typeof existing?.plan_id === "string" && existing.plan_id.trim()
      ? existing.plan_id.trim()
      : input.fallbackPlanId?.trim() || null;

  if (!planId) {
    console.error("[subscription] extendSubscriptionDays missing plan_id");
    return false;
  }

  const { error } = await db.from("subscriptions").upsert(
    {
      discord_id: discordId,
      plan_id: planId,
      current_period_end: end.toISOString(),
      status: "active",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "discord_id" }
  );
  if (error) {
    console.error("[subscription] extendSubscriptionDays upsert", error);
    return false;
  }
  return true;
}

export async function expireStaleInvoices(): Promise<void> {
  const db = getSupabaseAdmin();
  if (!db) return;
  const now = new Date().toISOString();
  await db
    .from("payment_invoices")
    .update({ status: "expired" })
    .eq("status", "pending")
    .lt("quote_expires_at", now);
}
