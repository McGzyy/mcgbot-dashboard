"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useState } from "react";
import { ProBadge } from "@/app/components/subscription/ProBadge";
import {
  BASIC_DAILY_CALLS_LIMIT,
  MEMBERSHIP_TIER_FEATURES,
  TIER_MARKETING,
  type ProductTier,
  type TierFeatureValue,
} from "@/lib/subscription/planTiers";

type MembershipAccessPanelProps = {
  variant: "welcome" | "standard";
  active: boolean;
  exempt: boolean;
  hasProFeatures: boolean;
  userProductTier: ProductTier;
  periodEnd: string | null;
  discordInviteUrl: string;
  onDismissWelcome?: () => void;
};

const PRO_PERK_LINKS = [
  { label: "Outside Calls tape", href: "/outside-calls", detail: "Off-desk X monitors in the live feed" },
  { label: "Full alerts + Discord DMs", href: "/", detail: "Create Alert on home — toggle DM mirror on Pro" },
  { label: "Unlimited desk submissions", href: "/?submitCall=1", detail: "No daily cap on logged calls" },
] as const;

const BASIC_UPGRADE_PERKS = [
  "Outside Calls & off-desk X tape",
  "Full personal alerts + Discord DM mirror",
  `Unlimited desk calls (Basic caps at ${BASIC_DAILY_CALLS_LIMIT}/day)`,
] as const;

function featureIncluded(value: TierFeatureValue, tier: ProductTier): boolean {
  if (tier === "pro") return value !== false;
  return value === true || value === "limited" || value === "10_per_day";
}

function featureLabel(value: TierFeatureValue, label: string): string {
  if (value === "10_per_day") return `${label} (${BASIC_DAILY_CALLS_LIMIT}/day on Basic)`;
  if (value === "limited") return `${label} (limited on Basic)`;
  return label;
}

