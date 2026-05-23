import { runDashboardAlertsCron } from "@/lib/dashboardAlertEvaluator";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/** DexScreener fetches + user batch — allow headroom on Fluid. */
export const maxDuration = 60;

function authorizeCron(request: Request): boolean {
  const secret = (process.env.CRON_SECRET ?? "").trim();
  if (!secret) return false;
  const auth = request.headers.get("authorization") ?? "";
  const bearer = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  const header = (request.headers.get("x-cron-secret") ?? "").trim();
  return bearer === secret || header === secret;
}

function cronEnabled(): boolean {
  const raw = String(process.env.DASHBOARD_ALERTS_CRON_ENABLED ?? "1")
    .trim()
    .toLowerCase();
  return raw !== "0" && raw !== "false" && raw !== "no";
}

async function run(request: Request): Promise<Response> {
  if (!authorizeCron(request)) {
    return Response.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  if (!cronEnabled()) {
    return Response.json({
      success: true,
      skipped: true,
      reason: "DASHBOARD_ALERTS_CRON_ENABLED=0",
    });
  }

  const db = getSupabaseAdmin();
  if (!db) {
    return Response.json({ success: false, error: "Database not configured" }, { status: 503 });
  }

  const result = await runDashboardAlertsCron(db);
  return Response.json({ success: true, ...result });
}

export async function POST(request: Request) {
  return run(request);
}

export async function GET(request: Request) {
  return run(request);
}
