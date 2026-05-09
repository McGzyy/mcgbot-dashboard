import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { botApiBaseUrl } from "@/lib/botInternal";
import { botUnreachableChecklist, describeBotApiFetchError } from "@/lib/botUpstreamFetchError";
import { meetsModerationMinTier, moderationStaffForbiddenPayload, resolveHelpTierAsync } from "@/lib/helpRole";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id?.trim() ?? "";
    if (!userId) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tier = await resolveHelpTierAsync(userId);
    if (!meetsModerationMinTier(tier)) {
      return Response.json(moderationStaffForbiddenPayload(), { status: 403 });
    }

    const botUrl = botApiBaseUrl();
    if (!botUrl) {
      return Response.json(
        {
          success: false,
          code: "BOT_NOT_CONFIGURED",
          error: "Bot API URL is not configured.",
          steps: [
            "Set BOT_API_URL on the dashboard host to the bot origin (no path), e.g. http://YOUR_VPS_IP:3001.",
            "For local dev with ssh -L 3001:127.0.0.1:3001, add BOT_API_URL_LOCAL=http://127.0.0.1:3001 to .env.local and restart next dev.",
          ],
        },
        { status: 503 }
      );
    }

    let parsedBotOrigin: URL;
    try {
      parsedBotOrigin = new URL(botUrl);
    } catch {
      return Response.json(
        {
          success: false,
          error: `BOT_API_URL is not a valid URL: ${JSON.stringify(botUrl)}`,
        },
        { status: 400 }
      );
    }

    const pathname = parsedBotOrigin.pathname.replace(/\/+$/, "") || "";
    if (pathname && pathname !== "/") {
      return Response.json(
        {
          success: false,
          error: `BOT_API_URL must be an origin only (no path). Current pathname is "${parsedBotOrigin.pathname}". Example: http://209.38.78.121:3001 — not http://host:3001/internal.`,
        },
        { status: 400 }
      );
    }

    const callSecret = process.env.CALL_INTERNAL_SECRET?.trim() ?? "";
    if (!callSecret) {
      return Response.json(
        {
          success: false,
          code: "BOT_NOT_CONFIGURED",
          error: "CALL_INTERNAL_SECRET is not set on the dashboard host.",
          steps: [
            "Add CALL_INTERNAL_SECRET to Vercel (or .env.local) — same value the bot uses for Authorization: Bearer on internal routes.",
          ],
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
      const detail = describeBotApiFetchError(err);
      console.error("[api/mod/queue] fetch failed:", detail, "target:", base, err);
      return Response.json(
        {
          success: false,
          code: "BOT_UNREACHABLE",
          error: "Could not connect to the bot API.",
          botApiBase: base,
          detail,
          steps: botUnreachableChecklist(base),
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

    const bodyPreview = raw.replace(/\s+/g, " ").slice(0, 220);
    console.error(
      "[api/mod/queue] Bad bot response",
      JSON.stringify({
        status: res.status,
        botApiBase: base,
        targetPath: "/internal/mod-queue",
        contentType: res.headers.get("content-type"),
        bodyPreview,
      })
    );

    const notThisService =
      res.status === 404
        ? ` HTTP 404 on GET /internal/mod-queue: nothing registered that path on ${base}. Open ${base}/health — you must see "endpoints" and "loadedFrom". If /health is still only {"ok":true}, the VPS is not running this repo's apiServer.js (wrong PM2 cwd/script path, old clone, or a different program on that port). On the server: pm2 describe <app> → check "exec cwd" and script; curl -sS "${base}/health" | head -c 400`
        : "";

    return Response.json(
      {
        success: false,
        error: `Bot API returned HTTP ${res.status} with a non-JSON body.${notThisService}`,
        botApiBase: base,
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
