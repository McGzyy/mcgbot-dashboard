"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type CampaignRow = {
  id: string;
  slug: string;
  name: string;
  clickCount: number;
  signupCount: number;
  payingCount: number;
};

export function AffiliateTopCampaigns() {
  const [rows, setRows] = useState<CampaignRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch("/api/affiliate/campaigns", { credentials: "same-origin" });
      const j = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        error?: string;
        campaigns?: CampaignRow[];
      };
      if (!res.ok || !j.success) {
        setErr(typeof j.error === "string" ? j.error : "Could not load campaigns.");
        setRows([]);
        return;
      }
      const campaigns = Array.isArray(j.campaigns) ? j.campaigns : [];
      const sorted = [...campaigns].sort((a, b) => {
        const score = (c: CampaignRow) => c.signupCount * 100 + c.payingCount * 50 + c.clickCount;
        return score(b) - score(a);
      });
      setRows(sorted.slice(0, 5));
    } catch {
      setErr("Could not load campaigns.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return <p className="text-sm text-zinc-500">Loading campaign stats…</p>;
  }

  if (err) {
    return <p className="text-sm text-red-700">{err}</p>;
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50/80 px-4 py-6 text-center">
        <p className="text-sm text-zinc-600">No campaign links yet.</p>
        <Link
          href="/affiliate/campaigns"
          className="mt-2 inline-block text-xs font-semibold text-violet-700 hover:underline"
        >
          Create your first campaign →
        </Link>
      </div>
    );
  }

  return (
    <section className="rounded-2xl border border-zinc-200/90 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-zinc-900">Top campaigns</h2>
          <p className="mt-0.5 text-xs text-zinc-500">Ranked by signups, paying members, then clicks</p>
        </div>
        <Link
          href="/affiliate/campaigns"
          className="text-xs font-semibold text-violet-700 hover:underline"
        >
          All campaigns →
        </Link>
      </div>
      <div className="mt-4 overflow-x-auto rounded-xl border border-zinc-200">
        <table className="w-full min-w-[20rem] text-left text-xs">
          <thead className="border-b border-zinc-200 bg-zinc-50 text-[10px] uppercase tracking-wider text-zinc-500">
            <tr>
              <th className="px-3 py-2">Campaign</th>
              <th className="px-3 py-2 text-right">Clicks</th>
              <th className="px-3 py-2 text-right">Signups</th>
              <th className="px-3 py-2 text-right">Paying</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {rows.map((c) => (
              <tr key={c.id} className="text-zinc-800">
                <td className="px-3 py-2">
                  <p className="font-medium text-zinc-900">{c.name}</p>
                  <p className="font-mono text-[10px] text-zinc-500">{c.slug}</p>
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{c.clickCount}</td>
                <td className="px-3 py-2 text-right tabular-nums">{c.signupCount}</td>
                <td className="px-3 py-2 text-right tabular-nums">{c.payingCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
