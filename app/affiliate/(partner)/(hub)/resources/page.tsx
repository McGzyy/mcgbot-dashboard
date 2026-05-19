import Image from "next/image";
import Link from "next/link";

const RULES = [
  "Disclose affiliate relationship where required by law or platform policy.",
  "No guaranteed-profit claims, fake screenshots, or impersonation of McGBot staff.",
  "Do not bid on McGBot brand keywords in paid ads without written approval.",
  "Use only approved brand assets from this page — do not alter the logo colors.",
];

export default function AffiliateResourcesPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-8 sm:py-10">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-violet-700/90">Resources</p>
        <h1 className="mt-1 text-2xl font-semibold text-zinc-900">Brand & playbook</h1>
        <p className="mt-2 text-sm text-zinc-600">
          Approved assets and promotion rules for McGBot affiliates. Create tracked sub-links under Campaigns.
        </p>
      </div>

      <section className="rounded-2xl border border-zinc-200/90 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-zinc-900">Logo</h2>
        <p className="mt-1 text-xs text-zinc-600">Use on light backgrounds only; keep clear space around the mark.</p>
        <div className="mt-4 flex items-center justify-center rounded-xl border border-zinc-100 bg-zinc-50 p-6">
          <Image src="/brand/mcgbot-logo.png" alt="McGBot" width={200} height={48} className="h-12 w-auto" />
        </div>
        <a
          href="/brand/mcgbot-logo.png"
          download
          className="mt-4 inline-flex h-9 items-center rounded-lg border border-violet-300 bg-violet-50 px-3 text-xs font-semibold text-violet-900 hover:bg-violet-100"
        >
          Download PNG
        </a>
      </section>

      <section className="rounded-2xl border border-zinc-200/90 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-zinc-900">Promotion rules</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-zinc-700">
          {RULES.map((rule) => (
            <li key={rule}>{rule}</li>
          ))}
        </ul>
      </section>

      <section className="rounded-2xl border border-zinc-200/90 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-zinc-900">Rev share reminder</h2>
        <p className="mt-2 text-sm text-zinc-600">
          Month 1: 15% · Month 2: 25% · Months 3–12: 15% each (per referred member). Annual plans pay once per year at
          that year&apos;s index, with a one-time signup bonus on the first annual invoice ($5 Basic / $10 Pro).
        </p>
      </section>

      <p className="text-xs text-zinc-500">
        <Link href="/affiliate/dashboard" className="font-semibold text-violet-700 hover:underline">
          Back to dashboard
        </Link>
      </p>
    </div>
  );
}
