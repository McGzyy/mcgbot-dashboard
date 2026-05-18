"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { formatUsd } from "@/lib/subscription/planDisplay";
import type { MembershipPlan } from "@/app/membership/MembershipBillingSection";

type CreditPlan = {
  slug: string;
  label: string;
  durationDays: number;
  priceUsd: number;
  discountPercent: number;
};

function fmtUsdFromCents(cents: number): string {
  const n = Math.max(0, Math.floor(Number(cents) || 0)) / 100;
  return n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 2 });
}

function planCostCents(plan: CreditPlan): number {
  const list = Math.max(0, Number(plan.priceUsd));
  const pct = Math.max(0, Math.min(100, Math.floor(Number(plan.discountPercent) || 0)));
  return Math.round(list * (1 - pct / 100) * 100);
}

export function MembershipReferralCreditPanel({
  isLoggedIn,
  selectedPlan,
  onRedeemed,
}: {
  isLoggedIn: boolean;
  selectedPlan: MembershipPlan | null;
  onRedeemed: (message: string) => void;
}) {
  const [balanceCents, setBalanceCents] = useState(0);
  const [plans, setPlans] = useState<CreditPlan[]>([]);
  const [exemptCapNote, setExemptCapNote] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!isLoggedIn) {
      setBalanceCents(0);
      setPlans([]);
      setLoaded(true);
      return;
    }
    try {
      const res = await fetch("/api/me/referral-credit", { credentials: "same-origin" });
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        balanceCents?: number;
        plans?: CreditPlan[];
        redemption?: { exemptCapApplies?: boolean; exemptCapMonths?: number | null };
        error?: string;
      };
      if (!res.ok || !json.ok) {
        setBalanceCents(0);
        setPlans([]);
        return;
      }
      setBalanceCents(Math.max(0, Math.floor(Number(json.balanceCents) || 0)));
      setPlans(Array.isArray(json.plans) ? json.plans : []);
      if (json.redemption?.exemptCapApplies && json.redemption.exemptCapMonths != null) {
        setExemptCapNote(
          `Complimentary access: referral credit can cover up to ${json.redemption.exemptCapMonths} months per exemption window.`
        );
      } else {
        setExemptCapNote(null);
      }
    } catch {
      setBalanceCents(0);
    } finally {
      setLoaded(true);
    }
  }, [isLoggedIn]);

  useEffect(() => {
    setLoaded(false);
    void load();
  }, [load]);

  const selectedCostCents = useMemo(() => {
    if (!selectedPlan) return null;
    const match = plans.find((p) => p.slug === selectedPlan.slug);
    if (match) return planCostCents(match);
    const pct = Math.max(0, Math.min(100, Math.round(Number(selectedPlan.discountPercent) || 0)));
    return Math.round(selectedPlan.priceUsd * (1 - pct / 100) * 100);
  }, [plans, selectedPlan]);

  const canRedeemSelected =
    Boolean(selectedPlan?.slug) &&
    selectedCostCents != null &&
    selectedCostCents > 0 &&
    balanceCents >= selectedCostCents &&
    !busy;

  const redeem = useCallback(async () => {
    if (!selectedPlan?.slug || !canRedeemSelected) return;
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/me/referral-credit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ planSlug: selectedPlan.slug }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        balanceCents?: number;
        extendedDays?: number;
      };
      if (!res.ok || !json.ok) {
        setError(typeof json.error === "string" ? json.error : "Could not apply referral credit.");
        return;
      }
      setBalanceCents(Math.max(0, Math.floor(Number(json.balanceCents) || 0)));
      const days = Math.floor(Number(json.extendedDays) || 0);
      onRedeemed(
        days > 0
          ? `Referral credit applied — ${days} days added to your membership.`
          : "Referral credit applied — your membership was extended."
      );
      void load();
    } catch {
      setError("Request failed. Try again.");
    } finally {
      setBusy(false);
    }
  }, [canRedeemSelected, load, onRedeemed, selectedPlan?.slug]);

  if (!isLoggedIn || (loaded && balanceCents <= 0)) return null;

  return (
    <div className="rounded-xl border border-violet-500/30 bg-violet-500/[0.07] p-4 ring-1 ring-violet-400/10">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-violet-300/90">
            Referral credit
          </p>
          <p className="mt-1 text-lg font-bold tabular-nums text-violet-50">
            {!loaded ? "…" : fmtUsdFromCents(balanceCents)}
          </p>
          <p className="mt-1 text-[11px] leading-relaxed text-violet-100/70">
            Apply toward the billing period selected above.{" "}
            <Link href="/referrals/rewards" className="font-medium text-violet-200 underline-offset-2 hover:underline">
              View rewards
            </Link>
          </p>
        </div>
        <button
          type="button"
          disabled={!canRedeemSelected}
          aria-busy={busy}
          onClick={() => void redeem()}
          className="h-10 shrink-0 rounded-lg border border-violet-400/35 bg-violet-500/20 px-4 text-sm font-semibold text-violet-50 transition hover:bg-violet-500/30 disabled:cursor-not-allowed disabled:opacity-45"
        >
          {busy ? "Applying…" : "Apply credit to selected plan"}
        </button>
      </div>
      {selectedPlan && selectedCostCents != null && balanceCents > 0 && balanceCents < selectedCostCents ? (
        <p className="mt-2 text-[11px] text-amber-200/85">
          This plan costs {formatUsd(selectedCostCents / 100)} — you need{" "}
          {fmtUsdFromCents(selectedCostCents - balanceCents)} more credit (or pick a shorter period).
        </p>
      ) : null}
      {exemptCapNote ? <p className="mt-2 text-[11px] text-zinc-500">{exemptCapNote}</p> : null}
      {error ? <p className="mt-2 text-xs text-red-300">{error}</p> : null}
    </div>
  );
}

