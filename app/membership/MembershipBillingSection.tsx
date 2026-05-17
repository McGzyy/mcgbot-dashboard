"use client";

import {
  MembershipSolCheckout,
  MembershipSolPayNote,
} from "@/app/membership/MembershipSolCheckout";
import {
  annualSavingsVsMonthly,
  billingCadenceLabel,
  billingPeriodNoun,
  formatUsd,
  planCadenceTitle,
  planMonthlyEquivalent,
} from "@/lib/subscription/planDisplay";
import { TIER_MARKETING, type ProductTier } from "@/lib/subscription/planTiers";

export type MembershipPlan = {
  slug: string;
  label: string;
  priceUsd: number;
  listPriceUsd?: number;
  discountPercent?: number;
  durationDays: number;
  billingMonths: number;
  productTier?: ProductTier;
};

type MembershipBillingSectionProps = {
  productLine: ProductTier;
  plansForLine: MembershipPlan[];
  plansError: string | null;
  plansLoading: boolean;
  selectedSlug: string;
  onSelectSlug: (slug: string) => void;
  selectedPlan: MembershipPlan | null;
  featuredSlug: string;
  planCardsVisuallyLocked: boolean;
  checkoutAllowed: boolean;
  isLoggedIn: boolean;
  guildGateLoading: boolean;
  busy: boolean;
  testCheckoutBusy: boolean;
  subscribeButtonLabel: string | null;
  discordInviteUrl: string;
  checkoutError: string | null;
  pollNote: string | null;
  showComplimentary: boolean;
  onToggleComplimentary: () => void;
  complimentaryCode: string;
  onComplimentaryCodeChange: (value: string) => void;
  redeemBusy: boolean;
  redeemError: string | null;
  onStartCheckout: () => void;
  onRedeemComplimentary: () => void;
  onSolActivated: () => Promise<void>;
  maintenanceNote?: React.ReactNode;
  signupsPausedNote?: React.ReactNode;
  signupsPausedAdminNote?: React.ReactNode;
};

function CheckIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className={className} aria-hidden>
      <path
        fillRule="evenodd"
        d="M16.704 5.29a1 1 0 0 1 .006 1.413l-7.25 7.35a1 1 0 0 1-1.435.006L3.29 9.643a1 1 0 1 1 1.42-1.406l3.573 3.664 6.532-6.63a1 1 0 0 1 1.41-.02Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

