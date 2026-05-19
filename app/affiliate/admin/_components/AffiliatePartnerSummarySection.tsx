"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AffiliatePartnerCommissionsTable } from "@/app/affiliate/admin/_components/AffiliatePartnerCommissionsTable";
import { AffiliatePartnerPayoutsTable } from "@/app/affiliate/admin/_components/AffiliatePartnerPayoutsTable";
import { AffiliatePartnerStatsGrid } from "@/app/affiliate/admin/_components/AffiliatePartnerStatsGrid";
import type { AffiliateAdminPartnerDetail } from "@/lib/affiliate/affiliateAdminPartnerDetail";

export function AffiliatePartnerSummarySection({ affiliateId }: { affiliateId: string }) {
  const [detail, setDetail] = useState<AffiliateAdminPartnerDetail | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/affiliate/admin/accounts/${encodeURIComponent(affiliateId)}/detail`, {
        credentials: "same-origin",
      });
      const j = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        detail?: AffiliateAdminPartnerDetail;
      };
      setDetail(res.ok && j.success && j.detail ? j.detail : null);
    } catch {
      setDetail(null);
    } finally {
      setLoading(false);
    }
  }, [affiliateId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return <p className="text-sm text-zinc-500">Loading stats…</p>;
  }

  if (!detail) {
    return <p className="text-sm text-zinc-500">Could not load partner statistics.</p>;
  }

  return (
    <div className="mt-4 space-y-5 border-t border-zinc-200 pt-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Partner activity</h4>
        <Link
          href={`/affiliate/admin/partners/${encodeURIComponent(affiliateId)}`}
          className="rounded-lg border border-violet-300 bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-violet-700"
        >
          Open full profile
        </Link>
      </div>
      <AffiliatePartnerStatsGrid detail={detail} />
      <div>
        <p className="mb-2 text-xs font-semibold text-zinc-700">Recent commissions</p>
        <AffiliatePartnerCommissionsTable rows={detail.recentCommissions} compact />
      </div>
      <div>
        <p className="mb-2 text-xs font-semibold text-zinc-700">Recent payouts</p>
        <AffiliatePartnerPayoutsTable rows={detail.recentPayouts} compact />
      </div>
    </div>
  );
}
