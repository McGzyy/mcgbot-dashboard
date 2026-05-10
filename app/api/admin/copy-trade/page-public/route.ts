import { requireDashboardAdmin } from "@/lib/adminGate";
import { readCopyTradePagePublicEnabled, writeCopyTradePagePublicEnabled } from "@/lib/dashboardKv";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const gate = await requireDashboardAdmin();
  if (!gate.ok) return gate.response;

  const db = getSupabaseAdmin();
  if (!db) {
    return Response.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const enabled = await readCopyTradePagePublicEnabled(db);
  return Response.json({ ok: true as const, enabled });
}

export async function POST(request: Request) {
  const gate = await requireDashboardAdmin();
  if (!gate.ok) return gate.response;

  const db = getSupabaseAdmin();
  if (!db) {
    return Response.json({ error: "Supabase not configured" }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const o = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const enabled = o.enabled === true || o.enabled === "true" || o.enabled === 1 || o.enabled === "1";

  const w = await writeCopyTradePagePublicEnabled(db, enabled);
  if (!w.ok) {
    return Response.json({ error: w.error || "Could not save setting." }, { status: 500 });
  }

  return Response.json({ ok: true as const, enabled });
}
