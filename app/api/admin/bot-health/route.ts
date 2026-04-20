import { requireDashboardAdmin } from "@/lib/adminGate";
import { botApiBaseUrl } from "@/lib/botInternal";
import { botUnreachableChecklist, describeBotApiFetchError } from "@/lib/botUpstreamFetchError";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const gate = await requireDashboardAdmin();
  if (!gate.ok) return gate.response;

  const base = botApiBaseUrl();
  if (!base) {
    return Response.json(
      { success: false, error: "BOT_API_URL is not configured on the dashboard host." },
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
        reachable: false,
        httpStatus: null,
        url,
        body: null,
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

  return Response.json({
    success: true,
    reachable: res.ok,
    httpStatus: res.status,
    url,
    body: body && typeof body === "object" ? body : null,
  });
}
