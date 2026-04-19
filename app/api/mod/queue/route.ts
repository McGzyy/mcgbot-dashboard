import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { resolveHelpTier } from "@/lib/helpRole";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id?.trim() ?? "";
    if (!userId) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tier = resolveHelpTier(userId);
    if (tier !== "mod" && tier !== "admin") {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const botUrl = process.env.BOT_API_URL?.trim() ?? "";
    if (!botUrl) {
      return Response.json(
        {
          success: false,
          error:
            "Mod queue is not configured (missing BOT_API_URL). Point it at the bot Node API (same host as Submit Call).",
        },
        { status: 503 }
      );
    }

    const callSecret = process.env.CALL_INTERNAL_SECRET?.trim() ?? "";
    if (!callSecret) {
      return Response.json(
        {
          success: false,
          error:
            "Mod queue is not configured (missing CALL_INTERNAL_SECRET). Set the same secret on the bot host and in this dashboard.",
        },
        { status: 503 }
      );
    }

    const urlObj = new URL(request.url);
    const limitParam = urlObj.searchParams.get("limit") ?? "100";
    const limitNum = Number(limitParam);
    const limit =
      Number.isFinite(limitNum) && limitNum > 0 && limitNum <= 500
        ? String(Math.floor(limitNum))
        : "100";

    const base = botUrl.replace(/\/+$/, "");
    const target = `${base}/internal/mod-queue?${new URLSearchParams({
      userId,
      limit,
    })}`;

    let res: globalThis.Response;
    try {
      res = await fetch(target, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${callSecret}`,
          "X-Discord-User-Id": userId,
        },
      });
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      console.error("[api/mod/queue] fetch failed:", detail, "target:", base);
      return Response.json(
        {
          success: false,
          error: `Could not reach bot API. ${detail}. Check BOT_API_URL (try opening ${base}/health in a browser).`,
        },
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

    const notThisService =
      res.status === 404
        ? ` HTTP 404 usually means BOT_API_URL is wrong. Open ${base}/health — you must see {"ok":true}.`
        : "";

    return Response.json(
      {
        success: false,
        error: `Bot API returned HTTP ${res.status} with a non-JSON body.${notThisService}`,
      },
      { status: 502 }
    );
  } catch (err) {
    console.error("[api/mod/queue]", err);
    const detail = err instanceof Error ? err.message : String(err);
    return Response.json(
      { success: false, error: `Mod queue request failed: ${detail}` },
      { status: 500 }
    );
  }
}
