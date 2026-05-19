import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { AffiliateAdminShell } from "@/app/affiliate/admin/_components/AffiliateAdminShell";
import { getAffiliateOpsSessionFromCookies } from "@/lib/affiliate/affiliateOpsSession";
import { authOptions } from "@/lib/auth";
import { isDashboardAdminUser } from "@/lib/adminGate";

export default async function AffiliateAdminPanelLayout({ children }: { children: ReactNode }) {
  const session = await getServerSession(authOptions);
  const id = session?.user?.id?.trim();
  if (!id || !(await isDashboardAdminUser(session, id))) {
    redirect("/affiliate/admin/denied");
  }
  const ops = await getAffiliateOpsSessionFromCookies();
  if (!ops || ops.discordId !== id) {
    redirect(`/affiliate/admin/enter?returnTo=${encodeURIComponent("/affiliate/admin")}`);
  }

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6">
      <AffiliateAdminShell>{children}</AffiliateAdminShell>
    </div>
  );
}
