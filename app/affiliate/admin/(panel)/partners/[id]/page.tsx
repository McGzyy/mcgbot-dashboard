"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { AffiliateApplicationDetails } from "@/app/affiliate/admin/_components/AffiliateApplicationDetails";
import { AffiliatePartnerCommissionsTable } from "@/app/affiliate/admin/_components/AffiliatePartnerCommissionsTable";
import { AffiliatePartnerPayoutsTable } from "@/app/affiliate/admin/_components/AffiliatePartnerPayoutsTable";
import { AffiliatePartnerStatsGrid } from "@/app/affiliate/admin/_components/AffiliatePartnerStatsGrid";
import { AFFILIATE_STATUS_LABELS } from "@/lib/affiliate/affiliateApplicationStatus";
import type { AffiliateAdminPartnerDetail } from "@/lib/affiliate/affiliateAdminPartnerDetail";
import { fmtAffiliateUsd } from "@/lib/affiliate/affiliateFormatUsd";
import type { AffiliateAccountStatus } from "@/lib/affiliate/affiliateSession";
import { AFFILIATE_DEFAULT_COMMISSION_RATE_BPS } from "@/lib/affiliate/affiliateCommissionSchedule";

function milestoneStatusLabel(status: string | null): string {
  if (!status) return "Not reached";
  if (status === "auto_paid" || status === "paid") return "Paid";
  if (status === "approved") return "Approved";
  if (status === "pending_approval") return "Pending ops review";
  if (status === "rejected") return "Rejected";
  return status;
}

