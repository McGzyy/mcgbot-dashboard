import Link from "next/link";
import { AdminPanel } from "@/app/admin/_components/adminUi";
import { AdminPageHeader } from "@/app/admin/_components/AdminPageHeader";

export default function AdminAffiliatesHubPage() {
  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Affiliate partners"
        description="Member referrals stay in Referrals & rewards. Partner cash commissions and applications live in a separate light dashboard (same product family, not the terminal chrome)."
      />
      <AdminPanel className="p-5 sm:p-6">
        <p className="text-sm text-zinc-400">
          Partners use <span className="font-mono text-zinc-300">/affiliate/register</span> and their own password +
          mandatory 2FA. Members do not see partner tools in the terminal.
        </p>
        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <Link
            href="/affiliate/admin/login?returnTo=%2Faffiliate%2Fadmin"
            className="inline-flex h-10 items-center justify-center rounded-lg border border-violet-500/35 bg-violet-500/15 px-5 text-sm font-semibold text-violet-50 hover:bg-violet-500/25"
          >
            Open affiliate ops panel (sign in again) →
          </Link>
          <Link
            href="/affiliate/admin/login?returnTo=%2Faffiliate%2Fadmin%2Fpartners"
            className="inline-flex h-10 items-center justify-center rounded-lg border border-zinc-700/80 bg-zinc-900/50 px-5 text-sm font-semibold text-zinc-200 hover:bg-zinc-800/70"
          >
            Skip to partners list →
          </Link>
        </div>
        <p className="mt-4 text-xs text-zinc-600">
          After Discord confirms you are a dashboard admin, you will land in the light ops shell (overview, partners,
          commissions).
        </p>
      </AdminPanel>
    </div>
  );
}
