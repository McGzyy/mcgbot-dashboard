import { permanentRedirect } from "next/navigation";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/** @deprecated Use `/membership` — kept for bookmarks and old Stripe return URLs. */
export default async function SubscribeRedirectPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (typeof v === "string" && v) u.set(k, v);
    else if (Array.isArray(v) && typeof v[0] === "string" && v[0]) u.set(k, v[0]);
  }
  const qs = u.toString();
  permanentRedirect(qs ? `/membership?${qs}` : "/membership");
}
