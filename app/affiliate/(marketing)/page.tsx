import type { Metadata } from "next";
import Link from "next/link";
import { AffiliateProgramOverview } from "@/app/affiliate/_components/AffiliateProgramOverview";
import { AffiliateEarningsGuide } from "@/app/affiliate/(partner)/_components/AffiliateEarningsGuide";
import { affiliateCommissionProgramShortLabel, AFFILIATE_MONTHLY_MAX_COMMISSION_PAYMENTS, AFFILIATE_REVSHARE_BASE_BPS, AFFILIATE_REVSHARE_LOYAL_BPS, AFFILIATE_REVSHARE_MID_BPS, AFFILIATE_REVSHARE_UNLOCK_LOYAL_AT_PAYMENT, AFFILIATE_REVSHARE_UNLOCK_MID_AT_PAYMENT, revshareRatePercentLabel } from "@/lib/affiliate/affiliateCommissionSchedule";
import { AFFILIATE_AFTER_APPLY_STEPS } from "@/lib/affiliate/affiliateRegisterCopy";

export const metadata: Metadata = {
  title: "Affiliate program",
  description: "Earn recurring commission and bonuses promoting McGBot Terminal to your audience.",
};

export default function AffiliateMarketingHomePage() {  return (
    <div>
      <section className="relative overflow-hidden border-b border-violet-200/60 bg-gradient-to-br from-violet-600 via-violet-700 to-indigo-900 text-white">
        <div
          className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-white/10 blur-3xl"
          aria-hidden
        />
        <div className="relative mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-violet-200">McGBot affiliate program</p>
          <h1 className="mt-3 max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl lg:text-5xl">
            Earn when your audience subscribes to McGBot Terminal
          </h1>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-violet-100 sm:text-lg">
            Promote McGBot Terminal with your link. Standard program:{" "}
            <span className="font-semibold text-white">{affiliateCommissionProgramShortLabel()}</span> rev-share on
            each referred member&apos;s payments, plus milestone bonuses and annual signup extras.
          </p>
          <dl className="mt-6 flex flex-wrap gap-3">
            {[
              { label: "Base rev-share", value: revshareRatePercentLabel(AFFILIATE_REVSHARE_BASE_BPS) },
              {
                label: `Unlocks at payment ${AFFILIATE_REVSHARE_UNLOCK_MID_AT_PAYMENT}`,
                value: revshareRatePercentLabel(AFFILIATE_REVSHARE_MID_BPS),
              },
              {
                label: `Unlocks at payment ${AFFILIATE_REVSHARE_UNLOCK_LOYAL_AT_PAYMENT}`,
                value: revshareRatePercentLabel(AFFILIATE_REVSHARE_LOYAL_BPS),
              },
              { label: "Monthly cap", value: `${AFFILIATE_MONTHLY_MAX_COMMISSION_PAYMENTS} payments` },
            ].map((s) => (
              <div
                key={s.label}
                className="rounded-lg border border-white/20 bg-white/10 px-3 py-2 backdrop-blur"
              >
                <dt className="text-[10px] font-semibold uppercase tracking-wider text-violet-200">{s.label}</dt>
                <dd className="mt-0.5 text-lg font-semibold tabular-nums text-white">{s.value}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/affiliate/register"
              className="inline-flex h-11 items-center rounded-lg bg-white px-5 text-sm font-semibold text-violet-800 shadow-lg hover:bg-violet-50"
            >
              Apply to become an affiliate
            </Link>
            <Link
              href="/affiliate/login"
              className="inline-flex h-11 items-center rounded-lg border border-white/30 bg-white/10 px-5 text-sm font-semibold text-white backdrop-blur hover:bg-white/20"
            >
              Sign in
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-16">
        <AffiliateProgramOverview variant="marketing" />
      </section>

      <section id="how-you-earn" className="scroll-mt-8 border-y border-zinc-200/80 bg-zinc-50/80 py-14 sm:py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 className="text-2xl font-semibold tracking-tight text-zinc-900">Full earnings breakdown</h2>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-zinc-600">
            Exact rules for recurring %, milestone bonuses, annual signup extras, and hold periods — what we use in the
            ledger when you refer real subscribers.
          </p>
          <div className="mt-8 rounded-2xl border border-zinc-200/90 bg-white p-5 shadow-sm sm:p-6">
            <AffiliateEarningsGuide variant="full" />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-16">
        <div className="grid gap-10 lg:grid-cols-2 lg:gap-14">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-zinc-900">Application process</h2>
            <p className="mt-3 text-sm leading-relaxed text-zinc-600 sm:text-base">
              We manually review every partner for promotion fit and compliance. Mandatory 2FA before dashboard access.
            </p>
            <ul className="mt-6 space-y-3 text-sm text-zinc-700">
              <li className="flex gap-2">
                <span className="text-violet-600" aria-hidden>
                  ✓
                </span>
                Real product — Basic and Pro monthly or annual plans
              </li>
              <li className="flex gap-2">
                <span className="text-violet-600" aria-hidden>
                  ✓
                </span>
                Net rev-share on qualifying subscription invoices
              </li>
              <li className="flex gap-2">
                <span className="text-violet-600" aria-hidden>
                  ✓
                </span>
                Separate affiliate portal — not Discord member login
              </li>
            </ul>
          </div>
          <div className="rounded-2xl border border-zinc-200/90 bg-white p-5 shadow-sm sm:p-6">
            <h2 className="text-lg font-semibold text-zinc-900">How it works</h2>
            <ol className="mt-4 space-y-3">
              {AFFILIATE_AFTER_APPLY_STEPS.map((step, i) => (
                <li key={step} className="flex gap-3 text-sm text-zinc-700">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-violet-100 text-xs font-bold text-violet-800">
                    {i + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      <section className="border-t border-zinc-200/80 bg-gradient-to-b from-violet-50 to-zinc-50 py-16 sm:py-20">
        <div className="mx-auto max-w-2xl px-4 text-center sm:px-6">
          <h2 className="text-2xl font-semibold tracking-tight text-zinc-900">Ready to apply?</h2>
          <p className="mt-3 text-sm leading-relaxed text-zinc-600">
            About five minutes. We review every application — clear answers about your audience and promotion plan help.
          </p>
          <Link
            href="/affiliate/register"
            className="mt-8 inline-flex h-12 items-center rounded-lg bg-violet-600 px-8 text-sm font-semibold text-white shadow-md hover:bg-violet-700"
          >
            Start your application
          </Link>
          <p className="mt-4 text-xs text-zinc-500">
            Questions first?{" "}
            <Link href="/affiliate/faq" className="font-semibold text-violet-700 hover:underline">
              Read the FAQ
            </Link>{" "}
            or{" "}
            <Link href="/affiliate/support" className="font-semibold text-violet-700 hover:underline">
              contact us
            </Link>
            .
          </p>
        </div>
      </section>    </div>
  );
}
