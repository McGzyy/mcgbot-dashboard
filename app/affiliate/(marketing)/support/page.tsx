import type { Metadata } from "next";
import Link from "next/link";
import { AffiliatePublicContactForm } from "@/app/affiliate/_components/AffiliatePublicContactForm";

export const metadata: Metadata = {
  title: "Contact",
  description: "Contact the McGBot affiliate team — for prospects and program questions.",
};

export default function AffiliateSupportPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6 sm:py-14">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-violet-700/90">Contact</p>
      <h1 className="mt-1 text-3xl font-semibold tracking-tight text-zinc-900">Get in touch</h1>
      <p className="mt-3 text-sm leading-relaxed text-zinc-600">
        Use this form if you&apos;re <span className="font-medium text-zinc-800">not signed in</span> or have a general
        program question before applying. We typically reply by email.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-zinc-200/90 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold text-zinc-900">Visitors & applicants</p>
          <p className="mt-1 text-xs leading-relaxed text-zinc-600">
            Questions about commissions, approval, or whether you&apos;re a fit — use the form below.
          </p>
        </div>
        <div className="rounded-xl border border-violet-200/80 bg-violet-50/80 p-4 shadow-sm">
          <p className="text-xs font-semibold text-violet-900">Approved affiliates</p>
          <p className="mt-1 text-xs leading-relaxed text-violet-900/90">
            Sign in for your dashboard. In-app support tickets for payout and account issues are coming soon — this
            public form is not linked to your affiliate account.
          </p>
          <Link href="/affiliate/login" className="mt-2 inline-block text-xs font-semibold text-violet-700 hover:underline">
            Affiliate sign in →
          </Link>
        </div>
      </div>

      <div className="mt-8">
        <AffiliatePublicContactForm />
      </div>
    </div>
  );
}
