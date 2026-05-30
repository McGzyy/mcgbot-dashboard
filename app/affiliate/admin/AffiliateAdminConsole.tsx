"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { AffiliateProgramOverview } from "@/app/affiliate/_components/AffiliateProgramOverview";
import { AffiliateApplicationContactModal } from "@/app/affiliate/admin/_components/AffiliateApplicationContactModal";
import {
  AffiliateApplicationDenyModal,
  type DenyApplicationConfirm,
} from "@/app/affiliate/admin/_components/AffiliateApplicationDenyModal";
import { reapplyAfterFromDenyPolicy } from "@/lib/affiliate/affiliateDenialReapply";
import { AffiliateApplicationDetails } from "@/app/affiliate/admin/_components/AffiliateApplicationDetails";
import { AffiliatePartnerSummarySection } from "@/app/affiliate/admin/_components/AffiliatePartnerSummarySection";
import {
  AFFILIATE_STATUS_BADGE_CLASS,
  AFFILIATE_STATUS_LABELS,
  affiliateAccountOpensPartnerProfile,
  affiliateAccountRowClass,
  affiliateAccountRowClickHint,
} from "@/lib/affiliate/affiliateApplicationStatus";
import { affiliateCommissionProgramShortLabel } from "@/lib/affiliate/affiliateCommissionSchedule";
import type { AffiliateAccountStatus } from "@/lib/affiliate/affiliateSession";

type AffiliateApplication = {
  legalName: string | null;
  companyName: string | null;
  country: string | null;
  primaryChannel: string | null;
  audienceSize: string | null;
  promoMethods: string | null;
  socialLinks: string | null;
  websiteUrl: string | null;
  notes: string | null;
  submittedAt: string | null;
  adminReviewNotes: string | null;
  denialReason: string | null;
  contactEmail: string | null;
  contactDiscord: string | null;
  contactX: string | null;
  contactOther: string | null;
};

type AffiliateRow = {
  id: string;
  email: string;
  displayName: string | null;
  status: string;
  commissionRateBps: number;
  totpEnabled: boolean;
  affiliateSlug: string | null;
  referralCode?: string | null;
  slugChangePending: string | null;
  createdAt: string;
  application?: AffiliateApplication;
};

