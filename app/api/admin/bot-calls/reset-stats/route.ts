import { requireDashboardAdmin } from "@/lib/adminGate";
import { invalidateStatsCutoverCache } from "@/lib/statsCutover";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

/**
 * Admin-only: mark every bot `call_performance` row as excluded from stats (full table, not paginated).
 * Sync from the bot host will not flip these back while `excluded_reason` stays sticky in `callPerformanceSync`.
 */
export async function POST() {
  const gate = await requireDashboardAdmin();
  if (!gate.ok) return gate.response;

  const db = getSupabaseAdmin();
  if (!db) {
    return Response.json({ success: false, error: "Supabase admin client not configured." }, { status: 500 });
  }

  const { count: botRowCount, error: countErr } = await db
    .from("call_performance")
    .select("id", { count: "exact", head: true })
    .eq("source", "bot");

  if (countErr) {
    console.error("[admin/bot-calls/reset-stats] count:", countErr);
    return Response.json(
      { success: false, error: typeof countErr.message === "string" ? countErr.message : "Count failed." },
      { status: 500 }
    );
  }

  const nowIso = new Date().toISOString();
  const { error } = await db
    .from("call_performance")
    .update({
      excluded_from_stats: true,
      excluded_reason: "admin_bot_calls_reset",
      excluded_at: nowIso,
      excluded_by_discord_id: gate.discordId,
    })
    .eq("source", "bot");

  if (error) {
    console.error("[admin/bot-calls/reset-stats] update:", error);
    return Response.json(
      { success: false, error: typeof error.message === "string" ? error.message : "Update failed." },
      { status: 500 }
    );
  }

  invalidateStatsCutoverCache();

  return Response.json({
    success: true,
    rowsUpdated: typeof botRowCount === "number" ? botRowCount : null,
  });
}
