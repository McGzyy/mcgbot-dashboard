import { getPwaHandoffStatus } from "@/lib/pwaAuthHandoff";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const handoffId = url.searchParams.get("handoffId")?.trim() ?? "";
    if (!handoffId) {
      return Response.json({ error: "Missing handoffId" }, { status: 400 });
    }

    const status = await getPwaHandoffStatus(handoffId);
    if (!status) {
      return Response.json({ error: "Handoff not found" }, { status: 404 });
    }

    return Response.json({
      success: true,
      status: status.status,
      callbackUrl: status.callbackUrl,
      redeemToken: status.redeemToken,
    });
  } catch (e) {
    console.error("[pwa-handoff] status route:", e);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
