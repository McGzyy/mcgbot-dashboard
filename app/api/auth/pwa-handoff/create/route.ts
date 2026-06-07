import { createPwaAuthHandoff } from "@/lib/pwaAuthHandoff";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as { callbackUrl?: unknown } | null;
    const callbackUrl =
      typeof body?.callbackUrl === "string" ? body.callbackUrl : "/";

    const created = await createPwaAuthHandoff(callbackUrl);
    if (!created) {
      return Response.json({ error: "Handoff unavailable" }, { status: 503 });
    }

    return Response.json({
      success: true,
      handoffId: created.handoffId,
      signInUrl: created.signInUrl,
    });
  } catch (e) {
    console.error("[pwa-handoff] create route:", e);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
