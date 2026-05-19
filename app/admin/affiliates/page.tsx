import Link from "next/link";
import { AdminPanel } from "@/app/admin/_components/adminUi";
import { AdminPageHeader } from "@/app/admin/_components/AdminPageHeader";
import { affiliatePortalPath } from "@/lib/affiliate/affiliatePortalUrl";

export default function AdminAffiliatesHubPage() {
  const opsLogin = affiliatePortalPath("/affiliate/admin/enter?returnTo=%2Faffiliate%2Fadmin");
  const opsAffiliates = affiliatePortalPath("/affiliate/admin/enter?returnTo=%2Faffiliate%2Fadmin%2Fpartners");
  const affiliateRegister = affiliatePortalPath("/affiliate/register");

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Affiliate program"
        description="Affiliate program runs on a separate portal (no terminal sidebar). Same backend data; different URL and login."
      />
      <AdminPanel className="p-5 sm:p-6">
        <p className="text-sm text-zinc-400">
          Affiliates apply at{" "}
          <span className="font-mono text-zinc-300">{affiliateRegister}</span> with email + password and mandatory 2FA.
          They never use the member McGBot dashboard.
        </p>
        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <Link
            href={opsLogin}
            className="inline-flex h-10 items-center justify-center rounded-lg border border-violet-500/35 bg-violet-500/15 px-5 text-sm font-semibold text-violet-50 hover:bg-violet-500/25"
          >
            Open affiliate ops panel →
          </Link>
          <Link
            href={opsAffiliates}
            className="inline-flex h-10 items-center justify-center rounded-lg border border-zinc-700/80 bg-zinc-900/50 px-5 text-sm font-semibold text-zinc-200 hover:bg-zinc-800/70"
          >
            Ops: affiliates list →
          </Link>
        </div>
        <p className="mt-4 text-xs text-zinc-600">
          Ops opens from your existing McGBot admin session plus authenticator 2FA — no Discord sign-in on the affiliate
          portal. Set{" "}
          <span className="font-mono text-zinc-500">NEXT_PUBLIC_AFFILIATE_PORTAL_URL</span> (e.g.{" "}
          <span className="font-mono text-zinc-500">https://partners.mcgbot.xyz</span>) to host the portal on its own
          domain.
        </p>
      </AdminPanel>
    </div>
  );
}
