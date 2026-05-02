import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requireDashboardStaff } from "@/lib/staffGate";

const DEFAULT_LIMIT = 50;

function parseLimit(raw: string | null): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return DEFAULT_LIMIT;
  return Math.min(100, Math.max(1, Math.floor(n)));
}

function cleanStatus(raw: unknown): string | null {
  const s = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  if (!s) return null;
  if (s === "open" || s === "reviewing" || s === "resolved" || s === "rejected") return s;
  return null;
}

export async function GET(request: Request) {
  const gate = await requireDashboardStaff();
  if (!gate.ok) return gate.response;

  const db = getSupabaseAdmin();
  if (!db) return Response.json({ error: "Supabase not configured" }, { status: 500 });

  const { searchParams } = new URL(request.url);
  const status = cleanStatus(searchParams.get("status"));
  const limit = parseLimit(searchParams.get("limit"));

  // Include call details needed by moderators
  let q = db
    .from("call_reports")
    .select(
      "*, call_performance:call_performance_id(id, call_ca, username, call_time, ath_multiple, source, excluded_from_stats, hidden_from_dashboard)"
    )
    .order("created_at", { ascending: false })
    .limit(limit);
  if (status) q = q.eq("status", status);

  const { data, error } = await q;
  if (error) {
    console.error("[mod/reports/call] select:", error);
    return Response.json({ error: "Failed to load reports" }, { status: 500 });
  }

  return Response.json({ success: true, rows: Array.isArray(data) ? data : [] });
}

export async function PATCH(request: Request) {
  const gate = await requireDashboardStaff();
  if (!gate.ok) return gate.response;

  const db = getSupabaseAdmin();
  if (!db) return Response.json({ error: "Supabase not configured" }, { status: 500 });

  const body = (await request.json().catch(() => null)) as unknown;
  const o = body && typeof body === "object" ? (body as Record<string, unknown>) : {};

  const id = typeof o.id === "string" ? o.id.trim() : "";
  if (!id) return Response.json({ error: "Missing id" }, { status: 400 });

  const status = cleanStatus(o.status);
  const staffNotesRaw = typeof o.staff_notes === "string" ? o.staff_notes.trim() : typeof o.staffNotes === "string" ? o.staffNotes.trim() : "";
  const staffNotes = staffNotesRaw ? staffNotesRaw.slice(0, 4000) : null;

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (status) {
    patch.status = status;
    patch.reviewed_at = new Date().toISOString();
    patch.reviewed_by_discord_id = gate.discordId;
  }
  if ("staff_notes" in o || "staffNotes" in o) {
    patch.staff_notes = staffNotes;
  }

  const { error } = await db.from("call_reports").update(patch).eq("id", id);
  if (error) {
    console.error("[mod/reports/call] update:", error);
    return Response.json({ error: "Failed to update report" }, { status: 500 });
  }
  return Response.json({ success: true });
}

