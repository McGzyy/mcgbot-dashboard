import { requireDashboardAdmin } from "@/lib/adminGate";
import { botApiBaseUrl } from "@/lib/botInternal";
import { botUnreachableChecklist, describeBotApiFetchError } from "@/lib/botUpstreamFetchError";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export type OutsideXPollStatusPayload = {
  status: "disabled" | "running" | "idle" | "unknown";
  disabledByEnv: boolean;
  readyToRun: boolean;
  running: boolean;
  pollIntervalMs: number;
  blockers: string[];
  hint: string;
};

function parsePollBody(body: unknown): OutsideXPollStatusPayload | null {
  if (!body || typeof body !== "object") return null;
  const raw = (body as { outsideXCallsPoll?: unknown }).outsideXCallsPoll;
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const statusRaw = String(o.status ?? "").toLowerCase();
  const status: OutsideXPollStatusPayload["status"] =
    statusRaw === "disabled" || statusRaw === "running" || statusRaw === "idle"
      ? statusRaw
      : "unknown";
  const blockers = Array.isArray(o.blockers)
    ? o.blockers.map((x) => String(x).trim()).filter(Boolean)
    : [];
  return {
    status,
    disabledByEnv: Boolean(o.disabledByEnv),
    readyToRun: Boolean(o.readyToRun),
    running: Boolean(o.running),
    pollIntervalMs:
      typeof o.pollIntervalMs === "number" && Number.isFinite(o.pollIntervalMs)
        ? Math.floor(o.pollIntervalMs)
        : 45_000,
    blockers,
    hint: typeof o.hint === "string" ? o.hint : "",
  };
}

export async function GET() {
  const gate = await requireDashboardAdmin();
  if (!gate.ok) return gate.response;

  const base = botApiBaseUrl();
  if (!base) {
    return Response.json(
      {
        success: false,
        error: "BOT_API_URL is not configured on the dashboard host.",
        poll: null,
        botReachable: false,
      },
      { status: 503 }
    );
  }

  const origin = base.replace(/\/+$/, "");
  const url = `${origin}/health`;

  let res: globalThis.Response;
  try {
    res = await fetch(url, { method: "GET", cache: "no-store" });
  } catch (err) {
    const detail = describeBotApiFetchError(err);
    return Response.json(
      {
        success: false,
        botReachable: false,
        poll: null,
        error: "Could not connect to the bot API.",
        detail,
        steps: botUnreachableChecklist(origin),
      },
      { status: 502 }
    );
  }

  const raw = await res.text();
  let body: unknown = null;
  if (raw) {
    try {
      body = JSON.parse(raw) as unknown;
    } catch {
      body = null;
    }
  }

  const poll = parsePollBody(body);
  if (!res.ok) {
    return Response.json(
      {
        success: false,
        botReachable: false,
        httpStatus: res.status,
        poll: null,
        error: `Bot health returned HTTP ${res.status}.`,
      },
      { status: 502 }
    );
  }

  if (!poll) {
    return Response.json({
      success: true,
      botReachable: true,
      stale: true,
      poll: null,
      error:
        "Bot is up but does not report outsideXCallsPoll yet — deploy latest apiServer.js + outsideXCallerPoller.js on the bot host and restart.",
    });
  }

  return Response.json({
    success: true,
    botReachable: true,
    stale: false,
    poll,
  });
}
