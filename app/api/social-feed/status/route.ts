import { isSocialFeedEnabled } from "@/lib/socialFeedSettings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Public read: whether the home Social Feed widget and X ingest are on (no Bearer calls when off). */
export async function GET() {
  const enabled = await isSocialFeedEnabled();
  return Response.json({
    success: true,
    enabled,
  });
}
