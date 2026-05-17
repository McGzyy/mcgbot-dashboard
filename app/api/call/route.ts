import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { requireDeskCallAllowance } from "@/lib/subscription/deskCallLimits";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  const discordId = session?.user?.id?.trim() ?? "";
  if (!discordId) {
    return Response.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const limitGate = await requireDeskCallAllowance(discordId);
  if (!limitGate.ok) return limitGate.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ success: false, error: "Invalid JSON" }, { status: 400 });
  }

  const ca =
    body && typeof body === "object" && typeof (body as { ca?: unknown }).ca === "string"
      ? (body as { ca: string }).ca.trim()
      : "";
  if (!ca) {
    return Response.json({ success: false, error: "Missing ca" }, { status: 400 });
  }

  const botApiUrl = String(process.env.BOT_API_URL || "").trim();
  const internalSecret = String(process.env.CALL_INTERNAL_SECRET || "").trim();
  if (!botApiUrl || !internalSecret) {
    return Response.json(
      {
        success: false,
        error: "Call service is not configured (BOT_API_URL / CALL_INTERNAL_SECRET).",
      },
      { status: 503 }
    );
  }

  try {
    const botRes = await fetch(`${botApiUrl.replace(/\/$/, "")}/internal/call`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${internalSecret}`,
      },
      body: JSON.stringify({ userId: discordId, ca }),
    });
    const botJson = (await botRes.json().catch(() => ({}))) as Record<string, unknown>;
    if (!botRes.ok) {
      const err =
        typeof botJson.error === "string" && botJson.error.trim()
          ? botJson.error.trim()
          : "Call failed";
      return Response.json({ success: false, error: err }, { status: botRes.status });
    }
    return Response.json({
      ...botJson,
      deskCallQuota: limitGate.quota,
    });
  } catch (e) {
    console.error("[api/call]", e);
    return Response.json({ success: false, error: "Could not reach call service." }, { status: 502 });
  }
}
