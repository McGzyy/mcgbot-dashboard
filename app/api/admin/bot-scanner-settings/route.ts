import { requireDashboardAdmin } from "@/lib/adminGate";
import { botApiBaseUrl, botInternalSecret } from "@/lib/botInternal";
import { DEFAULT_APPROVAL_MILESTONE_LADDER, DEFAULT_APPROVAL_TRIGGER_X } from "@/lib/scannerDefaults";
import { botUnreachableChecklist, describeBotApiFetchError } from "@/lib/botUpstreamFetchError";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function tryParseJson(raw: string): Record<string, unknown> | null {
  if (!raw || !raw.trim()) return null;
  try {
    const v = JSON.parse(raw) as unknown;
    if (v && typeof v === "object" && !Array.isArray(v)) return v as Record<string, unknown>;
    return null;
  } catch {
    return null;
  }
}

function looksLikeHtml(raw: string): boolean {
  const t = raw.trimStart().slice(0, 64).toLowerCase();
  return t.startsWith("<!") || t.startsWith("<html") || t.startsWith("<head") || t.startsWith("<");
}

function readSettingsFallbackResponse(opts: { httpStatus: number; botDetail?: string }): Response {
  const detail = opts.botDetail ? ` (${opts.botDetail})` : "";
  return Response.json(
    {
      success: true,
      settings: {},
      approvalTriggerX: DEFAULT_APPROVAL_TRIGGER_X,
      approvalMilestoneLadder: DEFAULT_APPROVAL_MILESTONE_LADDER,
      source: "dashboard_fallback",
      warning: `Could not load scanner settings from the bot (HTTP ${opts.httpStatus}${detail}). Showing preset ladder defaults only — values are not read from the host until you deploy apiServer.js with GET /internal/scanner-settings. Saving will still require that route.`,
    },
    { status: 200 }
  );
}

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
    if (method === "GET") {
      return readSettingsFallbackResponse({ httpStatus: 0, botDetail: detail });
    }
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
  const data = tryParseJson(raw);

  if (method === "GET") {
    if (data && (res.status === 401 || res.status === 403)) {
      return Response.json(data, { status: res.status });
    }
    if (data && data.success === true) {
      return Response.json(data, { status: res.status });
    }
    if (!data || looksLikeHtml(raw) || res.status === 404) {
      const botDetail =
        !data && raw
          ? looksLikeHtml(raw)
            ? "HTML response — wrong BOT_API_URL?"
            : "non-JSON body"
          : typeof data?.error === "string"
            ? String(data.error)
            : undefined;
      return readSettingsFallbackResponse({ httpStatus: res.status, botDetail });
    }
    return readSettingsFallbackResponse({
      httpStatus: res.status,
      botDetail: typeof data?.error === "string" ? String(data.error) : "unexpected body",
    });
  }

  if (!data) {
    return Response.json(
      {
        success: false,
        error: looksLikeHtml(raw)
          ? `Bot returned HTML (HTTP ${res.status}) — check BOT_API_URL points at the bot API, not the dashboard.`
          : "Bot returned non-JSON.",
        httpStatus: res.status,
        preview: raw.slice(0, 280),
      },
      { status: 502 }
    );
  }

  return Response.json(data, { status: res.status });
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
