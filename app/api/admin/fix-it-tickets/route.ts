import { requireDashboardAdmin } from "@/lib/adminGate";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_LIMIT = 80;

function parseLimit(raw: string | null): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return DEFAULT_LIMIT;
  return Math.min(120, Math.max(1, Math.floor(n)));
}

function cleanStatus(raw: string | null): string | null {
  const s = (raw ?? "").trim().toLowerCase();
  if (!s || s === "all") return null;
  if (s === "open" || s === "triaged" || s === "done" || s === "dismissed") return s;
  return null;
}

export async function GET(request: Request) {
  const gate = await requireDashboardAdmin();
  if (!gate.ok) return gate.response;

  const db = getSupabaseAdmin();
  if (!db) {
    return Response.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const { searchParams } = new URL(request.url);
  const status = cleanStatus(searchParams.get("status"));
  const limit = parseLimit(searchParams.get("limit"));

  let q = db.from("fix_it_tickets").select("*").order("created_at", { ascending: false }).limit(limit);
  if (status) q = q.eq("status", status);

  const { data, error } = await q;
  if (error) {
    console.error("[admin/fix-it-tickets] select:", error);
    if (error.code === "42P01" || /relation .* does not exist/i.test(error.message)) {
      return Response.json(
        {
          error: "Fix-it tickets table is missing. Apply Supabase migrations (fix_it_tickets).",
        },
        { status: 503 }
      );
    }
    return Response.json({ error: "Failed to load tickets." }, { status: 500 });
  }

  return Response.json({ success: true as const, rows: Array.isArray(data) ? data : [] });
}

export async function PATCH(request: Request) {
  const gate = await requireDashboardAdmin();
  if (!gate.ok) return gate.response;

  const db = getSupabaseAdmin();
  if (!db) {
    return Response.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const body = (await request.json().catch(() => null)) as unknown;
  const o = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const id = typeof o.id === "string" ? o.id.trim() : "";
  if (!id) return Response.json({ error: "Missing id" }, { status: 400 });

  const nextStatus = cleanStatus(typeof o.status === "string" ? o.status : null);
  const staffNotesRaw =
    typeof o.staff_notes === "string"
      ? o.staff_notes
      : typeof o.staffNotes === "string"
        ? o.staffNotes
        : "";
  const staffNotes = staffNotesRaw.trim() ? staffNotesRaw.trim().slice(0, 8000) : null;

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (nextStatus) patch.status = nextStatus;
  if ("staff_notes" in o || "staffNotes" in o) patch.staff_notes = staffNotes;

  const meaningful = Boolean(nextStatus) || "staff_notes" in o || "staffNotes" in o;
  if (!meaningful) {
    return Response.json({ error: "Nothing to update" }, { status: 400 });
  }

  const { error } = await db.from("fix_it_tickets").update(patch).eq("id", id);
  if (error) {
    console.error("[admin/fix-it-tickets] patch:", error);
    return Response.json({ error: "Update failed." }, { status: 500 });
  }

  return Response.json({ success: true as const });
}