export function MembershipAccessPanel({
  variant,
  active,
  exempt,
  hasProFeatures,
  userProductTier,
  periodEnd,
  discordInviteUrl,
  onDismissWelcome,
}: MembershipAccessPanelProps) {
  const router = useRouter();
  const { update } = useSession();
  const [dashboardNavBusy, setDashboardNavBusy] = useState(false);
  const tierMeta = TIER_MARKETING[userProductTier];
  const isWelcome = variant === "welcome";

  async function goToDashboard(path = "/") {
    if (dashboardNavBusy) return;
    setDashboardNavBusy(true);
    try {
      await update({ refreshAccess: true });
      router.push(path);
      router.refresh();
    } finally {
      setDashboardNavBusy(false);
    }
  }

  const unlocked = MEMBERSHIP_TIER_FEATURES.filter((row) =>
    featureIncluded(row[userProductTier], userProductTier)
  ).slice(0, isWelcome ? 6 : 0);

  return (
    <div className="rounded-3xl border border-zinc-800/80 bg-[linear-gradient(180deg,rgba(24,24,27,0.72),rgba(0,0,0,0.42))] p-8 shadow-[0_30px_120px_rgba(0,0,0,0.55)] sm:p-10">
      {isWelcome ? (
        <span className="inline-flex rounded-full border border-emerald-400/35 bg-emerald-500/12 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-100">
          Membership active
        </span>
      ) : (
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-500">Membership</p>
      )}

      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-[2rem]">
        {isWelcome ? "You're in — welcome to the desk" : active ? "You're a member" : "You're all set"}
      </h1>

      <p className="mt-4 text-sm leading-relaxed text-zinc-400">
        {isWelcome ? (
          <>
            Your <span className="font-medium text-zinc-200">{tierMeta.title}</span> access is live on this
            Discord account. Submit your first call from the terminal to start tracking performance.
          </>
        ) : active ? (
          periodEnd ? (
            <>
              Your paid access is active through{" "}
              <span className="font-medium text-zinc-200">{new Date(periodEnd).toLocaleString()}</span>.
            </>
          ) : (
            "Your membership is active and linked to this Discord account."
          )
        ) : exempt ? (
          "Your account has staff or exempt access — the full dashboard is unlocked."
        ) : (
          "Your account has dashboard access with this Discord login."
        )}
      </p>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-[color:var(--accent)]/35 bg-[color:var(--accent)]/10 px-3 py-1.5 text-xs font-medium text-[color:var(--accent)]/95">
          {active ? "Paid membership active" : exempt ? "Exempt access" : "Dashboard access"}
        </span>
        <span className="rounded-full border border-zinc-700/60 bg-zinc-900/50 px-3 py-1.5 text-xs font-medium text-zinc-200">
          {tierMeta.title} plan
        </span>
        {hasProFeatures ? <ProBadge size="sm" /> : null}
      </div>

      {isWelcome && unlocked.length > 0 ? (
        <ul className="mt-6 space-y-2 rounded-2xl border border-zinc-800/60 bg-zinc-950/40 p-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
            Unlocked now
          </p>
          {unlocked.map((row) => (
            <li key={row.label} className="flex items-start gap-2 text-sm text-zinc-300">
              <span className="mt-0.5 text-emerald-400" aria-hidden>
                ✓
              </span>
              <span>{featureLabel(row[userProductTier], row.label)}</span>
            </li>
          ))}
        </ul>
      ) : null}

      {active && !isWelcome && hasProFeatures ? (
        <div className="mt-6 rounded-2xl border border-sky-500/25 bg-sky-500/8 p-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-300/80">
            Your Pro perks
          </p>
          <ul className="mt-3 space-y-2">
            {PRO_PERK_LINKS.map((perk) => (
              <li key={perk.href}>
                <Link
                  href={perk.href}
                  className="group flex flex-col rounded-lg border border-transparent px-2 py-1.5 transition hover:border-sky-500/20 hover:bg-sky-500/10"
                >
                  <span className="text-sm font-medium text-sky-50 group-hover:text-white">
                    {perk.label} →
                  </span>
                  <span className="text-xs text-sky-100/70">{perk.detail}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {active && !isWelcome && !hasProFeatures && userProductTier === "basic" ? (
        <div className="mt-6 rounded-2xl border border-emerald-500/20 bg-emerald-500/6 p-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-300/80">
            Pro adds
          </p>
          <ul className="mt-3 space-y-1.5">
            {BASIC_UPGRADE_PERKS.map((line) => (
              <li key={line} className="flex items-start gap-2 text-sm text-zinc-300">
                <span className="mt-0.5 text-sky-400" aria-hidden>
                  +
                </span>
                <span>{line}</span>
              </li>
            ))}
          </ul>
          <Link
            href="/membership?line=pro&upgrade=1"
            className="mt-4 inline-flex h-10 items-center justify-center rounded-xl bg-sky-500/90 px-4 text-sm font-bold text-sky-950 transition hover:bg-sky-400"
          >
            Compare Pro plans
          </Link>
        </div>
      ) : null}

      <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        {isWelcome ? (
          <>
            <button
              type="button"
              disabled={dashboardNavBusy}
              onClick={() => {
                onDismissWelcome?.();
                void goToDashboard("/?submitCall=1");
              }}
              className="inline-flex h-12 flex-1 items-center justify-center rounded-2xl bg-[linear-gradient(180deg,rgba(34,197,94,1),rgba(22,163,74,1))] px-6 text-sm font-semibold text-black shadow-[0_20px_60px_rgba(34,197,94,0.2)] transition hover:brightness-110 disabled:opacity-60 sm:min-w-[220px] sm:flex-none"
            >
              Submit your first call
            </button>
            <button
              type="button"
              disabled={dashboardNavBusy}
              onClick={() => {
                onDismissWelcome?.();
                void goToDashboard();
              }}
              className="inline-flex h-12 flex-1 items-center justify-center rounded-2xl border border-zinc-700/70 bg-zinc-900/50 px-6 text-sm font-semibold text-zinc-100 transition hover:border-zinc-600 hover:bg-zinc-800/60 disabled:opacity-60 sm:min-w-[200px] sm:flex-none"
            >
              Explore dashboard
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              disabled={dashboardNavBusy}
              onClick={() => void goToDashboard("/")}
              className="inline-flex h-12 flex-1 items-center justify-center rounded-2xl bg-[linear-gradient(180deg,rgba(34,197,94,1),rgba(22,163,74,1))] px-6 text-sm font-semibold text-black shadow-[0_20px_60px_rgba(34,197,94,0.2)] transition hover:brightness-110 disabled:opacity-60 sm:min-w-[200px] sm:flex-none"
            >
              {dashboardNavBusy ? "Opening…" : "Go to dashboard"}
            </button>
            <a
              href={discordInviteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-12 flex-1 items-center justify-center rounded-2xl border border-zinc-700/70 bg-zinc-900/50 px-6 text-sm font-semibold text-zinc-100 transition hover:border-zinc-600 hover:bg-zinc-800/60 sm:min-w-[200px] sm:flex-none"
            >
              Open Discord
            </a>
          </>
        )}
      </div>
    </div>
  );
}
