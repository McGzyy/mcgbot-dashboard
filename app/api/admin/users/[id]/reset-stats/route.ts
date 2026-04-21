import { requireDashboardAdmin } from "@/lib/adminGate";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { invalidateStatsCutoverCache } from "@/lib/statsCutover";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RESTORE_REASONS = ["admin_reset", "admin_stats_cutover"] as const;

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const gate = await requireDashboardAdmin();
  if (!gate.ok) return gate.response;

  const { id: rawId } = await context.params;
  const discordId = decodeURIComponent(String(rawId ?? "")).trim();
  if (!discordId || discordId.length > 64) {
    return Response.json({ success: false, error: "Invalid user id" }, { status: 400 });
  }

  let body: Record<string, unknown> = {};
  try {
    const parsed = await req.json();
    if (parsed && typeof parsed === "object") {
      body = parsed as Record<string, unknown>;
    }
  } catch {
    body = {};
  }

  const statsFromUtcRaw =
    typeof body.statsFromUtc === "string" ? body.statsFromUtc.trim() : "";
  const cutoverMs = statsFromUtcRaw ? Date.parse(statsFromUtcRaw) : NaN;

  const db = getSupabaseAdmin();
  if (!db) {
    return Response.json({ success: false, error: "Supabase not configured" }, { status: 500 });
  }

  const nowIso = new Date().toISOString();

  if (statsFromUtcRaw && Number.isFinite(cutoverMs)) {
    const { error: exErr } = await db
      .from("call_performance")
      .update({
        excluded_from_stats: true,
        excluded_reason: "admin_stats_cutover",
        excluded_at: nowIso,
        excluded_by_discord_id: gate.discordId,
      })
      .eq("discord_id", discordId)
      .lt("call_time", cutoverMs);

    if (exErr) {
      console.error("[admin/users/reset-stats] cutover exclude:", exErr);
      return Response.json(
        { success: false, error: "Failed to apply stats cutover" },
        { status: 500 }
      );
    }

    const { error: inErr } = await db
      .from("call_performance")
      .update({
        excluded_from_stats: false,
        excluded_reason: null,
        excluded_at: null,
        excluded_by_discord_id: null,
      })
      .eq("discord_id", discordId)
      .gte("call_time", cutoverMs)
      .in("excluded_reason", [...RESTORE_REASONS]);

    if (inErr) {
      console.error("[admin/users/reset-stats] cutover restore:", inErr);
      return Response.json(
        { success: false, error: "Failed to restore calls after cutover" },
        { status: 500 }
      );
    }

    invalidateStatsCutoverCache();
    return Response.json({ success: true, mode: "cutover", statsFromUtc: statsFromUtcRaw });
  }

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
  return Response.json({
    success: true,
    mode: "full",
    excluded: Array.isArray(data) ? data.length : null,
  });
}
