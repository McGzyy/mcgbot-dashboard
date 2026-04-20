import { requireDashboardAdmin } from "@/lib/adminGate";
import { botApiBaseUrl, botInternalSecret } from "@/lib/botInternal";
import { botUnreachableChecklist, describeBotApiFetchError } from "@/lib/botUpstreamFetchError";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function forward(method: "GET" | "PATCH", discordId: string, body?: Record<string, unknown>) {
  const base = botApiBaseUrl();
  const secret = botInternalSecret();
  if (!base || !secret) {
    return Response.json(
      { success: false, error: !base ? "BOT_API_URL is not configured." : "CALL_INTERNAL_SECRET is not set." },
      { status: 503 }
    );
  }
  const origin = base.replace(/\/+$/, "");
  const url = `${origin}/internal/scanner-settings`;

  let res: globalThis.Response;
  try {
    res = await fetch(url, {
      method,
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${secret}`,
        "X-Discord-User-Id": discordId,
        ...(method === "PATCH" ? { "Content-Type": "application/json" } : {}),
      },
      ...(method === "PATCH" && body ? { body: JSON.stringify(body) } : {}),
    });
  } catch (err) {
    const detail = describeBotApiFetchError(err);
    return Response.json(
      {
        success: false,
        error: "Could not connect to the bot API.",
        detail,
        steps: botUnreachableChecklist(origin),
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
      return Response.json(
        {
          success: false,
          error: "Bot returned non-JSON (often HTTP 404 HTML — deploy latest apiServer with /internal/scanner-settings).",
          httpStatus: res.status,
          preview: raw.slice(0, 280),
        },
        { status: 502 }
      );
    }
  }

  if (data && typeof data === "object" && !Array.isArray(data)) {
    return Response.json(data, { status: res.status });
  }

  return Response.json({ success: false, error: `Unexpected response (HTTP ${res.status}).` }, { status: 502 });
}

export async function GET() {
  const gate = await requireDashboardAdmin();
  if (!gate.ok) return gate.response;
  return forward("GET", gate.discordId);
}

export async function PATCH(request: Request) {
  const gate = await requireDashboardAdmin();
  if (!gate.ok) return gate.response;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ success: false, error: "Invalid JSON body." }, { status: 400 });
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return Response.json({ success: false, error: "Expected a JSON object of fields to update." }, { status: 400 });
  }
  return forward("PATCH", gate.discordId, body as Record<string, unknown>);
}
