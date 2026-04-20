import { botApiBaseUrl } from "@/lib/botInternal";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export type BotHealthSummary = {
  ok?: boolean;
  scannerEnabled?: boolean;
  discordReady?: boolean;
  processUptimeSec?: number;
  cwd?: string;
  loadedFrom?: string;
};

export type TierCountRow = { tier: string; count: number };

export type AdminOverviewSnapshot = {
  success: boolean;
  generatedAt: string;
  bot?: {
    reachable: boolean;
    httpStatus: number | null;
    health: BotHealthSummary | null;
    error?: string;
  };
  users?: {
    total: number | null;
    newLast7Days: number | null;
    newLast30Days: number | null;
    byTier: TierCountRow[];
    error?: string;
  };
  subscriptions?: {
    activeNow: number | null;
    expiredOrLapsed: number | null;
    byPlanSlug: { slug: string; label: string; activeCount: number }[];
    error?: string;
  };
  invoices?: {
    pending: number | null;
    paidLast30Days: number | null;
    /** All rows still marked `expired` (not time-windowed). */
    expiredTotal: number | null;
    error?: string;
  };
  /** active / (active + lapsed period end) when counts available */
  subscriptionApproxRetention?: number | null;
};

function daysAgoIso(days: number): string {
  return new Date(Date.now() - days * 86400000).toISOString();
}

