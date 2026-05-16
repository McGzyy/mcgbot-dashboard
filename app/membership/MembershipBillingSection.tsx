"use client";

import {
  MembershipSolCheckout,
  MembershipSolPayNote,
} from "@/app/membership/MembershipSolCheckout";
import {
  billingCadenceLabel,
  billingPeriodNoun,
  formatUsd,
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
  onProductLineChange: (line: ProductTier) => void;
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
  onProductLineChange,
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
  const accentSelected =
    productLine === "pro"
      ? "border-sky-400/55 bg-sky-500/12 text-sky-50 shadow-[0_0_0_1px_rgba(56,189,248,0.25)]"
      : "border-emerald-400/55 bg-emerald-500/12 text-emerald-50 shadow-[0_0_0_1px_rgba(52,211,153,0.25)]";

  const selectedMonthly =
    selectedPlan != null
      ? planMonthlyEquivalent(selectedPlan.priceUsd, selectedPlan.billingMonths)
      : null;

  return (
    <section className="mx-auto w-full max-w-6xl" aria-labelledby="membership-billing-heading">
      <div className="overflow-hidden rounded-3xl border border-zinc-800/75 bg-[linear-gradient(168deg,rgba(24,24,27,0.88)_0%,rgba(9,9,11,0.96)_42%,rgba(0,0,0,0.72)_100%)] shadow-[0_40px_140px_rgba(0,0,0,0.55)] ring-1 ring-white/[0.05]">
        <div className="border-b border-zinc-800/70 px-6 py-6 sm:px-8 sm:py-7">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="max-w-2xl">
              <p
                id="membership-billing-heading"
                className="text-[10px] font-semibold uppercase tracking-[0.28em] text-zinc-500"
              >
                Choose your plan
              </p>
              <h2 className="mt-2 text-xl font-semibold tracking-tight text-white sm:text-2xl">
                {lineMeta.title} membership · pick a billing period
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                Longer periods save more. Pay with Stripe or SOL — promotion codes are entered on
                Stripe&apos;s checkout page.
              </p>
            </div>
            <a
              href={discordInviteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex shrink-0 items-center justify-center rounded-xl border border-zinc-700/60 bg-zinc-900/60 px-4 py-2.5 text-xs font-semibold text-zinc-200 transition hover:border-zinc-600 hover:bg-zinc-800/80 hover:text-white"
            >
              Questions? Discord
            </a>
          </div>

          <div
            className="mt-6 grid grid-cols-2 gap-1 rounded-2xl border border-zinc-800/80 bg-zinc-950/80 p-1 sm:max-w-md"
            role="tablist"
            aria-label="Membership tier"
          >
            {(["basic", "pro"] as const).map((line) => {
              const active = productLine === line;
              const meta = TIER_MARKETING[line];
              return (
                <button
                  key={line}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => onProductLineChange(line)}
                  className={`rounded-xl px-4 py-3 text-left transition ${
                    active
                      ? line === "pro"
                        ? "bg-sky-500/15 text-sky-50 ring-1 ring-sky-400/35"
                        : "bg-emerald-500/15 text-emerald-50 ring-1 ring-emerald-400/35"
                      : "text-zinc-500 hover:text-zinc-300"
                  }`}
                >
                  <span className="block text-sm font-semibold">{meta.title}</span>
                  <span className="mt-0.5 block text-[11px] leading-snug text-zinc-500">
                    {line === "basic" ? "Desk & profiles" : "API-heavy features"}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="px-6 py-6 sm:px-8 sm:py-8">
          {maintenanceNote}
          {signupsPausedNote}
          {signupsPausedAdminNote}

          {plansError ? (
            <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {plansError}
            </p>
          ) : plansLoading ? (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-[168px] animate-pulse rounded-2xl border border-zinc-800/60 bg-zinc-900/40"
                />
              ))}
            </div>
          ) : plansForLine.length === 0 ? (
            <p className="text-sm text-zinc-500">
              No {productLine === "pro" ? "Pro" : "Basic"} billing options are configured yet. Add
              plans in Admin or run the latest Supabase migrations.
            </p>
          ) : (
            <div
              className={
                planCardsVisuallyLocked
                  ? "pointer-events-none grid gap-3 opacity-50 grayscale sm:grid-cols-2 xl:grid-cols-4"
                  : "grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
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

                return (
                  <button
                    key={p.slug}
                    type="button"
                    onClick={() => onSelectSlug(p.slug)}
                    className={[
                      "group relative flex flex-col rounded-2xl border px-4 pb-4 pt-4 text-left transition duration-200",
                      selected
                        ? accentSelected
                        : "border-zinc-800/90 bg-zinc-950/50 hover:border-zinc-600/80 hover:bg-zinc-900/40",
                    ].join(" ")}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        {featured ? (
                          <span className="mb-2 inline-flex rounded-full border border-amber-400/40 bg-amber-500/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-100">
                            Best value
                          </span>
                        ) : (
                          <span className="mb-2 block h-[18px]" aria-hidden />
                        )}
                        <span className="block text-base font-semibold text-white">{p.label}</span>
                        <span className="mt-1 block text-[12px] text-zinc-500">
                          {billingCadenceLabel(p.billingMonths, p.durationDays)}
                        </span>
                      </div>
                      <span
                        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition ${
                          selected
                            ? productLine === "pro"
                              ? "border-sky-300/60 bg-sky-400/20 text-sky-100"
                              : "border-emerald-300/60 bg-emerald-400/20 text-emerald-100"
                            : "border-zinc-700/80 bg-zinc-900/60 text-transparent group-hover:border-zinc-600"
                        }`}
                        aria-hidden
                      >
                        <CheckIcon className="h-3.5 w-3.5" />
                      </span>
                    </div>

                    <div className="mt-5">
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-3xl font-bold tabular-nums tracking-tight text-white">
                          {formatUsd(p.priceUsd)}
                        </span>
                        <span className="text-xs font-medium text-zinc-500">
                          / {billingPeriodNoun(p.billingMonths)}
                        </span>
                      </div>
                      {showMonthlyEq && monthlyEq != null ? (
                        <p className="mt-1 text-[12px] text-zinc-500">
                          ≈ {formatUsd(monthlyEq)}/mo equivalent
                        </p>
                      ) : null}
                      {showDiscount ? (
                        <p className="mt-2 text-[11px] leading-relaxed text-zinc-500">
                          <span className="tabular-nums line-through decoration-zinc-600">
                            {formatUsd(listPriceUsd!)}
                          </span>
                          <span className="text-zinc-600"> · </span>
                          <span className="font-medium text-emerald-300/90">
                            {discountPercent}% off
                          </span>
                          {savingsUsd > 0 ? (
                            <span className="text-zinc-600"> · save {formatUsd(savingsUsd)}</span>
                          ) : null}
                        </p>
                      ) : (
                        <p className="mt-2 h-[16px]" aria-hidden />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(260px,320px)] lg:items-start">
            <div className="order-2 flex flex-col gap-3 lg:order-1">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  disabled={busy || testCheckoutBusy || !selectedPlan || !checkoutAllowed}
                  aria-busy={busy || testCheckoutBusy}
                  onClick={onStartCheckout}
                  className="h-12 w-full rounded-2xl bg-[linear-gradient(180deg,rgba(34,197,94,1),rgba(22,163,74,1))] px-6 text-sm font-semibold text-black shadow-[0_20px_60px_rgba(34,197,94,0.2)] transition hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-[color:var(--accent)]/40 disabled:cursor-not-allowed disabled:opacity-50"
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
                <p className="text-center text-xs text-amber-200/85" role="status">
                  Checking Discord server membership…
                </p>
              ) : null}

              <MembershipSolPayNote />

              <p className="text-center text-[11px] leading-relaxed text-zinc-600">
                Stripe checkout is hosted by Stripe. SOL is signed in your wallet on Solana.
              </p>

              <div className="border-t border-zinc-800/60 pt-3">
                <button
                  type="button"
                  onClick={onToggleComplimentary}
                  className="text-xs font-medium text-zinc-500 transition hover:text-zinc-300"
                >
                  {showComplimentary ? "Hide complimentary code" : "Have a 100% off code?"}
                </button>
              </div>

              {showComplimentary ? (
                <div className="rounded-2xl border border-zinc-800/70 bg-zinc-950/50 p-4">
                  <label className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
                    Complimentary code
                  </label>
                  <p className="mt-1 text-xs text-zinc-500">
                    Staff-issued codes only. Percent-off promos belong on Stripe checkout.
                  </p>
                  <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
                    <input
                      type="text"
                      value={complimentaryCode}
                      onChange={(e) => onComplimentaryCodeChange(e.target.value)}
                      placeholder="Enter code"
                      className="h-11 w-full min-w-0 flex-1 rounded-xl border border-zinc-800/70 bg-black/40 px-4 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-zinc-600 focus:ring-2 focus:ring-[color:var(--accent)]/15"
                    />
                    <button
                      type="button"
                      disabled={redeemBusy || !selectedPlan || !checkoutAllowed}
                      aria-busy={redeemBusy}
                      onClick={onRedeemComplimentary}
                      className="h-11 shrink-0 rounded-xl border border-zinc-700/55 bg-zinc-800/50 px-4 text-sm font-semibold text-zinc-100 transition hover:bg-zinc-700/55 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {redeemBusy ? "Applying…" : "Apply"}
                    </button>
                  </div>
                  {redeemError ? <p className="mt-2 text-xs text-red-300">{redeemError}</p> : null}
                </div>
              ) : null}
            </div>

            <aside className="order-1 rounded-2xl border border-zinc-800/70 bg-zinc-950/60 p-5 lg:order-2 lg:sticky lg:top-24">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
                Order summary
              </p>
              {selectedPlan ? (
                <>
                  <p className="mt-3 text-lg font-semibold text-white">
                    {TIER_MARKETING[productLine].title} · {selectedPlan.label}
                  </p>
                  <p className="mt-1 text-sm text-zinc-500">
                    {billingCadenceLabel(selectedPlan.billingMonths, selectedPlan.durationDays)}
                  </p>
                  <div className="mt-5 flex items-end justify-between gap-3 border-t border-zinc-800/60 pt-4">
                    <span className="text-sm text-zinc-400">Due today</span>
                    <span className="text-2xl font-bold tabular-nums text-white">
                      {formatUsd(selectedPlan.priceUsd)}
                    </span>
                  </div>
                  {selectedMonthly != null && selectedPlan.billingMonths > 1 ? (
                    <p className="mt-1 text-right text-[11px] text-zinc-500">
                      ≈ {formatUsd(selectedMonthly)}/mo
                    </p>
                  ) : null}
                  {!checkoutAllowed ? (
                    <p className="mt-4 rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs text-amber-100/90">
                      Complete Discord login and server verification to unlock checkout.
                    </p>
                  ) : null}
                </>
              ) : (
                <p className="mt-3 text-sm text-zinc-500">Select a billing period to continue.</p>
              )}
            </aside>
          </div>

          {checkoutError ? (
            <p className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {checkoutError}
            </p>
          ) : null}
          {pollNote ? <p className="mt-3 text-sm text-[color:var(--accent)]">{pollNote}</p> : null}

          <div className="mt-8 grid gap-4 border-t border-zinc-800/60 pt-8 sm:grid-cols-2">
            <section className="text-xs leading-relaxed text-zinc-500">
              <p className="font-semibold text-zinc-300">What you get</p>
              <ul className="mt-2 space-y-1.5 text-zinc-500">
                <li>Full dashboard for your tier (Basic or Pro)</li>
                <li>Payments extend access from your current end date</li>
                <li>Stripe renewals via webhooks; SOL confirms on-chain after signing</li>
              </ul>
            </section>
            <section className="text-xs leading-relaxed text-zinc-500">
              <p className="font-semibold text-zinc-300">Refunds</p>
              <p className="mt-2">
                Contact a moderator in Discord for refund requests. An automated refund window is
                planned for a later release.
              </p>
            </section>
          </div>
        </div>
      </div>
    </section>
  );
}
