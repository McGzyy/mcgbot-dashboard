import { getSiteOperationalState } from "@/lib/siteOperationalState";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const flags = await getSiteOperationalState();
  return Response.json(flags, {
    headers: {
      "Cache-Control": "public, s-maxage=10, stale-while-revalidate=30",
    },
  });
}
