"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AffiliateMetricCard } from "@/app/affiliate/(partner)/_components/AffiliateMetricCard";
import { AffiliatePerformanceChart } from "@/app/affiliate/(partner)/_components/AffiliatePerformanceChart";
import { fmtAffiliateUsd } from "@/lib/affiliate/affiliateFormatUsd";
import type { AffiliatePartnerAnalytics } from "@/lib/affiliate/affiliatePartnerAnalytics";

type Range = 7 | 30 | 90;

const RANGES: { days: Range; label: string }[] = [
  { days: 7, label: "7d" },
  { days: 30, label: "30d" },
  { days: 90, label: "90d" },
];

function fmtPct(v: number | null): string {
  if (v == null) return "—";
  return `${v.toFixed(1)}%`;
}

function fmtEpc(cents: number | null): string {
  if (cents == null) return "—";
  return fmtAffiliateUsd(cents);
}

export function AffiliatePerformanceOverview({
  trackingLink,
  showTrackingLink = true,
}: {
  trackingLink?: string | null;
  showTrackingLink?: boolean;
}) {
  const [range, setRange] = useState<Range>(30);
  const [analytics, setAnalytics] = useState<AffiliatePartnerAnalytics | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (days: Range) => {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(`/api/affiliate/analytics?range=${days}`, { credentials: "same-origin" });
      const j = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        analytics?: AffiliatePartnerAnalytics;
        error?: string;
      };
      if (!res.ok || !j.success || !j.analytics) {
        setErr(typeof j.error === "string" ? j.error : "Could not load performance data.");
        setAnalytics(null);
        return;
      }
      setAnalytics(j.analytics);
    } catch {
      setErr("Network error.");
      setAnalytics(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(range);
  }, [range, load]);

  const p = analytics?.period;
  const l = analytics?.lifetime;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-violet-700/90">
            Performance
          </p>
          <h2 className="mt-1 text-xl font-semibold text-zinc-900 sm:text-2xl">Partner overview</h2>
          <p className="mt-1 max-w-xl text-sm text-zinc-600">
            Clicks, attributed signups, paying conversions, and earnings — the same metrics pro affiliate
            programs surface daily.
          </p>
        </div>
        <div className="flex rounded-xl border border-zinc-200 bg-white p-1 shadow-sm">
          {RANGES.map((r) => (
            <button
              key={r.days}
              type="button"
              onClick={() => setRange(r.days)}
              className={
                range === r.days
                  ? "rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white"
                  : "rounded-lg px-3 py-1.5 text-xs font-semibold text-zinc-600 hover:bg-zinc-50"
              }
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {err ? <p className="text-sm text-red-700">{err}</p> : null}

      {showTrackingLink && trackingLink ? (
        <div className="rounded-2xl border border-violet-200/80 bg-gradient-to-br from-violet-50 to-white p-4 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-violet-800/90">
                Default tracking link
              </p>
              <p className="mt-2 break-all font-mono text-sm text-zinc-900">{trackingLink}</p>
            </div>
            <Link
              href="/affiliate/campaigns"
              className="shrink-0 rounded-lg border border-violet-300 bg-white px-3 py-2 text-xs font-semibold text-violet-900 shadow-sm hover:bg-violet-50"
            >
              Campaign links →
            </Link>
          </div>
        </div>
      ) : null}

      {loading && !analytics ? (
        <p className="text-sm text-zinc-500">Loading performance…</p>
      ) : analytics && p && l ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <AffiliateMetricCard
              label={`Clicks (${range}d)`}
              value={String(p.clicks)}
              hint={`${l.clicks.toLocaleString()} lifetime`}
              tone="sky"
            />
            <AffiliateMetricCard
              label={`Signups (${range}d)`}
              value={String(p.signups)}
              hint={`Signup rate ${fmtPct(p.signupRatePct)}`}
              tone="violet"
            />
            <AffiliateMetricCard
              label={`Paying (${range}d)`}
              value={String(p.payingConversions)}
              hint={`Conv. ${fmtPct(p.conversionRatePct)} · ${l.payingReferrals} lifetime`}
              tone="emerald"
            />
            <AffiliateMetricCard
              label={`Earnings (${range}d)`}
              value={fmtAffiliateUsd(p.commissionCents)}
              hint={`EPC ${fmtEpc(p.epcCents)} · ${fmtAffiliateUsd(l.pendingCommissionCents)} pending`}
              tone="amber"
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <section className="rounded-2xl border border-zinc-200/90 bg-white p-4 shadow-sm sm:p-5">
              <h3 className="text-sm font-semibold text-zinc-900">Clicks per day</h3>
              <p className="mt-0.5 text-xs text-zinc-500">Landing views on your /r/ links</p>
              <AffiliatePerformanceChart series={analytics.series} metric="clicks" />
            </section>
            <section className="rounded-2xl border border-zinc-200/90 bg-white p-4 shadow-sm sm:p-5">
              <h3 className="text-sm font-semibold text-zinc-900">Commission per day</h3>
              <p className="mt-0.5 text-xs text-zinc-500">Recorded when invoices clear (excludes voided)</p>
              <AffiliatePerformanceChart series={analytics.series} metric="commissionCents" />
            </section>
          </div>

          <div className="flex flex-wrap gap-2 rounded-2xl border border-zinc-200/90 bg-zinc-50/80 px-4 py-3">
            <Link
              href="/affiliate/earnings"
              className="rounded-lg bg-violet-600 px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-violet-700"
            >
              Earnings & payouts
            </Link>
            <Link
              href="/affiliate/resources"
              className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-800 hover:bg-zinc-50"
            >
              Resources
            </Link>
            <Link
              href="/affiliate/tickets"
              className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-800 hover:bg-zinc-50"
            >
              Support
            </Link>
          </div>
        </>
      ) : null}
    </div>
  );
}
