import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { getAffiliateOpsSessionFromCookies } from "@/lib/affiliate/affiliateOpsSession";
import { isDashboardAdminUser } from "@/lib/adminGate";

function safeReturnTo(raw: string | undefined): string {
  const path = typeof raw === "string" ? raw.trim() : "";
  if (!path.startsWith("/affiliate/admin") || path.includes("//")) return "/affiliate/admin";
  return path;
}

export default async function AffiliateAdminEnterPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string }>;
}) {
  const sp = await searchParams;
  const returnTo = safeReturnTo(sp.returnTo);

  const session = await getServerSession(authOptions);
  const discordId = session?.user?.id?.trim() ?? "";
  if (!discordId) {
    const callback = `/affiliate/admin/enter?returnTo=${encodeURIComponent(returnTo)}`;
    redirect(`/api/auth/signin?callbackUrl=${encodeURIComponent(callback)}`);
  }
  if (!(await isDashboardAdminUser(session, discordId))) {
    redirect("/affiliate/admin/denied");
  }

  const ops = await getAffiliateOpsSessionFromCookies();
  if (ops?.discordId === discordId) {
    redirect(returnTo);
  }

  const q = new URLSearchParams({ returnTo });
  redirect(`/affiliate/admin/auth/totp?${q.toString()}`);
}
