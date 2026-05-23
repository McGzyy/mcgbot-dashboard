import { fireTestDashboardInboxAlert } from "@/lib/dashboardAlertEvaluator";
import { requireDashboardAdmin } from "@/lib/adminGate";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

export async function POST() {
  const gate = await requireDashboardAdmin();
  if (!gate.ok) return gate.response;

  const db = getSupabaseAdmin();
  if (!db) {
    return Response.json({ ok: false, error: "Database not configured" }, { status: 503 });
  }

  const result = await fireTestDashboardInboxAlert(db, gate.discordId);
  if (!result.ok) {
    return Response.json({ ok: false, error: result.error ?? "Failed" }, { status: 500 });
  }

  return Response.json({
    ok: true,
    userId: gate.discordId,
    discordDm: result.discordDm ?? null,
  });
}
