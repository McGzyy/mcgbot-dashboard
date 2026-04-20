import { requireDashboardAdmin } from "@/lib/adminGate";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { invalidateStatsCutoverCache } from "@/lib/statsCutover";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const gate = await requireDashboardAdmin();
  if (!gate.ok) return gate.response;

  const { id: rawId } = await context.params;
  const callId = decodeURIComponent(String(rawId ?? "")).trim();
  if (!callId || callId.length > 128) {
    return Response.json({ success: false, error: "Invalid call id" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ success: false, error: "Invalid JSON" }, { status: 400 });
  }

  const o = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const excluded = o.excluded === true;
  const reasonRaw = typeof o.reason === "string" ? o.reason.trim() : "";
  const reason = reasonRaw ? reasonRaw.slice(0, 240) : null;

  const db = getSupabaseAdmin();
  if (!db) {
    return Response.json({ success: false, error: "Supabase not configured" }, { status: 500 });
  }

  const nowIso = new Date().toISOString();
  const { error } = await db
    .from("call_performance")
    .update({
      excluded_from_stats: excluded,
      excluded_reason: excluded ? reason ?? "admin_exclusion" : null,
      excluded_at: excluded ? nowIso : null,
      excluded_by_discord_id: excluded ? gate.discordId : null,
    })
    .eq("id", callId);

  if (error) {
    console.error("[admin/calls/exclusion] update:", error);
    return Response.json({ success: false, error: "Failed to update call exclusion" }, { status: 500 });
  }

  invalidateStatsCutoverCache();
  return Response.json({ success: true });
}

