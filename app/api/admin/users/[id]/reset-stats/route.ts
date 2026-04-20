import { requireDashboardAdmin } from "@/lib/adminGate";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { invalidateStatsCutoverCache } from "@/lib/statsCutover";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const gate = await requireDashboardAdmin();
  if (!gate.ok) return gate.response;

  const { id: rawId } = await context.params;
  const discordId = decodeURIComponent(String(rawId ?? "")).trim();
  if (!discordId || discordId.length > 64) {
    return Response.json({ success: false, error: "Invalid user id" }, { status: 400 });
  }

  const db = getSupabaseAdmin();
  if (!db) {
    return Response.json({ success: false, error: "Supabase not configured" }, { status: 500 });
  }

  const nowIso = new Date().toISOString();
  const { error, data } = await db
    .from("call_performance")
    .update({
      excluded_from_stats: true,
      excluded_reason: "admin_reset",
      excluded_at: nowIso,
      excluded_by_discord_id: gate.discordId,
    })
    .eq("discord_id", discordId)
    .eq("excluded_from_stats", false)
    .select("id");

  if (error) {
    console.error("[admin/users/reset-stats] update:", error);
    return Response.json({ success: false, error: "Failed to reset user stats" }, { status: 500 });
  }

  invalidateStatsCutoverCache();
  return Response.json({ success: true, excluded: Array.isArray(data) ? data.length : null });
}

