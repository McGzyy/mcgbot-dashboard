import { requireDashboardAdmin } from "@/lib/adminGate";
import { botApiBaseUrl } from "@/lib/botInternal";
import { describeBotApiFetchError } from "@/lib/botUpstreamFetchError";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Admin-only proxy to the bot `GET /health` (no secret required on bot for this path). */
export async function GET() {
  const gate = await requireDashboardAdmin();
  if (!gate.ok) return gate.response;

  const base = botApiBaseUrl();
  if (!base) {
    return Response.json({
      success: false,
      reachable: false,
      error: "BOT_API_URL is not set on this dashboard.",
    });
  }

  const origin = base.replace(/\/+$/, "");
  const url = `${origin}/health`;

  try {
    const res = await fetch(url, { method: "GET", cache: "no-store" });
    const raw = await res.text();
    let body: unknown = null;
    if (raw) {
      try {
        body = JSON.parse(raw) as unknown;
      } catch {
        body = { rawPreview: raw.slice(0, 200) };
      }
    }
    return Response.json({
      success: true,
      reachable: res.ok,
      httpStatus: res.status,
      url,
      body,
    });
  } catch (err) {
    return Response.json({
      success: false,
      reachable: false,
      url,
      error: describeBotApiFetchError(err),
    });
  }
}
