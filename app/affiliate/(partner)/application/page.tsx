"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  AFFILIATE_STATUS_BADGE_CLASS,
  AFFILIATE_STATUS_LABELS,
} from "@/lib/affiliate/affiliateApplicationStatus";
import type { AffiliateAccountStatus } from "@/lib/affiliate/affiliateSession";

type ApplicationSummary = {
  legalName: string | null;
  submittedAt: string | null;
  denialReason: string | null;
  canReapplyNow?: boolean;
  reapplyBlockedMessage?: string | null;
  denialReapplyAllowed?: boolean;
};

function formatSubmittedAt(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function statusCopy(status: AffiliateAccountStatus): { title: string; body: string } {
  if (status === "denied") {
    return {
      title: "Application not approved",
      body: "Your affiliate application was reviewed and we are not able to approve it at this time.",
    };
  }
  if (status === "needs_contact") {
    return {
      title: "We need to reach you",
      body: "Our team has follow-up questions about your application. Please watch the contact methods you provided — we may email or message you shortly.",
    };
  }
  return {
    title: "Pending admin review",
    body: "Your affiliate application was received. McGBot ops reviews every application manually — you will get dashboard access after approval.",
  };
}

export default function AffiliateApplicationStatusPage() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [status, setStatus] = useState<AffiliateAccountStatus | null>(null);
  const [application, setApplication] = useState<ApplicationSummary | null>(null);
  const [checking, setChecking] = useState(false);

  const refresh = useCallback(async () => {
    setChecking(true);
    try {
      const res = await fetch("/api/affiliate/auth/session", { credentials: "same-origin" });
      const j = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        account?: {
          status?: AffiliateAccountStatus;
          email?: string;
          application?: ApplicationSummary;
        };
      };
      if (!res.ok || !j.success) {
        router.replace("/affiliate/login");
        return;
      }
      const st = j.account?.status ?? null;
      setEmail(typeof j.account?.email === "string" ? j.account.email : null);
      setApplication(j.account?.application ?? null);
      setStatus(st);

      if (st === "active") {
        const refreshSession = await fetch("/api/affiliate/auth/refresh-session", {
          method: "POST",
          credentials: "same-origin",
        });
        const rj = (await refreshSession.json().catch(() => ({}))) as { success?: boolean };
        if (refreshSession.ok && rj.success) {
          router.replace("/affiliate/auth/agreement");
        }
      }
    } catch {
      /* ignore */
    } finally {
      setChecking(false);
    }
  }, [router]);

  useEffect(() => {
    void refresh();
    const t = setInterval(() => void refresh(), 30_000);
    return () => clearInterval(t);
  }, [refresh]);

  async function logout() {
    await fetch("/api/affiliate/auth/logout", { method: "POST", credentials: "same-origin" });
    router.replace("/affiliate/login");
  }

  const submittedLabel = formatSubmittedAt(application?.submittedAt ?? null);
  const gateStatus = status ?? "pending";
  const copy = statusCopy(gateStatus);
  const badgeClass = AFFILIATE_STATUS_BADGE_CLASS[gateStatus] ?? AFFILIATE_STATUS_BADGE_CLASS.pending;

  return (
    <div className="mx-auto max-w-lg space-y-6 px-4 py-10 sm:py-14">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-violet-800/90">
          Application status
        </p>
        <h1 className="mt-1 text-xl font-semibold text-zinc-900">{copy.title}</h1>
        <p className="mt-2 text-sm leading-relaxed text-zinc-600">{copy.body}</p>
      </div>

      <div
        className={`rounded-2xl border p-4 shadow-sm ${
          gateStatus === "denied"
            ? "border-red-200/90 bg-red-50/70"
            : gateStatus === "needs_contact"
              ? "border-violet-200/90 bg-violet-50/70"
              : "border-amber-200/90 bg-amber-50/80"
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-600">
              Current status
            </p>
            <p className="mt-1 text-lg font-semibold text-zinc-900">
              {AFFILIATE_STATUS_LABELS[gateStatus]}
            </p>
          </div>
          <span
            className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${badgeClass}`}
          >
            {gateStatus.replace("_", " ")}
          </span>
        </div>
        <dl className="mt-4 space-y-2 border-t border-zinc-900/10 pt-4 text-sm">
          {email ? (
            <div className="flex justify-between gap-4">
              <dt className="text-zinc-600">Signed in as</dt>
              <dd className="text-right font-medium text-zinc-900">{email}</dd>
            </div>
          ) : null}
          {application?.legalName ? (
            <div className="flex justify-between gap-4">
              <dt className="text-zinc-600">Applicant</dt>
              <dd className="text-right font-medium text-zinc-900">{application.legalName}</dd>
            </div>
          ) : null}
          {submittedLabel ? (
            <div className="flex justify-between gap-4">
              <dt className="text-zinc-600">Submitted</dt>
              <dd className="text-right font-medium text-zinc-900">{submittedLabel}</dd>
            </div>
          ) : null}
        </dl>
      </div>

      {gateStatus === "denied" && application?.denialReason ? (
        <div className="rounded-2xl border border-red-200 bg-white p-4 shadow-sm">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-red-800/90">
            Reason from our team
          </p>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-zinc-800">
            {application.denialReason}
          </p>
        </div>
      ) : null}

      {gateStatus === "denied" ? (
        <div className="rounded-2xl border border-zinc-200/90 bg-white p-4 text-sm shadow-sm">
          {application?.canReapplyNow ? (
            <>
              <p className="font-semibold text-zinc-900">You may submit an updated application</p>
              <p className="mt-2 leading-relaxed text-zinc-600">
                Our team invited you to re-apply. Update your promotion details and submit again for review.
              </p>
              <Link
                href="/affiliate/application/reapply"
                className="mt-3 inline-flex h-10 items-center justify-center rounded-lg bg-violet-600 px-4 text-xs font-semibold text-white hover:bg-violet-700"
              >
                Resubmit application
              </Link>
            </>
          ) : (
            <>
              <p className="font-semibold text-zinc-900">Re-application</p>
              <p className="mt-2 leading-relaxed text-zinc-600">
                {application?.reapplyBlockedMessage ??
                  "You cannot submit another application with this email at this time."}
              </p>
            </>
          )}
        </div>
      ) : null}

      {gateStatus === "needs_contact" ? (
        <div className="rounded-2xl border border-violet-200 bg-white p-4 text-sm leading-relaxed text-zinc-700 shadow-sm">
          <p className="font-semibold text-zinc-900">What happens next</p>
          <p className="mt-2">
            Check the email, Discord, and X details you submitted. If you do not hear from us within a few business
            days, you can reply to your application confirmation email or contact us through the public affiliate
            support form.
          </p>
        </div>
      ) : null}

      {gateStatus === "pending" ? (
        <ol className="space-y-2 rounded-2xl border border-zinc-200/90 bg-white p-4 text-sm shadow-sm">
          <li className="flex gap-3 text-zinc-800">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-[10px] font-bold text-emerald-800">
              ✓
            </span>
            <span>
              <span className="font-semibold text-zinc-900">Application submitted</span>
              <span className="mt-0.5 block text-zinc-600">We have your promotion details on file.</span>
            </span>
          </li>
          <li className="flex gap-3 text-zinc-800">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-[10px] font-bold text-emerald-800">
              ✓
            </span>
            <span>
              <span className="font-semibold text-zinc-900">Authenticator secured</span>
              <span className="mt-0.5 block text-zinc-600">2FA is enabled on this account.</span>
            </span>
          </li>
          <li className="flex gap-3 text-zinc-800">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-violet-300 bg-violet-50 text-[10px] font-bold text-violet-800">
              …
            </span>
            <span>
              <span className="font-semibold text-zinc-900">Ops approval</span>
              <span className="mt-0.5 block text-zinc-600">
                Usually within a few business days. This page updates when your account is activated.
              </span>
            </span>
          </li>
        </ol>
      ) : null}

      <p className="text-xs leading-relaxed text-zinc-500">
        You can sign out and return anytime with your email, password, and authenticator code.
      </p>

      <button
        type="button"
        onClick={() => void refresh()}
        disabled={checking}
        className="h-10 w-full rounded-lg border border-zinc-200 bg-white text-sm font-semibold text-zinc-800 shadow-sm hover:bg-zinc-50 disabled:opacity-45"
      >
        {checking ? "Checking…" : "Check status"}
      </button>
      <button
        type="button"
        onClick={() => void logout()}
        className="h-10 w-full rounded-lg border border-zinc-200 bg-zinc-50 text-sm font-semibold text-zinc-600 hover:bg-zinc-100"
      >
        Sign out
      </button>
    </div>
  );
}
