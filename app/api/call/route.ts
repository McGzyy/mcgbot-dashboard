import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { botApiBaseUrl } from "@/lib/botInternal";

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id?.trim() ?? "";
    if (!userId) {
      return Response.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const botUrl = botApiBaseUrl();
    if (!botUrl) {
      return Response.json(
        {
          success: false,
          error:
            "Submit Call is not configured (missing BOT_API_URL). Add it to your environment to enable calls.",
        },
        { status: 503 }
      );
    }

    const body = (await request.json().catch(() => null)) as unknown;
    if (!body || typeof body !== "object") {
      return Response.json(
        { success: false, error: "Invalid JSON body" },
        { status: 400 }
      );
    }

    const o = body as Record<string, unknown>;
    const ca = typeof o.ca === "string" ? o.ca.trim() : "";

    if (!ca) {
      return Response.json(
        { success: false, error: "Missing CA" },
        { status: 400 }
      );
    }

    const callSecret = process.env.CALL_INTERNAL_SECRET?.trim() ?? "";
    if (!callSecret) {
      return Response.json(
        {
          success: false,
          error:
            "Submit Call is not configured (missing CALL_INTERNAL_SECRET). Set the same secret on the bot host and in this dashboard.",
        },
        { status: 503 }
      );
    }

    const base = botUrl.replace(/\/+$/, "");
    const url = `${base}/internal/call`;

    let res: globalThis.Response;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${callSecret}`,
        },
        body: JSON.stringify({ ca, userId }),
      });
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      console.error("[api/call] fetch failed:", detail, "target:", base);
      return Response.json(
        {
          success: false,
          error: `Could not reach bot API. ${detail}. Check BOT_API_URL (try opening ${base}/health in a browser), firewall, and that the bot process is running on the VPS.`,
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
        ? ` HTTP 404 usually means BOT_API_URL is your website (e.g. Next.js), not the bot. Open ${base}/health in a browser — you must see {"ok":true}. If not, point BOT_API_URL at the VPS Node API (subdomain or IP:port) or add a reverse-proxy rule for /health and /internal/call to that process.`
        : "";

    return Response.json(
      {
        success: false,
        error: `Bot API returned HTTP ${res.status} with a non-JSON body (wrong URL, reverse proxy, or not this service). Expected JSON from ${base}/internal/call.${notThisService}`,
      },
      { status: 502 }
    );
  } catch (err) {
    console.error("API ERROR:", err);
    const detail = err instanceof Error ? err.message : String(err);
    return Response.json(
      { success: false, error: `Submit Call failed: ${detail}` },
      { status: 500 }
    );
  }
}

