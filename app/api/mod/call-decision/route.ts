import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { meetsModerationMinTier, resolveHelpTierAsync } from "@/lib/helpRole";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id?.trim() ?? "";
    if (!userId) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tier = await resolveHelpTierAsync(userId);
    if (!meetsModerationMinTier(tier)) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = (await request.json().catch(() => null)) as unknown;
    if (!body || typeof body !== "object") {
      return Response.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
    }
    const o = body as Record<string, unknown>;
    const contractAddress = typeof o.contractAddress === "string" ? o.contractAddress.trim() : "";
    const decisionRaw = typeof o.decision === "string" ? o.decision.toLowerCase().trim() : "";
    const decision =
      decisionRaw === "approve" || decisionRaw === "deny" || decisionRaw === "exclude"
        ? decisionRaw
        : "";

    if (!contractAddress || !decision) {
      return Response.json(
        { success: false, error: "Missing or invalid contractAddress / decision" },
        { status: 400 }
      );
    }

    const botUrl = process.env.BOT_API_URL?.trim() ?? "";
    if (!botUrl) {
      return Response.json(
        { success: false, error: "BOT_API_URL is not configured on the dashboard host." },
        { status: 503 }
      );
    }

    const callSecret = process.env.CALL_INTERNAL_SECRET?.trim() ?? "";
    if (!callSecret) {
      return Response.json(
        { success: false, error: "CALL_INTERNAL_SECRET is not configured on the dashboard host." },
        { status: 503 }
      );
    }

    const base = botUrl.replace(/\/+$/, "");
    const target = `${base}/internal/mod/call-decision`;

    let res: globalThis.Response;
    try {
      res = await fetch(target, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${callSecret}`,
          "X-Discord-User-Id": userId,
        },
        body: JSON.stringify({ userId, contractAddress, decision }),
      });
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      console.error("[api/mod/call-decision] fetch failed:", detail);
      return Response.json(
        { success: false, error: `Could not reach bot API: ${detail}` },
        { status: 502 }
      );
    }

    const raw = await res.text();
    let data: unknown = null;
    if (raw) {
      try {
        data = JSON.parse(raw) as unknown;
      } catch {
        data = null;
      }
    }

    if (data && typeof data === "object" && !Array.isArray(data)) {
      return Response.json(data, { status: res.status });
    }

    return Response.json(
      { success: false, error: `Bot API returned HTTP ${res.status} with a non-JSON body.` },
      { status: 502 }
    );
  } catch (err) {
    console.error("[api/mod/call-decision]", err);
    const detail = err instanceof Error ? err.message : String(err);
    return Response.json({ success: false, error: detail }, { status: 500 });
  }
}