export default function AffiliateAdminPartnerProfilePage() {
  const params = useParams();
  const affiliateId = typeof params.id === "string" ? params.id : "";

  const [detail, setDetail] = useState<AffiliateAdminPartnerDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [reviewNotesDraft, setReviewNotesDraft] = useState("");
  const [commissionBpsDraft, setCommissionBpsDraft] = useState("");

  const load = useCallback(async () => {
    if (!affiliateId) return;
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(`/api/affiliate/admin/accounts/${encodeURIComponent(affiliateId)}/detail`, {
        credentials: "same-origin",
      });
      const j = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        detail?: AffiliateAdminPartnerDetail;
        error?: string;
      };
      if (!res.ok || !j.success || !j.detail) {
        setErr(typeof j.error === "string" ? j.error : "Could not load affiliate.");
        setDetail(null);
        return;
      }
      setDetail(j.detail);
      setReviewNotesDraft(j.detail.account.application.adminReviewNotes ?? "");
      setCommissionBpsDraft(String(j.detail.account.commissionRateBps));
    } catch {
      setErr("Could not load affiliate.");
    } finally {
      setLoading(false);
    }
  }, [affiliateId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function patch(body: Record<string, unknown>, successMessage: string) {
    setBusy("patch");
    setErr(null);
    setNote(null);
    try {
      const res = await fetch(`/api/affiliate/admin/accounts/${encodeURIComponent(affiliateId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(body),
      });
      const j = (await res.json().catch(() => ({}))) as { success?: boolean; error?: string };
      if (!res.ok || !j.success) {
        setErr(typeof j.error === "string" ? j.error : "Update failed.");
        return;
      }
      setNote(successMessage);
      await load();
    } catch {
      setErr("Update failed.");
    } finally {
      setBusy(null);
    }
  }

  async function voidCommission(id: string) {
    setBusy(`void:${id}`);
    setErr(null);
    try {
      const res = await fetch(`/api/affiliate/admin/commissions/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ action: "void" }),
      });
      const j = (await res.json().catch(() => ({}))) as { success?: boolean; error?: string };
      if (!res.ok || !j.success) {
        setErr(typeof j.error === "string" ? j.error : "Void failed.");
        return;
      }
      await load();
    } catch {
      setErr("Void failed.");
    } finally {
      setBusy(null);
    }
  }

  if (loading) {
    return <p className="text-sm text-zinc-500">Loading affiliate profile…</p>;
  }

  if (!detail) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-red-700">{err ?? "Affiliate not found."}</p>
        <Link href="/affiliate/admin/partners" className="text-sm font-semibold text-violet-700 hover:underline">
          ← Back to affiliates
        </Link>
      </div>
    );
  }

  const account = detail.account;
  const status = account.status as AffiliateAccountStatus;
  const isActivePartner = status === "active" || status === "suspended";

  return (
    <div className="space-y-8 pb-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            href="/affiliate/admin/partners"
            className="text-xs font-semibold text-violet-700 hover:text-violet-900"
          >
            ← Affiliates
          </Link>
          <h2 className="mt-2 text-xl font-semibold text-zinc-900">{account.email}</h2>
          <p className="mt-1 text-sm text-zinc-600">
            {account.displayName ?? account.application.legalName ?? "—"} ·{" "}
            {AFFILIATE_STATUS_LABELS[status] ?? status}
          </p>
          {detail.trackingLink ? (
            <p className="mt-2 font-mono text-xs text-violet-800">{detail.trackingLink}</p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          {status === "active" ? (
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => void patch({ status: "suspended" }, "Account suspended.")}
              className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-xs font-semibold text-red-900 hover:bg-red-100 disabled:opacity-45"
            >
              Suspend
            </button>
          ) : null}
          {status === "suspended" ? (
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => void patch({ status: "active" }, "Account reactivated.")}
              className="rounded-lg border border-emerald-300 bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-45"
            >
              Reactivate
            </button>
          ) : null}
        </div>
      </div>

      {err ? <p className="text-sm text-red-700">{err}</p> : null}
      {note ? <p className="text-sm text-emerald-800">{note}</p> : null}

      {isActivePartner ? (
        <>
          <section>
            <h3 className="text-sm font-semibold text-zinc-900">Performance</h3>
            <div className="mt-3">
              <AffiliatePartnerStatsGrid detail={detail} />
            </div>
          </section>

          <section>
            <h3 className="text-sm font-semibold text-zinc-900">Milestone progress</h3>
            <ul className="mt-3 grid gap-2 sm:grid-cols-3">
              {detail.milestones.map((m) => (
                <li key={m.tier} className="rounded-xl border border-zinc-200 bg-white p-3 text-sm shadow-sm">
                  <p className="font-semibold text-zinc-900">
                    {m.tier} actives · {fmtAffiliateUsd(m.bonusCents)}
                  </p>
                  <p className="mt-1 text-xs text-zinc-600">
                    {m.activeCount} / {m.threshold} qualified
                  </p>
                  <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                    {milestoneStatusLabel(m.grantStatus)}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        </>
      ) : null}

      <section className="rounded-2xl border border-zinc-200/90 bg-white p-4 shadow-sm sm:p-5">
        <h3 className="text-sm font-semibold text-zinc-900">Admin controls</h3>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <label className="block">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
              Commission rate (bps)
            </span>
            <div className="mt-1 flex gap-2">
              <input
                type="number"
                min={0}
                max={10000}
                value={commissionBpsDraft}
                onChange={(e) => setCommissionBpsDraft(e.target.value)}
                className="h-9 w-full rounded-lg border border-zinc-200 bg-white px-3 font-mono text-sm text-zinc-900 outline-none focus:border-violet-400"
              />
              <button
                type="button"
                disabled={busy !== null}
                onClick={() =>
                  void patch(
                    { commissionRateBps: Math.floor(Number(commissionBpsDraft)) },
                    "Commission rate saved."
                  )
                }
                className="shrink-0 rounded-lg border border-violet-300 bg-violet-600 px-3 text-xs font-semibold text-white hover:bg-violet-700 disabled:opacity-45"
              >
                Save
              </button>
            </div>
            <p className="mt-1 text-[11px] text-zinc-500">
              Default on approve is {AFFILIATE_DEFAULT_COMMISSION_RATE_BPS} ({AFFILIATE_DEFAULT_COMMISSION_RATE_BPS / 100}%).
            </p>
          </label>
          <label className="block lg:col-span-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
              Internal review notes
            </span>
            <textarea
              value={reviewNotesDraft}
              onChange={(e) => setReviewNotesDraft(e.target.value)}
              className="mt-1 min-h-[72px] w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-violet-400"
            />
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => void patch({ adminReviewNotes: reviewNotesDraft.trim() || null }, "Notes saved.")}
              className="mt-2 h-9 rounded-lg border border-zinc-300 bg-zinc-50 px-3 text-xs font-semibold text-zinc-800 hover:bg-zinc-100 disabled:opacity-45"
            >
              Save notes
            </button>
          </label>
        </div>
      </section>

      {isActivePartner ? (
        <>
          <section>
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-zinc-900">Commission ledger</h3>
              <Link
                href="/affiliate/admin/commissions"
                className="text-xs font-semibold text-violet-700 hover:underline"
              >
                All commissions
              </Link>
            </div>
            <div className="mt-3">
              <AffiliatePartnerCommissionsTable
                rows={detail.recentCommissions}
                busy={busy}
                onVoid={(id) => void voidCommission(id)}
              />
            </div>
          </section>

          <section>
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-zinc-900">Payout requests</h3>
              <Link href="/affiliate/admin/payouts" className="text-xs font-semibold text-violet-700 hover:underline">
                All payouts
              </Link>
            </div>
            <div className="mt-3">
              <AffiliatePartnerPayoutsTable rows={detail.recentPayouts} />
            </div>
          </section>
        </>
      ) : null}

      <section className="rounded-2xl border border-zinc-200/90 bg-white p-4 shadow-sm sm:p-5">
        <h3 className="text-sm font-semibold text-zinc-900">Application</h3>
        {account.application.submittedAt ? (
          <p className="mt-1 text-xs text-zinc-500">
            Submitted {new Date(account.application.submittedAt).toLocaleString()}
          </p>
        ) : (
          <p className="mt-1 text-xs text-zinc-500">Manual account — no application on file.</p>
        )}
        <div className="mt-4">
          <AffiliateApplicationDetails email={account.email} application={account.application} />
        </div>
      </section>
    </div>
  );
}
