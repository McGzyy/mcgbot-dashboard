import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { botApiBaseUrl } from "@/lib/botInternal";
import { botUnreachableChecklist, describeBotApiFetchError } from "@/lib/botUpstreamFetchError";
import { meetsModerationMinTier, resolveHelpTierAsync } from "@/lib/helpRole";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
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

    const botUrl = botApiBaseUrl();
    if (!botUrl) {
      return Response.json(
        {
          success: false,
          code: "BOT_NOT_CONFIGURED",
          error: "Bot API URL is not configured.",
          steps: [
            "Set BOT_API_URL on the dashboard host to the bot origin (no path), e.g. http://YOUR_VPS_IP:3001.",
          ],
        },
        { status: 503 }
      );
    }

    const callSecret = process.env.CALL_INTERNAL_SECRET?.trim() ?? "";
    if (!callSecret) {
      return Response.json(
        {
          success: false,
          code: "BOT_NOT_CONFIGURED",
          error: "CALL_INTERNAL_SECRET is not set on the dashboard host.",
        },
        { status: 503 }
      );
    }

    const base = botUrl.replace(/\/+$/, "");
    const target = `${base}/internal/mod-stats?${new URLSearchParams({ userId })}`;

    let res: globalThis.Response;
    try {
      res = await fetch(target, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${callSecret}`,
          "X-Discord-User-Id": userId,
        },
        cache: "no-store",
      });
    } catch (err) {
      const detail = describeBotApiFetchError(err);
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

    return Response.json(
      {
        success: false,
        error: `Bot API returned HTTP ${res.status} with a non-JSON body.`,
        botApiBase: base,
      },
      { status: 502 }
    );
  } catch (err) {
    console.error("[api/mod/stats]", err);
    const detail = err instanceof Error ? err.message : String(err);
    return Response.json({ success: false, error: `Mod stats request failed: ${detail}` }, { status: 500 });
  }
}
