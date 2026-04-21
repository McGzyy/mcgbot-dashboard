import { requireDashboardAdmin } from "@/lib/adminGate";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

const DEFAULT_LIMIT = 50;

function parseLimit(raw: string | null): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return DEFAULT_LIMIT;
  return Math.min(100, Math.max(1, Math.floor(n)));
}

function cleanStatus(raw: unknown): string | null {
  const s = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  if (!s) return null;
  if (s === "open" || s === "triaged" || s === "closed") return s;
  return null;
}

export async function GET(request: Request) {
  const gate = await requireDashboardAdmin();
  if (!gate.ok) return gate.response;

  const db = getSupabaseAdmin();
  if (!db) return Response.json({ error: "Supabase not configured" }, { status: 500 });

  const { searchParams } = new URL(request.url);
  const status = cleanStatus(searchParams.get("status"));
  const limit = parseLimit(searchParams.get("limit"));

  let q = db.from("bug_reports").select("*").order("created_at", { ascending: false }).limit(limit);
  if (status) q = q.eq("status", status);

  const { data, error } = await q;
  if (error) {
    console.error("[admin/bugs] select:", error);
    return Response.json({ error: "Failed to load bugs" }, { status: 500 });
  }

  return Response.json({ success: true, rows: Array.isArray(data) ? data : [] });
}

export async function PATCH(request: Request) {
  const gate = await requireDashboardAdmin();
  if (!gate.ok) return gate.response;

  const db = getSupabaseAdmin();
  if (!db) return Response.json({ error: "Supabase not configured" }, { status: 500 });

  const body = (await request.json().catch(() => null)) as unknown;
  const o = body && typeof body === "object" ? (body as Record<string, unknown>) : {};

  const id = typeof o.id === "string" ? o.id.trim() : "";
  if (!id) return Response.json({ error: "Missing id" }, { status: 400 });

  const nextStatus = cleanStatus(o.status);
  const staffNotesRaw = typeof o.staff_notes === "string" ? o.staff_notes.trim() : typeof o.staffNotes === "string" ? o.staffNotes.trim() : "";
  const staffNotes = staffNotesRaw ? staffNotesRaw.slice(0, 6000) : null;

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if ("staff_notes" in o || "staffNotes" in o) patch.staff_notes = staffNotes;
  if (nextStatus) patch.status = nextStatus;

  if (nextStatus === "closed") {
    patch.closed_at = new Date().toISOString();
    patch.closed_by_discord_id = gate.discordId;
  }

  const { data: updated, error } = await db
    .from("bug_reports")
    .update(patch)
    .eq("id", id)
    .select("reporter_user_id, title, status")
    .maybeSingle();

  if (error) {
    console.error("[admin/bugs] update:", error);
    return Response.json({ error: "Failed to update bug" }, { status: 500 });
  }

  // On close, send a persistent inbox notification to the reporter.
  if (nextStatus === "closed") {
    const reporter =
      updated && typeof (updated as any).reporter_user_id === "string"
        ? String((updated as any).reporter_user_id).trim()
        : "";
    const title =
      updated && typeof (updated as any).title === "string" ? String((updated as any).title) : "Bug report";
    if (reporter) {
      const notifTitle = "Bug fixed — thank you";
      const bodyText = `Your bug report (“${title.slice(0, 140)}”) has been marked fixed/closed. Thank you for helping improve the terminal.`;
      const { error: insErr } = await db.from("user_inbox_notifications").insert({
        user_id: reporter,
        title: notifTitle,
        body: bodyText,
        kind: "bug_closed",
      });
      if (insErr) {
        console.error("[admin/bugs] notify insert:", insErr);
      }
    }
  }

  return Response.json({ success: true });
}

