import { requireDashboardAdmin } from "@/lib/adminGate";
import { botApiBaseUrl, botInternalSecret } from "@/lib/botInternal";
import { botUnreachableChecklist, describeBotApiFetchError } from "@/lib/botUpstreamFetchError";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ScannerOk = {
  success: true;
  scannerEnabled: boolean;
  discordReady?: boolean;
  processUptimeSec?: number;
  source?: "internal" | "health" | "health_legacy";
  already?: boolean;
  warning?: string;
};

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

/**
 * Reads /health. Supports current bots (scannerEnabled boolean) and older bots (ok only).
 */
async function readScannerFromHealth(origin: string): Promise<ScannerOk | null> {
  try {
    const h = await fetch(`${origin}/health`, { method: "GET", cache: "no-store" });
    const raw = await h.text();
    if (looksLikeHtml(raw)) {
      return null;
    }
    const j = tryParseJson(raw);
    if (!j) return null;

    if (typeof j.scannerEnabled === "boolean") {
      return {
        success: true,
        scannerEnabled: j.scannerEnabled,
        discordReady: typeof j.discordReady === "boolean" ? j.discordReady : undefined,
        processUptimeSec: typeof j.processUptimeSec === "number" ? j.processUptimeSec : undefined,
        source: "health",
      };
    }

    if (j.ok === true) {
      return {
        success: true,
        scannerEnabled: true,
        discordReady: typeof j.discordReady === "boolean" ? j.discordReady : undefined,
        processUptimeSec: typeof j.processUptimeSec === "number" ? j.processUptimeSec : undefined,
        source: "health_legacy",
        warning:
          "This bot build’s GET /health does not include scannerEnabled yet. Showing scanner as ON by default; deploy the latest apiServer.js for the real flag from disk. Discord-ready may also be missing.",
      };
    }

    return null;
  } catch {
    return null;
  }
}

async function forwardScanner(
  method: "GET" | "POST",
  discordId: string,
  body?: Record<string, unknown>
): Promise<Response> {
  const base = botApiBaseUrl();
  const secret = botInternalSecret();
  if (!base || !secret) {
    return Response.json(
      {
        success: false,
        error: !base ? "BOT_API_URL is not configured." : "CALL_INTERNAL_SECRET is not set.",
      },
      { status: 503 }
    );
  }

  const origin = base.replace(/\/+$/, "");
  const url = `${origin}/internal/scanner-state`;

  let res: globalThis.Response;
  try {
    res = await fetch(url, {
      method,
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${secret}`,
        "X-Discord-User-Id": discordId,
        ...(method === "POST" ? { "Content-Type": "application/json" } : {}),
      },
      ...(method === "POST" && body ? { body: JSON.stringify(body) } : {}),
    });
  } catch (err) {
    const detail = describeBotApiFetchError(err);
    if (method === "GET") {
      const fb = await readScannerFromHealth(origin);
      if (fb) return Response.json(fb, { status: 200 });
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

  if (data && (res.status === 401 || res.status === 403)) {
    return Response.json(data, { status: res.status });
  }

  if (!data) {
    if (method === "GET") {
      const fb = await readScannerFromHealth(origin);
      if (fb) return Response.json(fb, { status: 200 });
    }
    const html = looksLikeHtml(raw);
    return Response.json(
      {
        success: false,
        error: html
          ? `BOT_API_URL returned HTML (HTTP ${res.status}) for /internal/scanner-state — often the wrong host (Next.js or nginx), not the bot on port 3001. /health was also not usable JSON.`
          : method === "GET"
            ? "Bot returned non-JSON for /internal/scanner-state and /health could not be parsed for scanner state. Deploy the latest apiServer.js and confirm BOT_API_URL is the bot origin (e.g. http://VPS_IP:3001)."
            : "Bot returned non-JSON — deploy the latest bot so POST /internal/scanner-state exists, or use !scanner in Discord.",
        httpStatus: res.status,
        preview: raw.slice(0, 280),
      },
      { status: 502 }
    );
  }

  if (method === "GET" && data.success === false) {
    const fb = await readScannerFromHealth(origin);
    if (fb) return Response.json(fb, { status: 200 });
  }

  if (method === "GET" && data.success === true) {
    return Response.json({ ...data, source: "internal" } as Record<string, unknown>, { status: res.status });
  }

  return Response.json(data, { status: res.status });
}

export async function GET() {
  const gate = await requireDashboardAdmin();
  if (!gate.ok) return gate.response;
  return forwardScanner("GET", gate.discordId);
}

export async function POST(request: Request) {
  const gate = await requireDashboardAdmin();
  if (!gate.ok) return gate.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ success: false, error: "Invalid JSON body." }, { status: 400 });
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return Response.json({ success: false, error: "Expected JSON object." }, { status: 400 });
  }

  const enabled = (body as { enabled?: unknown }).enabled;
  if (typeof enabled !== "boolean") {
    return Response.json({ success: false, error: 'Body must include boolean "enabled".' }, { status: 400 });
  }

  return forwardScanner("POST", gate.discordId, { enabled });
}