async function fetchBotHealthSummary(): Promise<AdminOverviewSnapshot["bot"]> {
  const base = botApiBaseUrl();
  if (!base) {
    return { reachable: false, httpStatus: null, health: null, error: "BOT_API_URL not set" };
  }
  const origin = base.replace(/\/+$/, "");
  const url = `${origin}/health`;
  try {
    const res = await fetch(url, { method: "GET", cache: "no-store" });
    const raw = await res.text();
    let health: BotHealthSummary | null = null;
    if (raw) {
      try {
        health = JSON.parse(raw) as BotHealthSummary;
      } catch {
        health = null;
      }
    }
    return {
      reachable: res.ok,
      httpStatus: res.status,
      health,
      error: res.ok ? undefined : `HTTP ${res.status}`,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { reachable: false, httpStatus: null, health: null, error: msg };
  }
}

export async function loadAdminOverviewSnapshot(): Promise<AdminOverviewSnapshot> {
  const generatedAt = new Date().toISOString();
  const db = getSupabaseAdmin();

  const [bot] = await Promise.all([fetchBotHealthSummary()]);

  if (!db) {
    return {
      success: true,
      generatedAt,
      bot,
      users: { total: null, newLast7Days: null, newLast30Days: null, byTier: [], error: "Supabase admin not configured" },
      subscriptions: { activeNow: null, expiredOrLapsed: null, byPlanSlug: [], error: "Supabase admin not configured" },
      invoices: { pending: null, paidLast30Days: null, expiredTotal: null, error: "Supabase admin not configured" },
    };
  }

  let usersBlock: AdminOverviewSnapshot["users"] = { total: null, newLast7Days: null, newLast30Days: null, byTier: [] };
  try {
    const { count: total, error: e1 } = await db.from("users").select("*", { count: "exact", head: true });
    if (e1) throw e1;
    const since7 = daysAgoIso(7);
    const since30 = daysAgoIso(30);
    const { count: n7, error: e2 } = await db
      .from("users")
      .select("*", { count: "exact", head: true })
      .gte("created_at", since7);
    if (e2) throw e2;
    const { count: n30, error: e3 } = await db
      .from("users")
      .select("*", { count: "exact", head: true })
      .gte("created_at", since30);
    if (e3) throw e3;

    const { data: tierRows, error: e4 } = await db.from("users").select("tier");
    if (e4) throw e4;
    const map = new Map<string, number>();
    for (const row of tierRows || []) {
      const t = typeof (row as { tier?: unknown }).tier === "string" ? String((row as { tier: string }).tier) : "unknown";
      map.set(t, (map.get(t) ?? 0) + 1);
    }
    const byTier: TierCountRow[] = [...map.entries()]
      .map(([tier, count]) => ({ tier, count }))
      .sort((a, b) => b.count - a.count);

    usersBlock = {
      total: total ?? null,
      newLast7Days: n7 ?? null,
      newLast30Days: n30 ?? null,
      byTier,
    };
  } catch (e) {
    usersBlock = {
      total: null,
      newLast7Days: null,
      newLast30Days: null,
      byTier: [],
      error: e instanceof Error ? e.message : "users query failed",
    };
  }

  const nowIso = new Date().toISOString();
  let subsBlock: AdminOverviewSnapshot["subscriptions"] = {
    activeNow: null,
    expiredOrLapsed: null,
    byPlanSlug: [],
  };
  try {
    const { count: activeNow, error: s1 } = await db
      .from("subscriptions")
      .select("*", { count: "exact", head: true })
      .eq("status", "active")
      .gt("current_period_end", nowIso);
    if (s1) throw s1;

    const { count: lapsedEnd, error: s2 } = await db
      .from("subscriptions")
      .select("*", { count: "exact", head: true })
      .lt("current_period_end", nowIso);
    if (s2) throw s2;
    subsBlock = {
      ...subsBlock,
      activeNow: activeNow ?? null,
      expiredOrLapsed: lapsedEnd ?? null,
      byPlanSlug: [],
    };

    const { data: plans } = await db.from("subscription_plans").select("id, slug, label").eq("active", true);
    const planList = (plans || []) as { id: string; slug: string; label: string }[];
    const byPlanSlug: { slug: string; label: string; activeCount: number }[] = [];
    for (const p of planList) {
      const { count, error: pc } = await db
        .from("subscriptions")
        .select("*", { count: "exact", head: true })
        .eq("plan_id", p.id)
        .eq("status", "active")
        .gt("current_period_end", nowIso);
      if (!pc) {
        byPlanSlug.push({ slug: p.slug, label: p.label, activeCount: count ?? 0 });
      }
    }
    subsBlock = { ...subsBlock, byPlanSlug };
  } catch (e) {
    subsBlock = {
      activeNow: null,
      expiredOrLapsed: null,
      byPlanSlug: [],
      error: e instanceof Error ? e.message : "subscriptions query failed",
    };
  }

  let invBlock: AdminOverviewSnapshot["invoices"] = { pending: null, paidLast30Days: null, expiredTotal: null };
  try {
    const { count: pending, error: i1 } = await db.from("payment_invoices").select("*", { count: "exact", head: true }).eq("status", "pending");
    if (i1) throw i1;
    const since30 = daysAgoIso(30);
    const { count: paidLast30Days, error: i2 } = await db
      .from("payment_invoices")
      .select("*", { count: "exact", head: true })
      .eq("status", "paid")
      .gte("paid_at", since30);
    if (i2) throw i2;
    const { count: expiredInvoices, error: i3 } = await db
      .from("payment_invoices")
      .select("*", { count: "exact", head: true })
      .eq("status", "expired");
    if (i3) throw i3;
    invBlock = {
      pending: pending ?? null,
      paidLast30Days: paidLast30Days ?? null,
      expiredTotal: expiredInvoices ?? null,
    };
  } catch (e) {
    invBlock = {
      pending: null,
      paidLast30Days: null,
      expiredTotal: null,
      error: e instanceof Error ? e.message : "invoices query failed",
    };
  }

  let subscriptionApproxRetention: number | null = null;
  const a = subsBlock.activeNow;
  const l = subsBlock.expiredOrLapsed;
  if (a != null && l != null) {
    const denom = a + l;
    subscriptionApproxRetention = denom > 0 ? Math.round((a / denom) * 1000) / 1000 : null;
  }

  return {
    success: true,
    generatedAt,
    bot,
    users: usersBlock,
    subscriptions: subsBlock,
    invoices: invBlock,
    subscriptionApproxRetention,
  };
}
