"use client";

import { useCallback, useEffect, useState } from "react";

type SlugRequestRow = {
  id: string;
  email: string;
  displayName: string | null;
  affiliateSlug: string | null;
  slugChangePending: string | null;
};

export default function AffiliateAdminSlugRequestsPage() {
  const [rows, setRows] = useState<SlugRequestRow[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setErr(null);
    try {
      const res = await fetch("/api/affiliate/admin/slug-requests", { credentials: "same-origin" });
      const j = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        requests?: SlugRequestRow[];
        error?: string;
      };
      if (!res.ok || !j.success) {
        setErr(typeof j.error === "string" ? j.error : "Could not load requests.");
        setRows([]);
        return;
      }
      setRows(Array.isArray(j.requests) ? j.requests : []);
    } catch {
      setErr("Could not load requests.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function act(affiliateId: string, action: "approve" | "reject") {
    setBusy(affiliateId);
    setErr(null);
    try {
      const res = await fetch("/api/affiliate/admin/slug-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ affiliateId, action }),
      });
      const j = (await res.json().catch(() => ({}))) as { success?: boolean; error?: string };
      if (!res.ok || !j.success) {
        setErr(typeof j.error === "string" ? j.error : "Action failed.");
        return;
      }
      await load();
    } catch {
      setErr("Action failed.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-zinc-900">Slug change requests</h2>
        <p className="mt-1 text-sm text-zinc-600">
          Affiliates may request a new vanity slug once per 90 days. Old slugs keep working as aliases after approval.
        </p>
      </div>

      {err ? <p className="text-sm text-red-700">{err}</p> : null}

      <section className="overflow-hidden rounded-2xl border border-zinc-200/90 bg-white shadow-sm">
        {rows.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-zinc-500">No pending slug requests.</p>
        ) : (
          <ul className="divide-y divide-zinc-100">
            {rows.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-zinc-900">{r.email}</p>
                  <p className="mt-1 font-mono text-xs text-zinc-600">
                    {r.affiliateSlug ?? "—"} → <span className="font-semibold text-violet-800">{r.slugChangePending}</span>
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={() => void act(r.id, "approve")}
                    className="rounded border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-900 disabled:opacity-45"
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={() => void act(r.id, "reject")}
                    className="rounded border border-red-300 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-900 disabled:opacity-45"
                  >
                    Reject
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
