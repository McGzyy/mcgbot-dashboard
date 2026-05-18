"use client";

import { useCallback, useEffect, useState } from "react";

type Grant = {
  id: string;
  affiliateId: string;
  affiliateEmail: string | null;
  tier: number;
  amountCents: number;
  qualifiedActiveCount: number;
  createdAt: string;
};

function fmtUsd(cents: number): string {
  return (cents / 100).toLocaleString(undefined, { style: "currency", currency: "USD" });
}

export default function AffiliateAdminMilestonesPage() {
  const [grants, setGrants] = useState<Grant[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setErr(null);
    try {
      const res = await fetch("/api/affiliate/admin/milestones", { credentials: "same-origin" });
      const j = (await res.json().catch(() => ({}))) as { success?: boolean; grants?: Grant[]; error?: string };
      if (!res.ok || !j.success) {
        setErr(typeof j.error === "string" ? j.error : "Could not load milestones.");
        setGrants([]);
        return;
      }
      setGrants(Array.isArray(j.grants) ? j.grants : []);
    } catch {
      setErr("Could not load milestones.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function approve(id: string) {
    setBusy(id);
    setErr(null);
    try {
      const res = await fetch(`/api/affiliate/admin/milestones/${encodeURIComponent(id)}/approve`, {
        method: "POST",
        credentials: "same-origin",
      });
      const j = (await res.json().catch(() => ({}))) as { success?: boolean; error?: string };
      if (!res.ok || !j.success) {
        setErr(typeof j.error === "string" ? j.error : "Approve failed.");
        return;
      }
      await load();
    } catch {
      setErr("Approve failed.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-zinc-900">Milestone approvals</h2>
        <p className="mt-1 text-sm text-zinc-600">
          Tier 10 ($60) is auto-approved. Approve tier 25 ($150) and tier 50 ($300) when qualified active counts look
          correct.
        </p>
      </div>
      {err ? <p className="text-sm text-red-700">{err}</p> : null}
      {grants.length === 0 ? (
        <p className="text-sm text-zinc-500">No pending milestone grants.</p>
      ) : (
        <ul className="space-y-3">
          {grants.map((g) => (
            <li
              key={g.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-3 shadow-sm"
            >
              <div>
                <p className="text-sm font-semibold text-zinc-900">
                  {g.affiliateEmail ?? g.affiliateId} · tier {g.tier} · {fmtUsd(g.amountCents)}
                </p>
                <p className="text-xs text-zinc-500">
                  {g.qualifiedActiveCount} actives · {new Date(g.createdAt).toLocaleString()}
                </p>
              </div>
              <button
                type="button"
                disabled={busy === g.id}
                onClick={() => void approve(g.id)}
                className="h-9 rounded-lg bg-violet-600 px-4 text-xs font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
              >
                {busy === g.id ? "…" : "Approve"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
