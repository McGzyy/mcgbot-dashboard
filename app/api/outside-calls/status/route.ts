import { isOutsideCallsEnabled } from "@/lib/outsideCallsSettings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Public read: whether the Outside Calls Pro lane is live (no auth required). */
export async function GET() {
  const enabled = await isOutsideCallsEnabled();
  return Response.json({
    success: true,
    enabled,
  });
}
