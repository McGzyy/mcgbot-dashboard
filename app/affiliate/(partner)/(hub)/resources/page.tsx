import Link from "next/link";
import { AffiliateBrandKit } from "@/app/affiliate/(partner)/_components/AffiliateBrandKit";
import { AffiliateEarningsGuide } from "@/app/affiliate/(partner)/_components/AffiliateEarningsGuide";

export default function AffiliateResourcesPage() {
  return (
    <div className="space-y-8">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-violet-700/90">Resources</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-900 sm:text-3xl">
          Brand kit & playbook
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-zinc-600">
          Everything you need to promote McGBot professionally — assets, disclosures, product language, and
          commission reference.
        </p>
      </div>

      <AffiliateBrandKit />

      <section id="how-you-earn" className="scroll-mt-8 rounded-2xl border border-violet-200/80 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-zinc-900">Commission reference</h2>
        <p className="mt-1 text-xs text-zinc-600">
          Loyalty rev-share, milestones, and annual bonuses — full schedule for your records.
        </p>
        <div className="mt-4">
          <AffiliateEarningsGuide variant="full" />
        </div>
      </section>

      <p className="text-xs text-zinc-500">
        <Link href="/affiliate/dashboard" className="font-semibold text-violet-700 hover:underline">
          ← Back to dashboard
        </Link>
      </p>
    </div>
  );
}
