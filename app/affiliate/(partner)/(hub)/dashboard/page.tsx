"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { AffiliatePerformanceOverview } from "@/app/affiliate/(partner)/_components/AffiliatePerformanceOverview";

type MilestoneProgress = {
  tier: number;
  threshold: number;
  activeCount: number;
  bonusCents: number;
  grantStatus: string | null;
  requiresSecondPayment: boolean;
};

function fmtUsd(cents: number): string {
  return (Math.max(0, cents) / 100).toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

function milestoneStatusLabel(status: string | null): string {
  if (!status) return "Not reached";
  if (status === "auto_paid" || status === "paid") return "Paid";
  if (status === "approved") return "Approved";
  if (status === "pending_approval") return "Pending ops review";
  if (status === "rejected") return "Rejected";
  return status;
}

export default function AffiliateDashboardPage() {
  const router = useRouter();
  const [trackingLink, setTrackingLink] = useState<string | null>(null);
  const [milestones, setMilestones] = useState<MilestoneProgress[]>([]);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setErr(null);
    try {
      const res = await fetch("/api/affiliate/dashboard", { credentials: "same-origin" });
      const j = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        error?: string;
        account?: { email: string; displayName: string | null };
        trackingLink?: string | null;
        milestones?: MilestoneProgress[];
      };
      if (!res.ok || !j.success || !j.account) {
        setErr(typeof j.error === "string" ? j.error : "Could not load dashboard.");
        return;
      }
      setEmail(j.account.email);
      setDisplayName(j.account.displayName);
      setTrackingLink(typeof j.trackingLink === "string" ? j.trackingLink : null);
      setMilestones(Array.isArray(j.milestones) ? j.milestones : []);
    } catch {
      setErr("Network error.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function logout() {
    await fetch("/api/affiliate/auth/logout", { method: "POST", credentials: "same-origin" });
    router.replace("/affiliate/login");
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-violet-700/90">
            Affiliate program
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-900 sm:text-3xl">
            {displayName ?? email ?? "Partner dashboard"}
          </h1>
          {email ? <p className="mt-1 text-sm text-zinc-500">{email}</p> : null}
        </div>
        <button
          type="button"
          onClick={() => void logout()}
          className="shrink-0 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 shadow-sm hover:bg-zinc-50"
        >
          Sign out
        </button>
      </div>

      {err ? <p className="text-sm text-red-700">{err}</p> : null}

      <AffiliatePerformanceOverview trackingLink={trackingLink} />

      {milestones.length > 0 ? (
        <section className="rounded-2xl border border-zinc-200/90 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-zinc-900">Milestone bonuses</h2>
              <p className="mt-1 text-xs leading-relaxed text-zinc-600">
                One-time cash at 10, 25, and 50 qualified actives — separate from recurring %.
              </p>
            </div>
            <Link
              href="/affiliate/resources#how-you-earn"
              className="text-xs font-semibold text-violet-700 hover:underline"
            >
              Qualification rules →
            </Link>
          </div>
          <ul className="mt-4 grid gap-3 sm:grid-cols-3">
            {milestones.map((m) => (
              <li key={m.tier} className="rounded-xl border border-zinc-100 bg-zinc-50/80 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-zinc-900">
                    {m.threshold} actives · {fmtUsd(m.bonusCents)}
                  </span>
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-violet-800">
                    {milestoneStatusLabel(m.grantStatus)}
                  </span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-zinc-200">
                  <div
                    className="h-full rounded-full bg-violet-600 transition-all"
                    style={{ width: `${Math.min(100, (m.activeCount / m.threshold) * 100)}%` }}
                  />
                </div>
                <p className="mt-1.5 text-[11px] text-zinc-500">
                  {m.activeCount} / {m.threshold} qualified
                </p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
