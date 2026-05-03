import { Connection, LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import { getStripe } from "@/lib/subscription/stripeServer";
import { solanaRpcUrlServer } from "@/lib/solanaEnv";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { tipsTreasuryPubkeyFromEnv } from "@/lib/tipsConfig";

export type TreasurySolWalletSnapshot = {
  role: "tips" | "membership";
  envVar: string;
  address: string | null;
  lamports: number | null;
  sol: string | null;
  error?: string;
};

export type MembershipActivityRow = {
  at: string;
  eventType: string;
  discordId: string;
  planLabel: string | null;
  amountSol: string | null;
  amountUsd: string | null;
  signature: string | null;
  stripeCheckoutSessionId: string | null;
  stripeInvoiceId: string | null;
};

export type TipActivityRow = {
  at: string;
  discordId: string;
  amountSol: string;
  signature: string | null;
};

export type StripeBalanceSnapshot = {
  configured: boolean;
  /** From secret key mode — opens correct Stripe Dashboard (test vs live). */
  dashboardBaseUrl: string | null;
  error?: string;
  availableUsd: string | null;
  pendingUsd: string | null;
  /** Sum of balance transaction `amount` (net to Stripe balance, cents) in last 30d */
  last30dNetCents: number | null;
  /** Sum of Stripe fees (cents) in last 30d */
  last30dFeesCents: number | null;
  recent: {
    id: string;
    created: number;
    type: string;
    description: string | null;
    amountCents: number;
    feeCents: number;
    currency: string;
    status: string;
  }[];
};

export type TreasuryHubSnapshot = {
  success: true;
  generatedAt: string;
  solWallets: TreasurySolWalletSnapshot[];
  membershipByChannel: {
    stripeBilling: number | null;
    sol: number | null;
    /** Active access without a Stripe Billing subscription id (complimentary / voucher-style / legacy). */
    complimentaryOrNonBilling: number | null;
    error?: string;
  };
  activeByPlan: { slug: string; label: string; count: number | null }[];
  voucherPool: {
    activeCodes: number | null;
    codesWithUsesRemaining: number | null;
    totalUsesRemaining: number | null;
    error?: string;
  };
  membershipActivity: MembershipActivityRow[];
  membershipActivityError?: string;
  tipsActivity: TipActivityRow[];
  tipsActivityError?: string;
  tipsTotals30d: { confirmedTips: number | null; solSum: string | null; error?: string };
  stripe: StripeBalanceSnapshot;
};

function membershipTreasuryFromEnv(): string | null {
  return (process.env.SOLANA_MEMBERSHIP_TREASURY_PUBKEY ?? "").trim() || null;
}

async function fetchSolBalance(address: string | null, role: TreasurySolWalletSnapshot["role"], envVar: string) {
  const base: TreasurySolWalletSnapshot = { role, envVar, address, lamports: null, sol: null };
  if (!address) return base;
  try {
    const conn = new Connection(solanaRpcUrlServer(), "confirmed");
    const pk = new PublicKey(address);
    const lamports = await conn.getBalance(pk);
    const sol = lamports / LAMPORTS_PER_SOL;
    return {
      ...base,
      lamports,
      sol: sol.toLocaleString(undefined, { maximumFractionDigits: 6 }),
    };
  } catch (e) {
    return {
      ...base,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

export async function loadTreasuryHubSnapshot(): Promise<TreasuryHubSnapshot> {
  const generatedAt = new Date().toISOString();
  const db = getSupabaseAdmin();

  const tipsAddr = tipsTreasuryPubkeyFromEnv();
  const memAddr = membershipTreasuryFromEnv();
  const [tipsBal, memBal] = await Promise.all([
    fetchSolBalance(tipsAddr, "tips", "SOLANA_TIPS_TREASURY_PUBKEY / SOLANA_TREASURY_PUBKEY"),
    fetchSolBalance(memAddr, "membership", "SOLANA_MEMBERSHIP_TREASURY_PUBKEY"),
  ]);
  const solWallets = [tipsBal, memBal];

  const emptyStripe: StripeBalanceSnapshot = {
    configured: false,
    dashboardBaseUrl: null,
    availableUsd: null,
    pendingUsd: null,
    last30dNetCents: null,
    last30dFeesCents: null,
    recent: [],
  };

  const stripe = getStripe();
  const stripeSecret = (process.env.STRIPE_SECRET_KEY ?? "").trim();
  const stripeDashboardBase = stripeSecret
    ? stripeSecret.startsWith("sk_test")
      ? "https://dashboard.stripe.com/test"
      : "https://dashboard.stripe.com"
    : null;

  let stripeSnap: StripeBalanceSnapshot = { ...emptyStripe };
  if (stripe) {
    stripeSnap = { ...emptyStripe, configured: true, dashboardBaseUrl: stripeDashboardBase };
    try {
      const bal = await stripe.balance.retrieve();
      const usdAvail = bal.available.find((x) => x.currency === "usd");
      const usdPend = bal.pending.find((x) => x.currency === "usd");
      stripeSnap.availableUsd =
        usdAvail != null ? (usdAvail.amount / 100).toLocaleString(undefined, { style: "currency", currency: "USD" }) : null;
      stripeSnap.pendingUsd =
        usdPend != null ? (usdPend.amount / 100).toLocaleString(undefined, { style: "currency", currency: "USD" }) : null;

      const since = Math.floor(Date.now() / 1000) - 30 * 86400;
      const txs = await stripe.balanceTransactions.list({ limit: 100, created: { gte: since } });
      let netCents = 0;
      let feeCents = 0;
      for (const t of txs.data) {
        if (t.currency !== "usd") continue;
        netCents += t.amount;
        feeCents += t.fee;
      }
      stripeSnap.last30dNetCents = netCents;
      stripeSnap.last30dFeesCents = feeCents;

      const recentFull = await stripe.balanceTransactions.list({ limit: 15 });
      stripeSnap.recent = recentFull.data.map((t) => ({
        id: t.id,
        created: t.created,
        type: t.type,
        description: t.description ?? null,
        amountCents: t.amount,
        feeCents: t.fee,
        currency: t.currency,
        status: t.status,
      }));
    } catch (e) {
      stripeSnap.error = e instanceof Error ? e.message : String(e);
    }
  }

  if (!db) {
    return {
      success: true,
      generatedAt,
      solWallets,
      membershipByChannel: {
        stripeBilling: null,
        sol: null,
        complimentaryOrNonBilling: null,
        error: "Supabase admin not configured",
      },
      activeByPlan: [],
      voucherPool: { activeCodes: null, codesWithUsesRemaining: null, totalUsesRemaining: null, error: "Supabase admin not configured" },
      membershipActivity: [],
      membershipActivityError: "Supabase admin not configured",
      tipsActivity: [],
      tipsActivityError: "Supabase admin not configured",
      tipsTotals30d: { confirmedTips: null, solSum: null, error: "Supabase admin not configured" },
      stripe: stripeSnap,
    };
  }

  const nowIso = new Date().toISOString();
  const since30 = new Date(Date.now() - 30 * 86400000).toISOString();

  let membershipByChannel: TreasuryHubSnapshot["membershipByChannel"] = {
    stripeBilling: null,
    sol: null,
    complimentaryOrNonBilling: null,
  };
  try {
    const base = () =>
      db.from("subscriptions").select("*", { count: "exact", head: true }).eq("status", "active").gt("current_period_end", nowIso);

    const { count: stripeBilling, error: e1 } = await base().not("stripe_subscription_id", "is", null);
    if (e1) throw e1;

    const { count: solCh, error: e2 } = await base().eq("payment_channel", "sol");
    if (e2) throw e2;

    const { count: comp, error: e3 } = await base().is("stripe_subscription_id", null).neq("payment_channel", "sol");
    if (e3) throw e3;

    membershipByChannel = {
      stripeBilling: stripeBilling ?? null,
      sol: solCh ?? null,
      complimentaryOrNonBilling: comp ?? null,
    };
  } catch (e) {
    membershipByChannel = {
      stripeBilling: null,
      sol: null,
      complimentaryOrNonBilling: null,
      error: e instanceof Error ? e.message : "subscriptions query failed",
    };
  }

  let activeByPlan: TreasuryHubSnapshot["activeByPlan"] = [];
  try {
    const { data: plans, error: pe } = await db.from("subscription_plans").select("id, slug, label").eq("active", true);
    if (pe) throw pe;
    const planList = (plans || []) as { id: string; slug: string; label: string }[];
    for (const p of planList) {
      const { count, error: pc } = await db
        .from("subscriptions")
        .select("*", { count: "exact", head: true })
        .eq("plan_id", p.id)
        .eq("status", "active")
        .gt("current_period_end", nowIso);
      activeByPlan.push({ slug: p.slug, label: p.label, count: pc ? null : count ?? 0 });
    }
  } catch {
    activeByPlan = [];
  }

  let voucherPool: TreasuryHubSnapshot["voucherPool"] = {
    activeCodes: null,
    codesWithUsesRemaining: null,
    totalUsesRemaining: null,
  };
  try {
    const { count: activeCodes, error: v1 } = await db
      .from("vouchers")
      .select("*", { count: "exact", head: true })
      .eq("active", true);
    if (v1) throw v1;
    const { count: withUses, error: v2 } = await db
      .from("vouchers")
      .select("*", { count: "exact", head: true })
      .eq("active", true)
      .gt("uses_remaining", 0);
    if (v2) throw v2;
    const { data: usesRows, error: v3 } = await db.from("vouchers").select("uses_remaining").eq("active", true);
    if (v3) throw v3;
    let totalUses = 0;
    for (const r of usesRows || []) {
      const u = Number((r as { uses_remaining?: unknown }).uses_remaining);
      if (Number.isFinite(u) && u > 0) totalUses += u;
    }
    voucherPool = {
      activeCodes: activeCodes ?? null,
      codesWithUsesRemaining: withUses ?? null,
      totalUsesRemaining: totalUses,
    };
  } catch (e) {
    voucherPool = {
      activeCodes: null,
      codesWithUsesRemaining: null,
      totalUsesRemaining: null,
      error: e instanceof Error ? e.message : "vouchers query failed",
    };
  }

  let membershipActivity: MembershipActivityRow[] = [];
  let membershipActivityError: string | undefined;
  try {
    const { data: ev, error: ie } = await db
      .from("membership_events")
      .select(
        "created_at, discord_id, event_type, plan_id, amount_sol, amount_cents, tx_signature, stripe_checkout_session_id, stripe_invoice_id"
      )
      .order("created_at", { ascending: false })
      .limit(60);
    if (ie) throw ie;
    const planIds = [...new Set((ev || []).map((r) => String((r as { plan_id?: string }).plan_id || "")).filter(Boolean))];
    const labelByPlanId = new Map<string, string>();
    if (planIds.length) {
      const { data: pls } = await db.from("subscription_plans").select("id, label").in("id", planIds);
      for (const p of pls || []) {
        const row = p as { id: string; label: string };
        labelByPlanId.set(row.id, row.label);
      }
    }
    membershipActivity = (ev || []).map((raw) => {
      const r = raw as {
        created_at: string;
        discord_id: string;
        event_type: string;
        plan_id: string | null;
        amount_sol: number | string | null;
        amount_cents: number | null;
        tx_signature: string | null;
        stripe_checkout_session_id: string | null;
        stripe_invoice_id: string | null;
      };
      const solN = r.amount_sol != null ? Number(r.amount_sol) : NaN;
      const amountSol =
        Number.isFinite(solN) && solN > 0 ? solN.toFixed(6) : null;
      const cents = r.amount_cents != null ? Number(r.amount_cents) : NaN;
      const amountUsd =
        Number.isFinite(cents) && r.amount_cents != null
          ? (cents / 100).toLocaleString(undefined, { style: "currency", currency: "USD" })
          : null;
      return {
        at: r.created_at,
        eventType: String(r.event_type || "unknown"),
        discordId: r.discord_id,
        planLabel: r.plan_id ? labelByPlanId.get(r.plan_id) ?? null : null,
        amountSol,
        amountUsd,
        signature: r.tx_signature,
        stripeCheckoutSessionId: r.stripe_checkout_session_id,
        stripeInvoiceId: r.stripe_invoice_id?.trim() || null,
      };
    });
  } catch (e) {
    membershipActivity = [];
    membershipActivityError = e instanceof Error ? e.message : "membership_events query failed";
  }

  let tipsActivity: TipActivityRow[] = [];
  let tipsActivityError: string | undefined;
  let tipsTotals30d: TreasuryHubSnapshot["tipsTotals30d"] = { confirmedTips: null, solSum: null };
  try {
    const { data: tips, error: te } = await db
      .from("bot_tips")
      .select("confirmed_at, discord_id, amount_sol, signature")
      .eq("status", "confirmed")
      .not("confirmed_at", "is", null)
      .order("confirmed_at", { ascending: false })
      .limit(30);
    if (te) throw te;
    tipsActivity = (tips || []).map((raw) => {
      const r = raw as {
        confirmed_at: string;
        discord_id: string;
        amount_sol: unknown;
        signature: string | null;
      };
      return {
        at: r.confirmed_at,
        discordId: r.discord_id,
        amountSol: String(r.amount_sol ?? ""),
        signature: r.signature,
      };
    });

    const { data: t30, error: t30e } = await db
      .from("bot_tips")
      .select("amount_sol")
      .eq("status", "confirmed")
      .gte("confirmed_at", since30);
    if (t30e) throw t30e;
    let sum = 0;
    for (const row of t30 || []) {
      const n = Number((row as { amount_sol?: unknown }).amount_sol);
      if (Number.isFinite(n)) sum += n;
    }
    tipsTotals30d = {
      confirmedTips: t30?.length ?? 0,
      solSum: sum > 0 ? sum.toFixed(4) : "0",
    };
  } catch (e) {
    tipsActivity = [];
    tipsActivityError = e instanceof Error ? e.message : "bot_tips query failed";
    tipsTotals30d = { confirmedTips: null, solSum: null, error: tipsActivityError };
  }

  return {
    success: true,
    generatedAt,
    solWallets,
    membershipByChannel,
    activeByPlan,
    voucherPool,
    membershipActivity,
    membershipActivityError,
    tipsActivity,
    tipsActivityError,
    tipsTotals30d,
    stripe: stripeSnap,
  };
}
