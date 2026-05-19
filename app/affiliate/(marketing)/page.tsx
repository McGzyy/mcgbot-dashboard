import type { Metadata } from "next";
import Link from "next/link";
import { AffiliateEarningsGuide } from "@/app/affiliate/(partner)/_components/AffiliateEarningsGuide";
import { AFFILIATE_AFTER_APPLY_STEPS } from "@/lib/affiliate/affiliateRegisterCopy";

export const metadata: Metadata = {
  title: "Affiliate program",
  description: "Earn recurring commission and bonuses promoting McGBot Terminal to your audience.",
};

const FEATURES = [
  {
    title: "Tracking link",
    body: "Your own landing URL plus campaign sub-links to see what content converts.",
  },
  {
    title: "Commission ledger",
    body: "Pending, approved, and paid amounts with rev share and bonuses broken out.",
  },
  {
    title: "Payout requests",
    body: "Request withdrawals from approved balance when you hit the minimum.",
  },
  {
    title: "Brand resources",
    body: "Approved logo and promotion rules so you stay compliant.",
  },
] as const;

export default function AffiliateMarketingHomePage() {
  return (
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
            Promote the member trading dashboard with your link. Earn 15% to start, up to 25% as referrals stay subscribed,
            plus milestone and annual signup bonuses. Separate portal — not Discord member login.
          </p>
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
        <div className="grid gap-10 lg:grid-cols-2 lg:gap-14">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-zinc-900">What you&apos;re promoting</h2>
            <p className="mt-3 text-sm leading-relaxed text-zinc-600 sm:text-base">
              McGBot Terminal is our paid member product — scanner, desk calls, leaderboards, and performance tools for
              crypto traders. Your job is to send qualified subscribers, not to sell access to this affiliate portal.
            </p>
            <ul className="mt-6 space-y-3 text-sm text-zinc-700">
              <li className="flex gap-2">
                <span className="text-violet-600" aria-hidden>
                  ✓
                </span>
                Real product with monthly and annual plans
              </li>
              <li className="flex gap-2">
                <span className="text-violet-600" aria-hidden>
                  ✓
                </span>
                Manual application review — we care about fit and compliance
              </li>
              <li className="flex gap-2">
                <span className="text-violet-600" aria-hidden>
                  ✓
                </span>
                Mandatory 2FA on your affiliate account
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

      <section id="how-you-earn" className="scroll-mt-8 border-y border-zinc-200/80 bg-white py-14 sm:py-16">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <h2 className="text-2xl font-semibold tracking-tight text-zinc-900">How you earn</h2>
          <p className="mt-2 text-sm leading-relaxed text-zinc-600">
            Three ways to get paid — recurring % on each member&apos;s payments, referral milestones, and annual signup
            bonuses.
          </p>
          <div className="mt-8">
            <AffiliateEarningsGuide variant="full" />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-16">
        <h2 className="text-2xl font-semibold tracking-tight text-zinc-900">What you get after approval</h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {FEATURES.map((f) => (
            <div key={f.title} className="rounded-2xl border border-zinc-200/90 bg-white p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-zinc-900">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-zinc-600">{f.body}</p>
            </div>
          ))}
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
      </section>
    </div>
  );
}
