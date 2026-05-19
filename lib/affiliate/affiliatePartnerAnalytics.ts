import { countAffiliateLinkClicks } from "@/lib/affiliate/affiliateLinkClicks";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export type AffiliateAnalyticsRangeDays = 7 | 30 | 90;

export type AffiliateDailySeriesPoint = {
  date: string;
  clicks: number;
  signups: number;
  payingConversions: number;
  commissionCents: number;
};

export type AffiliatePartnerAnalytics = {
  rangeDays: AffiliateAnalyticsRangeDays;
  period: {
    clicks: number;
    signups: number;
    payingConversions: number;
    commissionCents: number;
    conversionRatePct: number | null;
    signupRatePct: number | null;
    epcCents: number | null;
  };
  lifetime: {
    clicks: number;
    referrals: number;
    payingReferrals: number;
    pendingCommissionCents: number;
    approvedCommissionCents: number;
  };
  series: AffiliateDailySeriesPoint[];
};

export function parseAffiliateAnalyticsRange(raw: unknown): AffiliateAnalyticsRangeDays {
  const n = Math.floor(Number(raw));
  if (n === 7) return 7;
  if (n === 90) return 90;
  return 30;
}

function utcDayKeys(rangeDays: number): string[] {
  const keys: string[] = [];
  const today = new Date();
  const end = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  for (let i = rangeDays - 1; i >= 0; i--) {
    const d = new Date(end - i * 86_400_000);
    keys.push(d.toISOString().slice(0, 10));
  }
  return keys;
}

function dayKeyFromMs(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

function dayKeyFromIso(iso: string): string | null {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return null;
  return dayKeyFromMs(t);
}

function pct(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null;
  return Math.round((numerator / denominator) * 1000) / 10;
}

export async function getAffiliatePartnerAnalytics(
  affiliateId: string,
  rangeDays: AffiliateAnalyticsRangeDays
): Promise<AffiliatePartnerAnalytics> {
  const id = affiliateId.trim();
  const sinceMs = Date.now() - rangeDays * 86_400_000;
  const sinceIso = new Date(sinceMs).toISOString();
  const dayKeys = utcDayKeys(rangeDays);
  const seriesMap = new Map<string, AffiliateDailySeriesPoint>();
  for (const date of dayKeys) {
    seriesMap.set(date, {
      date,
      clicks: 0,
      signups: 0,
      payingConversions: 0,
      commissionCents: 0,
    });
  }

  const db = getSupabaseAdmin();

  let periodClicks = 0;
  let lifetimeClicks = 0;
  let periodSignups = 0;
  let periodPaying = 0;
  let periodCommissionCents = 0;
  let lifetimeReferrals = 0;
  let lifetimePaying = 0;
  let pendingCommissionCents = 0;
  let approvedCommissionCents = 0;

  periodClicks = await countAffiliateLinkClicks(id, { sinceMs });
  lifetimeClicks = await countAffiliateLinkClicks(id);

  if (db) {
    const { data: clickRows } = await db
      .from("affiliate_link_clicks")
      .select("clicked_at")
      .eq("affiliate_id", id)
      .gte("clicked_at", sinceMs);
    if (Array.isArray(clickRows)) {
      for (const r of clickRows as { clicked_at?: unknown }[]) {
        const ms = Math.floor(Number(r.clicked_at));
        if (!Number.isFinite(ms)) continue;
        const key = dayKeyFromMs(ms);
        const pt = seriesMap.get(key);
        if (pt) pt.clicks += 1;
      }
    }

    const { count: refCount } = await db
      .from("affiliate_attributions")
      .select("*", { count: "exact", head: true })
      .eq("affiliate_id", id);
    lifetimeReferrals = refCount ?? 0;

    const { count: payingCount } = await db
      .from("affiliate_attributions")
      .select("*", { count: "exact", head: true })
      .eq("affiliate_id", id)
      .gt("payment_count", 0);
    lifetimePaying = payingCount ?? 0;

    const { data: attrRows } = await db
      .from("affiliate_attributions")
      .select("joined_at, first_paid_at, payment_count")
      .eq("affiliate_id", id);
    if (Array.isArray(attrRows)) {
      for (const r of attrRows as {
        joined_at?: unknown;
        first_paid_at?: string | null;
        payment_count?: unknown;
      }[]) {
        const joinedMs = Math.floor(Number(r.joined_at));
        if (Number.isFinite(joinedMs) && joinedMs >= sinceMs) {
          periodSignups += 1;
          const key = dayKeyFromMs(joinedMs);
          const pt = seriesMap.get(key);
          if (pt) pt.signups += 1;
        }
        const firstPaid = typeof r.first_paid_at === "string" ? r.first_paid_at : null;
        if (firstPaid) {
          const paidMs = Date.parse(firstPaid);
          if (Number.isFinite(paidMs) && paidMs >= sinceMs) {
            periodPaying += 1;
            const key = dayKeyFromIso(firstPaid);
            const pt = key ? seriesMap.get(key) : null;
            if (pt) pt.payingConversions += 1;
          }
        }
      }
    }

    const { data: commRows } = await db
      .from("affiliate_commissions")
      .select("commission_cents, status, created_at")
      .eq("affiliate_id", id);
    if (Array.isArray(commRows)) {
      for (const r of commRows as {
        commission_cents?: unknown;
        status?: string;
        created_at?: string;
      }[]) {
        const c = Math.floor(Number(r.commission_cents)) || 0;
        if (c <= 0) continue;
        const st = typeof r.status === "string" ? r.status : "";
        if (st === "voided") continue;
        if (st === "pending") pendingCommissionCents += c;
        else if (st === "approved" || st === "paid") approvedCommissionCents += c;

        const created = typeof r.created_at === "string" ? r.created_at : "";
        const createdMs = Date.parse(created);
        if (Number.isFinite(createdMs) && createdMs >= sinceMs) {
          periodCommissionCents += c;
          const key = dayKeyFromIso(created);
          const pt = key ? seriesMap.get(key) : null;
          if (pt) pt.commissionCents += c;
        }
      }
    }
  }

  const series = dayKeys.map((d) => seriesMap.get(d)!);

  return {
    rangeDays,
    period: {
      clicks: periodClicks,
      signups: periodSignups,
      payingConversions: periodPaying,
      commissionCents: periodCommissionCents,
      conversionRatePct: pct(periodPaying, periodClicks),
      signupRatePct: pct(periodSignups, periodClicks),
      epcCents: periodClicks > 0 ? Math.floor(periodCommissionCents / periodClicks) : null,
    },
    lifetime: {
      clicks: lifetimeClicks,
      referrals: lifetimeReferrals,
      payingReferrals: lifetimePaying,
      pendingCommissionCents,
      approvedCommissionCents,
    },
    series,
  };
}