export function MembershipBillingSection({
  productLine,
  plansForLine,
  plansError,
  plansLoading,
  selectedSlug,
  onSelectSlug,
  selectedPlan,
  featuredSlug,
  planCardsVisuallyLocked,
  checkoutAllowed,
  isLoggedIn,
  guildGateLoading,
  busy,
  testCheckoutBusy,
  subscribeButtonLabel,
  discordInviteUrl,
  checkoutError,
  pollNote,
  showComplimentary,
  onToggleComplimentary,
  complimentaryCode,
  onComplimentaryCodeChange,
  redeemBusy,
  redeemError,
  onStartCheckout,
  onRedeemComplimentary,
  onSolActivated,
  maintenanceNote,
  signupsPausedNote,
  signupsPausedAdminNote,
}: MembershipBillingSectionProps) {
  const lineMeta = TIER_MARKETING[productLine];
  const isPro = productLine === "pro";

  const accentSelected = isPro
    ? "border-sky-400/55 bg-sky-500/10 text-sky-50 shadow-[0_0_0_1px_rgba(56,189,248,0.3),0_16px_48px_-20px_rgba(14,165,233,0.4)]"
    : "border-emerald-400/50 bg-emerald-500/10 text-emerald-50 shadow-[0_0_0_1px_rgba(52,211,153,0.28),0_16px_48px_-20px_rgba(16,185,129,0.25)]";

  const accentCheck = isPro
    ? "border-sky-300/60 bg-sky-400/25 text-sky-100"
    : "border-emerald-300/60 bg-emerald-400/25 text-emerald-100";

  const selectedMonthly =
    selectedPlan != null
      ? planMonthlyEquivalent(selectedPlan.priceUsd, selectedPlan.billingMonths)
      : null;

  const monthlyPlan = plansForLine.find((p) => p.billingMonths === 1) ?? null;
  const annualPlan = plansForLine.find((p) => p.billingMonths === 12) ?? null;
  const annualSavings = annualSavingsVsMonthly(monthlyPlan, annualPlan);
  const selectedAnnualSavings =
    selectedPlan?.billingMonths === 12 ? annualSavings : null;

  return (
    <section className="mx-auto w-full max-w-4xl" aria-labelledby="membership-billing-heading">
      <div className="overflow-hidden rounded-3xl border border-zinc-800/60 bg-[linear-gradient(168deg,rgba(18,18,20,0.95)_0%,rgba(6,6,8,0.98)_48%,rgba(0,0,0,0.85)_100%)] shadow-[0_32px_120px_rgba(0,0,0,0.65)] ring-1 ring-white/[0.04]">
        <div className="border-b border-zinc-800/50 px-5 py-5 sm:px-7 sm:py-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-zinc-500">Step 2</p>
              <h2
                id="membership-billing-heading"
                className="mt-1.5 text-xl font-semibold tracking-tight text-white sm:text-2xl"
              >
                Billing & checkout
              </h2>
              <p className="mt-2 max-w-lg text-sm leading-relaxed text-zinc-500">
                <span
                  className={`font-medium ${isPro ? "text-sky-300/90" : "text-emerald-300/90"}`}
                >
                  {lineMeta.title}
                </span>
                {" · "}
                Monthly or annual. Stripe promos apply at checkout.
              </p>
            </div>
            <a
              href={discordInviteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex shrink-0 items-center justify-center self-start rounded-xl border border-zinc-700/50 bg-zinc-900/50 px-3.5 py-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-400 transition hover:border-zinc-600 hover:text-zinc-200"
            >
              Support
            </a>
          </div>
        </div>

        <div className="px-5 py-6 sm:px-7 sm:py-8">
          {maintenanceNote}
          {signupsPausedNote}
          {signupsPausedAdminNote}

          {plansError ? (
            <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {plansError}
            </p>
          ) : plansLoading ? (
            <div className="grid max-w-xl gap-3 sm:grid-cols-2">
              {[0, 1].map((i) => (
                <div
                  key={i}
                  className="h-[152px] animate-pulse rounded-2xl border border-zinc-800/50 bg-zinc-900/30"
                />
              ))}
            </div>
          ) : plansForLine.length === 0 ? (
            <p className="text-sm text-zinc-500">
              No {isPro ? "Pro" : "Basic"} billing options are configured yet.
            </p>
          ) : (
            <>
            {annualSavings ? (
              <div
                className={`mb-4 max-w-xl rounded-2xl border px-4 py-3.5 sm:px-5 ${
                  isPro
                    ? "border-sky-500/25 bg-sky-500/10"
                    : "border-emerald-500/25 bg-emerald-500/10"
                }`}
              >
                <p
                  className={`text-[10px] font-bold uppercase tracking-[0.2em] ${
                    isPro ? "text-sky-300/90" : "text-emerald-300/90"
                  }`}
                >
                  Save with annual
                </p>
                <p className="mt-1.5 text-sm leading-relaxed text-zinc-200">
                  Pay{" "}
                  <span className="font-semibold tabular-nums text-white">
                    {formatUsd(annualSavings.savingsUsd)}
                  </span>{" "}
                  less than twelve monthly payments (
                  <span className="font-semibold tabular-nums text-zinc-300">
                    {annualSavings.savingsPercent}% off
                  </span>
                  ) — about{" "}
                  <span className="font-semibold tabular-nums text-zinc-300">
                    {formatUsd(annualSavings.monthlyIfAnnual)}/mo
                  </span>{" "}
                  effective on annual billing.
                </p>
              </div>
            ) : null}
            <div
              className={
                planCardsVisuallyLocked
                  ? "pointer-events-none grid max-w-xl gap-3 opacity-45 grayscale sm:grid-cols-2"
                  : "grid max-w-xl gap-3 sm:grid-cols-2"
              }
            >
              {plansForLine.map((p) => {
                const selected = p.slug === selectedSlug;
                const featured = Boolean(featuredSlug && p.slug === featuredSlug);
                const discountPercent = Math.max(
                  0,
                  Math.min(100, Math.round(Number(p.discountPercent ?? 0) || 0))
                );
                const listPriceUsd = Number.isFinite(Number(p.listPriceUsd))
                  ? Number(p.listPriceUsd)
                  : null;
                const showDiscount =
                  discountPercent > 0 && listPriceUsd != null && listPriceUsd > p.priceUsd;
                const savingsUsd =
                  showDiscount && listPriceUsd != null
                    ? Math.max(0, listPriceUsd - p.priceUsd)
                    : 0;
                const monthlyEq = planMonthlyEquivalent(p.priceUsd, p.billingMonths);
                const showMonthlyEq = p.billingMonths > 1 && monthlyEq != null;
                const cadenceTitle = planCadenceTitle(p.billingMonths);

                return (
                  <button
                    key={p.slug}
                    type="button"
                    onClick={() => onSelectSlug(p.slug)}
                    className={[
                      "group relative flex min-h-[152px] flex-col rounded-2xl border px-4 pb-4 pt-3.5 text-left transition duration-200",
                      selected
                        ? accentSelected
                        : "border-zinc-800/70 bg-zinc-950/40 hover:border-zinc-600/60 hover:bg-zinc-900/35",
                    ].join(" ")}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        {featured ? (
                          <span className="mb-2 inline-flex rounded-full border border-amber-400/35 bg-gradient-to-r from-amber-500/20 to-amber-600/10 px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.14em] text-amber-100">
                            Best value
                          </span>
                        ) : (
                          <span className="mb-2 block h-[18px]" aria-hidden />
                        )}
                        <span className="block text-lg font-semibold tracking-tight text-white">
                          {cadenceTitle}
                        </span>
                        <span className="mt-0.5 block text-[11px] text-zinc-500">
                          {billingCadenceLabel(p.billingMonths, p.durationDays)}
                        </span>
                      </div>
                      <span
                        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition ${
                          selected
                            ? accentCheck
                            : "border-zinc-700/70 bg-zinc-900/50 text-transparent group-hover:border-zinc-500"
                        }`}
                        aria-hidden
                      >
                        <CheckIcon className="h-3.5 w-3.5" />
                      </span>
                    </div>

                    <div className="mt-auto pt-4">
                      <div className="flex items-baseline gap-1">
                        <span className="text-[1.65rem] font-bold tabular-nums leading-none tracking-tight text-white">
                          {formatUsd(p.priceUsd)}
                        </span>
                        <span className="text-[11px] font-medium text-zinc-500">
                          / {billingPeriodNoun(p.billingMonths)}
                        </span>
                      </div>
                      {showMonthlyEq && monthlyEq != null ? (
                        <p className="mt-1 text-[11px] text-zinc-500">
                          {formatUsd(monthlyEq)}/mo effective
                        </p>
                      ) : (
                        <p className="mt-1 h-[15px]" aria-hidden />
                      )}
                      {p.billingMonths === 12 && annualSavings ? (
                        <p className="mt-1 text-[11px] font-semibold text-emerald-300/95">
                          Save {formatUsd(annualSavings.savingsUsd)} vs 12× monthly
                        </p>
                      ) : null}
                      {showDiscount ? (
                        <p className="mt-1.5 text-[10px] leading-relaxed text-zinc-500">
                          <span className="tabular-nums line-through decoration-zinc-600/80">
                            {formatUsd(listPriceUsd!)}
                          </span>
                          <span className="mx-1 text-zinc-700">·</span>
                          <span className="font-semibold text-emerald-300/90">{discountPercent}% off</span>
                          {savingsUsd > 0 ? (
                            <>
                              <span className="mx-1 text-zinc-700">·</span>
                              <span>save {formatUsd(savingsUsd)}</span>
                            </>
                          ) : null}
                        </p>
                      ) : (
                        <p className="mt-1.5 h-[14px]" aria-hidden />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
            </>
          )}

          <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_280px] lg:items-start">
            <div className="flex flex-col gap-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-600">
                Step 3 · Pay
              </p>
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                <button
                  type="button"
                  disabled={busy || testCheckoutBusy || !selectedPlan || !checkoutAllowed}
                  aria-busy={busy || testCheckoutBusy}
                  onClick={onStartCheckout}
                  className="h-12 w-full rounded-xl bg-[linear-gradient(180deg,#34d399_0%,#16a34a_100%)] px-5 text-sm font-semibold text-zinc-950 shadow-[0_12px_40px_-8px_rgba(34,197,94,0.45)] transition hover:brightness-105 focus:outline-none focus:ring-2 focus:ring-emerald-400/35 disabled:cursor-not-allowed disabled:opacity-45"
                >
                  {busy ? "Redirecting…" : subscribeButtonLabel?.trim() || "Pay with Stripe"}
                </button>
                <MembershipSolCheckout
                  compactPrimary
                  disabled={!checkoutAllowed}
                  selectedPlanSlug={selectedSlug}
                  onActivated={onSolActivated}
                />
              </div>

              {isLoggedIn && guildGateLoading ? (
                <p className="text-center text-[11px] text-amber-200/80" role="status">
                  Verifying Discord membership…
                </p>
              ) : null}

              <MembershipSolPayNote />

              <button
                type="button"
                onClick={onToggleComplimentary}
                className="self-center text-[11px] font-medium text-zinc-600 transition hover:text-zinc-400"
              >
                {showComplimentary ? "Hide complimentary code" : "Staff complimentary code"}
              </button>

              {showComplimentary ? (
                <div className="rounded-xl border border-zinc-800/50 bg-black/30 p-4">
                  <div className="flex flex-col gap-2.5 sm:flex-row sm:items-end">
                    <input
                      type="text"
                      value={complimentaryCode}
                      onChange={(e) => onComplimentaryCodeChange(e.target.value)}
                      placeholder="Enter code"
                      className="h-10 w-full min-w-0 flex-1 rounded-lg border border-zinc-800/60 bg-zinc-950/60 px-3 text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-zinc-600 focus:ring-1 focus:ring-zinc-500/30"
                    />
                    <button
                      type="button"
                      disabled={redeemBusy || !selectedPlan || !checkoutAllowed}
                      aria-busy={redeemBusy}
                      onClick={onRedeemComplimentary}
                      className="h-10 shrink-0 rounded-lg border border-zinc-700/50 bg-zinc-800/40 px-4 text-sm font-semibold text-zinc-200 transition hover:bg-zinc-700/50 disabled:opacity-45"
                    >
                      {redeemBusy ? "Applying…" : "Apply"}
                    </button>
                  </div>
                  {redeemError ? <p className="mt-2 text-xs text-red-300">{redeemError}</p> : null}
                </div>
              ) : null}
            </div>

            <aside className="rounded-2xl border border-zinc-800/55 bg-zinc-950/50 p-5 ring-1 ring-white/[0.03] lg:sticky lg:top-20">
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
                Order summary
              </p>
              {selectedPlan ? (
                <>
                  <div className="mt-4 flex items-center gap-2">
                    <span
                      className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                        isPro
                          ? "bg-sky-500/15 text-sky-200 ring-1 ring-sky-400/25"
                          : "bg-emerald-500/15 text-emerald-200 ring-1 ring-emerald-400/25"
                      }`}
                    >
                      {lineMeta.title}
                    </span>
                    <span className="text-sm font-medium text-zinc-300">
                      {planCadenceTitle(selectedPlan.billingMonths)}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-zinc-600">
                    {billingCadenceLabel(selectedPlan.billingMonths, selectedPlan.durationDays)}
                  </p>
                  <div className="mt-5 flex items-end justify-between gap-3 border-t border-zinc-800/50 pt-4">
                    <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                      Due today
                    </span>
                    <span className="text-2xl font-bold tabular-nums tracking-tight text-white">
                      {formatUsd(selectedPlan.priceUsd)}
                    </span>
                  </div>
                  {selectedMonthly != null && selectedPlan.billingMonths > 1 ? (
                    <p className="mt-1 text-right text-[11px] text-zinc-600">
                      {formatUsd(selectedMonthly)}/mo effective
                    </p>
                  ) : null}
                  {selectedAnnualSavings ? (
                    <p className="mt-2 rounded-lg border border-emerald-500/20 bg-emerald-500/8 px-3 py-2 text-[11px] leading-relaxed text-emerald-100/90">
                      You save{" "}
                      <span className="font-semibold tabular-nums text-emerald-50">
                        {formatUsd(selectedAnnualSavings.savingsUsd)}
                      </span>{" "}
                      ({selectedAnnualSavings.savingsPercent}% off) compared with paying monthly
                      for a year.
                    </p>
                  ) : null}
                  {!checkoutAllowed ? (
                    <p className="mt-4 rounded-lg border border-amber-500/20 bg-amber-500/8 px-3 py-2.5 text-[11px] leading-relaxed text-amber-100/85">
                      Sign in with Discord and join the server to unlock checkout.
                    </p>
                  ) : null}
                </>
              ) : (
                <p className="mt-4 text-sm text-zinc-600">Select a billing period.</p>
              )}
            </aside>
          </div>

          {checkoutError ? (
            <p className="mt-4 rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {checkoutError}
            </p>
          ) : null}
          {pollNote ? <p className="mt-3 text-sm text-emerald-400/90">{pollNote}</p> : null}

          <div className="mt-8 flex flex-col gap-3 border-t border-zinc-800/40 pt-6 text-[11px] leading-relaxed text-zinc-600 sm:flex-row sm:justify-between sm:gap-8">
            <p>
              <span className="font-medium text-zinc-500">Access</span> — Payments stack on your current
              end date. Stripe renews automatically; SOL confirms on-chain.
            </p>
            <p>
              <span className="font-medium text-zinc-500">Refunds</span> — Contact moderators in Discord.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
