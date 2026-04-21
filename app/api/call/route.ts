import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { botApiBaseUrl, botInternalSecret } from "@/lib/botInternal";
import { botUnreachableChecklist, describeBotApiFetchError } from "@/lib/botUpstreamFetchError";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id?.trim() ?? "";
    if (!userId) {
      return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json().catch(() => null)) as unknown;
    const o = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
    const ca = typeof o.ca === "string" ? o.ca.trim() : "";
    if (!ca) {
      return Response.json({ ok: false, error: "Missing contract address" }, { status: 400 });
    }

    const botUrl = botApiBaseUrl();
    const secret = botInternalSecret();
    if (!botUrl || !secret) {
      return Response.json(
        {
          ok: false,
          error: !botUrl
            ? "BOT_API_URL is not configured on the dashboard host."
            : "CALL_INTERNAL_SECRET is not set on the dashboard host.",
          steps: !botUrl
            ? [
                "Set BOT_API_URL to the bot HTTP origin (no path), e.g. http://YOUR_VPS_IP:3001.",
                "For local dev with ssh -L 3001:127.0.0.1:3001, add BOT_API_URL_LOCAL=http://127.0.0.1:3001 to .env.local.",
              ]
            : [
                "Add CALL_INTERNAL_SECRET to the dashboard env — same value the bot uses for POST /internal/call.",
              ],
        },
        { status: 503 }
      );
    }

    const parsedOrigin = new URL(botUrl);
    const pathname = parsedOrigin.pathname.replace(/\/+$/, "") || "";
    if (pathname && pathname !== "/") {
      return Response.json(
        {
          ok: false,
          error: `BOT_API_URL must be an origin only (no path). Current pathname is "${parsedOrigin.pathname}".`,
        },
        { status: 400 }
      );
    }

    const base = botUrl.replace(/\/+$/, "");
    const target = `${base}/internal/call`;

    let res: globalThis.Response;
    try {
      res = await fetch(target, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${secret}`,
        },
        body: JSON.stringify({ userId, ca }),
      });
    } catch (err) {
      const detail = describeBotApiFetchError(err);
      console.error("[api/call] fetch failed:", detail);
      return Response.json(
        {
          ok: false,
          error: "Could not connect to the bot API.",
          code: "BOT_UNREACHABLE",
          botApiBase: base,
          detail,
          steps: botUnreachableChecklist(base),
        },
        { status: 502 }
      );
    }

    const raw = await res.text();
    let data: Record<string, unknown> | null = null;
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as unknown;
        data = parsed && typeof parsed === "object" && !Array.isArray(parsed)
          ? (parsed as Record<string, unknown>)
          : null;
      } catch {
        data = null;
      }
    }

    if (!res.ok) {
      const msg =
        data && typeof data.error === "string" && data.error.trim()
          ? data.error.trim()
          : `Bot returned HTTP ${res.status}`;
      const status = res.status >= 400 && res.status < 600 ? res.status : 400;
      return Response.json({ ok: false, error: msg, ...data }, { status });
    }

    return Response.json({ ok: true, ...(data ?? {}) });
  } catch (e) {
    console.error("[api/call]", e);
    return Response.json({ ok: false, error: "Internal Server Error" }, { status: 500 });
  }
}
