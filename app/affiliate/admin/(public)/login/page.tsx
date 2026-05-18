import { redirect } from "next/navigation";

/** Legacy URL — ops entry is McGBot admin session + authenticator only. */
export default async function AffiliateAdminLoginRedirectPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string }>;
}) {
  const sp = await searchParams;
  const raw = typeof sp.returnTo === "string" ? sp.returnTo.trim() : "";
  const returnTo =
    raw.startsWith("/affiliate/admin") && !raw.includes("//") ? raw : "/affiliate/admin";
  const q = new URLSearchParams({ returnTo });
  redirect(`/affiliate/admin/enter?${q.toString()}`);
}