export function AffiliateAdminConsole() {
  const router = useRouter();
  const detailRef = useRef<HTMLElement | null>(null);
  const [accounts, setAccounts] = useState<AffiliateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reviewNotesDraft, setReviewNotesDraft] = useState("");
  const [denyTarget, setDenyTarget] = useState<AffiliateRow | null>(null);
  const [contactTarget, setContactTarget] = useState<AffiliateRow | null>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [status, setStatus] = useState<"pending" | "active" | "suspended">("pending");

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch("/api/affiliate/admin/accounts", { credentials: "same-origin" });
      const j = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        accounts?: AffiliateRow[];
        error?: string;
      };
      if (!res.ok || !j.success) {
        setErr(typeof j.error === "string" ? j.error : "Could not load affiliates.");
        setAccounts([]);
        return;
      }
      setAccounts(Array.isArray(j.accounts) ? j.accounts : []);
    } catch {
      setErr("Could not load affiliates.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function createAccount(e: React.FormEvent) {
    e.preventDefault();
    setBusy("create");
    setNote(null);
    setErr(null);
    try {
      const res = await fetch("/api/affiliate/admin/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          email: email.trim(),
          password,
          displayName: displayName.trim() || null,
          status,
        }),
      });
      const j = (await res.json().catch(() => ({}))) as { success?: boolean; error?: string };
      if (!res.ok || !j.success) {
        setErr(typeof j.error === "string" ? j.error : "Create failed.");
        return;
      }
      setNote(`Created ${email.trim().toLowerCase()}.`);
      setEmail("");
      setPassword("");
      setDisplayName("");
      await load();
    } catch {
      setErr("Create failed.");
    } finally {
      setBusy(null);
    }
  }

  async function patchAccount(
    id: string,
    body: Record<string, unknown>,
    successMessage: string
  ): Promise<boolean> {
    setBusy(id);
    setErr(null);
    setNote(null);
    try {
      const res = await fetch(`/api/affiliate/admin/accounts/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(body),
      });
      const j = (await res.json().catch(() => ({}))) as { success?: boolean; error?: string };
      if (!res.ok || !j.success) {
        setErr(typeof j.error === "string" ? j.error : "Update failed.");
        return false;
      }
      setNote(successMessage);
      await load();
      return true;
    } catch {
      setErr("Update failed.");
      return false;
    } finally {
      setBusy(null);
    }
  }

  async function setAccountStatus(id: string, next: AffiliateAccountStatus) {
    await patchAccount(id, { status: next }, `Status updated to ${AFFILIATE_STATUS_LABELS[next]}.`);
  }

  async function denyApplication(id: string, input: DenyApplicationConfirm) {
    const policy = reapplyAfterFromDenyPolicy({
      policy: input.reapplyPolicy,
      customDate: input.customReapplyDate,
    });
    const ok = await patchAccount(
      id,
      {
        status: "denied",
        denialReason: input.reason,
        denialReapplyAllowed: policy.reapplyAllowed,
        reapplyAfter: policy.reapplyAfter,
      },
      "Application denied."
    );
    if (ok) setDenyTarget(null);
  }

  async function markNeedsContact(row: AffiliateRow) {
    const ok = await patchAccount(row.id, { status: "needs_contact" }, "Marked contact requested.");
    if (ok) setContactTarget(row);
  }

  const pendingCount = accounts.filter(
    (a) => a.status === "pending" || a.status === "needs_contact"
  ).length;

  function isReviewableStatus(status: string): boolean {
    return status === "pending" || status === "needs_contact" || status === "denied";
  }

  function isPartnerWithStats(status: string): boolean {
    return status === "active" || status === "suspended";
  }
  const selected = accounts.find((a) => a.id === selectedId) ?? null;

  function handleAccountRowClick(row: AffiliateRow) {
    if (affiliateAccountOpensPartnerProfile(row.status as AffiliateAccountStatus)) {
      router.push(`/affiliate/admin/partners/${encodeURIComponent(row.id)}`);
      return;
    }
    setSelectedId(row.id);
  }

  useEffect(() => {
    if (!selectedId || !detailRef.current) return;
    const row = accounts.find((a) => a.id === selectedId);
    if (!row || affiliateAccountOpensPartnerProfile(row.status as AffiliateAccountStatus)) return;
    detailRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [selectedId, accounts]);

  useEffect(() => {
    setReviewNotesDraft(selected?.application?.adminReviewNotes ?? "");
  }, [selected?.id, selected?.application?.adminReviewNotes]);

  async function slugAction(affiliateId: string, action: "approve" | "reject") {
    setBusy(`slug:${affiliateId}`);
    setErr(null);
    setNote(null);
    try {
      const res = await fetch("/api/affiliate/admin/slug-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ affiliateId, action }),
      });
      const j = (await res.json().catch(() => ({}))) as { success?: boolean; error?: string };
      if (!res.ok || !j.success) {
        setErr(typeof j.error === "string" ? j.error : "Slug action failed.");
        return;
      }
      setNote(action === "approve" ? "Slug change approved." : "Slug request rejected.");
      await load();
    } catch {
      setErr("Slug action failed.");
    } finally {
      setBusy(null);
    }
  }

  async function saveReviewNotes(id: string) {
    setBusy(`notes:${id}`);
    setErr(null);
    setNote(null);
    try {
      const res = await fetch(`/api/affiliate/admin/accounts/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ adminReviewNotes: reviewNotesDraft.trim() || null }),
      });
      const j = (await res.json().catch(() => ({}))) as { success?: boolean; error?: string };
      if (!res.ok || !j.success) {
        setErr(typeof j.error === "string" ? j.error : "Could not save notes.");
        return;
      }
      setNote("Review notes saved.");
      await load();
    } catch {
      setErr("Could not save notes.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-zinc-900">Affiliates</h2>
        <p className="mt-1 text-sm text-zinc-600">
          Review applications, manage partners, and copy tracking paths. Standard program for every account:{" "}
          <span className="font-semibold text-zinc-800">{affiliateCommissionProgramShortLabel()}</span>.
        </p>
      </div>

      <section className="rounded-2xl border border-violet-200/70 bg-gradient-to-br from-violet-50/50 to-white p-4 shadow-sm sm:p-5">
        <h3 className="text-sm font-semibold text-zinc-900">Program reference</h3>
        <p className="mt-1 text-xs text-zinc-600">
          What partners receive and how loyalty tiers accrue — use when approving or answering applicant questions.
        </p>
        <div className="mt-4">
          <AffiliateProgramOverview variant="admin" />
        </div>
      </section>

      {pendingCount > 0 ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          {pendingCount} application{pendingCount === 1 ? "" : "s"} awaiting approval.
        </p>
      ) : null}

      <section className="rounded-2xl border border-zinc-200/90 bg-white p-4 shadow-sm sm:p-5">
        <h3 className="text-sm font-semibold text-zinc-900">Create affiliate (manual)</h3>
        <form onSubmit={createAccount} className="mt-4 grid gap-3 sm:grid-cols-2">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-9 rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-violet-400"
            required
          />
          <input
            type="password"
            placeholder="Password (12+ chars)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="h-9 rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-violet-400"
            minLength={12}
            required
          />
          <input
            placeholder="Display name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="h-9 rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-violet-400"
          />
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as "pending" | "active" | "suspended")}
            className="h-9 rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-violet-400"
          >
            <option value="pending">Pending</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
          </select>
          <button
            type="submit"
            disabled={busy !== null}
            className="h-9 rounded-lg border border-violet-300 bg-violet-600 text-sm font-semibold text-white shadow-sm hover:bg-violet-700 disabled:opacity-45 sm:col-span-2"
          >
            {busy === "create" ? "Creating…" : "Create account"}
          </button>
        </form>
      </section>

      {err ? <p className="text-sm text-red-700">{err}</p> : null}
      {note ? <p className="text-sm text-emerald-800">{note}</p> : null}

      <section className="overflow-hidden rounded-2xl border border-zinc-200/90 bg-white shadow-sm">
        <div className="border-b border-zinc-200 px-4 py-3">
          <h3 className="text-sm font-semibold text-zinc-900">All accounts</h3>
        </div>
        <div className="max-h-[28rem] overflow-auto">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 border-b border-zinc-200 bg-zinc-50 text-[10px] uppercase tracking-wider text-zinc-500">
              <tr>
                <th className="px-3 py-2">Email</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">2FA</th>
                <th className="px-3 py-2">Program</th>
                <th className="px-3 py-2">Link</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-zinc-500">
                    Loading…
                  </td>
                </tr>
              ) : accounts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-zinc-500">
                    No affiliate accounts yet.
                  </td>
                </tr>
              ) : (
                accounts.map((a) => {
                  const accountStatus = a.status as AffiliateAccountStatus;
                  const rowHint = affiliateAccountRowClickHint(accountStatus);
                  return (
                  <tr
                    key={a.id}
                    title={rowHint}
                    className={affiliateAccountRowClass(accountStatus, selectedId === a.id)}
                    onClick={() => handleAccountRowClick(a)}
                  >
                    <td className="max-w-[12rem] px-3 py-2 sm:max-w-none">
                      <span
                        className={`block truncate text-sm font-medium ${accountStatus === "denied" ? "text-zinc-500" : "text-zinc-900"}`}
                      >
                        {a.email}
                      </span>
                      {a.displayName ? (
                        <span className={accountStatus === "denied" ? "text-zinc-400" : "text-zinc-500"}>
                          {a.displayName}
                        </span>
                      ) : null}
                      {a.application?.legalName ? (
                        <span className="block text-[10px] text-zinc-400">{a.application.legalName}</span>
                      ) : null}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${AFFILIATE_STATUS_BADGE_CLASS[accountStatus] ?? "border-zinc-200 bg-zinc-50 text-zinc-700"}`}
                      >
                        {AFFILIATE_STATUS_LABELS[accountStatus] ?? a.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-zinc-600">{a.totpEnabled ? "Enabled" : "Required"}</td>
                    <td className="px-3 py-2 text-[10px] font-medium text-zinc-600">
                      {affiliateCommissionProgramShortLabel()}
                    </td>
                    <td className="max-w-[9rem] px-3 py-2 font-mono text-[10px] text-zinc-500">
                      <span className="block truncate">
                        {a.status === "active" && a.referralCode
                          ? `/r/${a.referralCode}`
                          : a.affiliateSlug
                            ? `/affiliate/r/${a.affiliateSlug}`
                            : "—"}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex flex-wrap justify-end gap-1">
                        {isReviewableStatus(a.status) && a.status !== "denied" ? (
                          <>
                            <button
                              type="button"
                              disabled={busy !== null}
                              onClick={() => void setAccountStatus(a.id, "active")}
                              className="rounded border border-emerald-300 bg-emerald-50 px-2 py-1 text-[10px] font-semibold text-emerald-900 disabled:opacity-45"
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              disabled={busy !== null}
                              onClick={() => setDenyTarget(a)}
                              className="rounded border border-red-300 bg-red-50 px-2 py-1 text-[10px] font-semibold text-red-900 disabled:opacity-45"
                            >
                              Deny
                            </button>
                            <button
                              type="button"
                              disabled={busy !== null}
                              onClick={() => void markNeedsContact(a)}
                              className="rounded border border-violet-300 bg-violet-50 px-2 py-1 text-[10px] font-semibold text-violet-900 disabled:opacity-45"
                            >
                              Contact
                            </button>
                          </>
                        ) : null}
                        {a.status === "denied" ? (
                          <span className="rounded border border-zinc-200 bg-zinc-50 px-2 py-1 text-[10px] font-medium text-zinc-500">
                            Closed
                          </span>
                        ) : null}
                        {a.status === "active" ? (
                          <button
                            type="button"
                            disabled={busy !== null}
                            onClick={() => void setAccountStatus(a.id, "suspended")}
                            className="rounded border border-red-300 bg-red-50 px-2 py-1 text-[10px] font-semibold text-red-900 disabled:opacity-45"
                          >
                            Suspend
                          </button>
                        ) : null}
                        {a.status === "suspended" ? (
                          <button
                            type="button"
                            disabled={busy !== null}
                            onClick={() => void setAccountStatus(a.id, "active")}
                            className="rounded border border-zinc-300 bg-zinc-50 px-2 py-1 text-[10px] font-semibold text-zinc-800 disabled:opacity-45"
                          >
                            Reactivate
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      <AffiliateApplicationDenyModal
        open={denyTarget !== null}
        email={denyTarget?.email ?? ""}
        busy={busy !== null}
        onClose={() => setDenyTarget(null)}
        onConfirm={(input) => {
          if (denyTarget) void denyApplication(denyTarget.id, input);
        }}
      />
      <AffiliateApplicationContactModal
        open={contactTarget !== null}
        email={contactTarget?.email ?? ""}
        application={{
          contactEmail: contactTarget?.application?.contactEmail ?? null,
          contactDiscord: contactTarget?.application?.contactDiscord ?? null,
          contactX: contactTarget?.application?.contactX ?? null,
          contactOther: contactTarget?.application?.contactOther ?? null,
        }}
        onClose={() => setContactTarget(null)}
      />

      {selected ? (
        <section
          ref={detailRef}
          className={`rounded-2xl border p-4 shadow-sm sm:p-5 ${
            selected.status === "denied"
              ? "border-zinc-200/90 bg-zinc-50"
              : selected.status === "needs_contact"
                ? "border-amber-200/90 bg-amber-50/40"
                : selected.status === "active"
                  ? "border-emerald-200/90 bg-emerald-50/30"
                  : "border-zinc-200/90 bg-white"
          }`}
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-zinc-900">
                {isPartnerWithStats(selected.status) ? "Partner" : "Application"} — {selected.email}
              </h3>
              <p className="mt-0.5 text-xs text-zinc-500">
                {AFFILIATE_STATUS_LABELS[selected.status as AffiliateAccountStatus] ?? selected.status}
              </p>
            </div>
            {isPartnerWithStats(selected.status) ? (
              <Link
                href={`/affiliate/admin/partners/${encodeURIComponent(selected.id)}`}
                className="rounded-lg border border-violet-300 bg-violet-50 px-3 py-1.5 text-xs font-semibold text-violet-900 hover:bg-violet-100"
              >
                Open full profile
              </Link>
            ) : null}
          </div>
          {selected.application?.submittedAt ? (
            <p className="mt-1 text-xs text-zinc-500">
              Submitted {new Date(selected.application.submittedAt).toLocaleString()}
            </p>
          ) : (
            <p className="mt-1 text-xs text-zinc-500">No application fields (manual account).</p>
          )}
          {selected.slugChangePending ? (
            <div className="mt-4 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2.5 text-sm">
              <p className="font-semibold text-violet-950">Pending slug change</p>
              <p className="mt-1 font-mono text-xs">
                {selected.affiliateSlug ?? "—"} → {selected.slugChangePending}
              </p>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() => void slugAction(selected.id, "approve")}
                  className="rounded border border-emerald-300 bg-emerald-50 px-2 py-1 text-[10px] font-semibold text-emerald-900"
                >
                  Approve slug
                </button>
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() => void slugAction(selected.id, "reject")}
                  className="rounded border border-red-300 bg-red-50 px-2 py-1 text-[10px] font-semibold text-red-900"
                >
                  Reject
                </button>
              </div>
            </div>
          ) : null}
          {isPartnerWithStats(selected.status) ? (
            <AffiliatePartnerSummarySection affiliateId={selected.id} />
          ) : null}
          {selected.application ? (
            <div className={isPartnerWithStats(selected.status) ? "mt-6 border-t border-zinc-200 pt-4" : "mt-4"}>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Application</h4>
              <div className="mt-3">
                <AffiliateApplicationDetails email={selected.email} application={selected.application} />
              </div>
            </div>
          ) : null}
          {isReviewableStatus(selected.status) ? (
            <div className="mt-4 flex flex-wrap gap-2 border-t border-zinc-200 pt-4">
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => void setAccountStatus(selected.id, "active")}
                className="rounded-lg border border-emerald-300 bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-45"
              >
                Approve
              </button>
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => setDenyTarget(selected)}
                className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-xs font-semibold text-red-900 hover:bg-red-100 disabled:opacity-45"
              >
                Deny…
              </button>
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => void markNeedsContact(selected)}
                className="rounded-lg border border-violet-300 bg-violet-50 px-3 py-2 text-xs font-semibold text-violet-900 hover:bg-violet-100 disabled:opacity-45"
              >
                Contact…
              </button>
            </div>
          ) : null}
          <label className="mt-4 block">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Ops review notes</span>
            <textarea
              value={reviewNotesDraft}
              onChange={(e) => setReviewNotesDraft(e.target.value)}
              className="mt-1 min-h-[72px] w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-violet-400"
              placeholder="Internal notes for approve/deny decisions…"
            />
          </label>
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => void saveReviewNotes(selected.id)}
            className="mt-3 h-9 rounded-lg border border-violet-300 bg-violet-600 px-4 text-xs font-semibold text-white hover:bg-violet-700 disabled:opacity-45"
          >
            {busy === `notes:${selected.id}` ? "Saving…" : "Save review notes"}
          </button>
        </section>
      ) : null}

      <p className="text-xs text-zinc-500">
        Self-serve apply URL (share directly, not on member site):{" "}
        <span className="font-mono text-zinc-700">/affiliate/register</span>
      </p>
    </div>
  );
}
