import Link from "next/link";
import { AdminPanel } from "@/app/admin/_components/adminUi";
import { AdminPageHeader } from "@/app/admin/_components/AdminPageHeader";

export default function AdminAffiliatesHubPage() {
  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Affiliate partners"
        description="Partner operations run in a separate console (not on the member dashboard). Use it to approve applications and provision accounts."
      />
      <AdminPanel className="p-5 sm:p-6">
        <p className="text-sm text-zinc-400">
          The affiliate program uses its own login and mandatory 2FA. Members do not see partner links in the terminal
          UI.
        </p>
        <Link
          href="/affiliate/admin"
          className="mt-4 inline-flex h-10 items-center justify-center rounded-lg border border-violet-500/35 bg-violet-500/15 px-5 text-sm font-semibold text-violet-50 hover:bg-violet-500/25"
        >
          Open affiliate admin console →
        </Link>
        <p className="mt-4 text-xs text-zinc-600">
          Self-serve applications: share <span className="font-mono text-zinc-400">/affiliate/register</span> directly
          (not linked from the member site).
        </p>
      </AdminPanel>
    </div>
  );
}
