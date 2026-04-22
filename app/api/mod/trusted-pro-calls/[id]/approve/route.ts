import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requireDashboardStaff } from "@/lib/staffGate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function staffNotesFromBody(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const v = (body as any).staffNotes;
  if (typeof v !== "string") return null;
  const t = v.trim();
  if (!t) return null;
  return t.length > 4000 ? t.slice(0, 4000) : t;
}

export async function POST(request: Request, ctx: { params: { id: string } }) {
  const staff = await requireDashboardStaff();
  if (!staff.ok) return staff.response;

  try {
    const callId = String(ctx.params.id || "").trim();
    if (!callId) {
      return Response.json({ success: false, error: "Missing id" }, { status: 400 });
    }

    const db = getSupabaseAdmin();
    if (!db) {
      return Response.json({ success: false, error: "Supabase not configured" }, { status: 500 });
    }

    const body = await request.json().catch(() => null);
    const staffNotes = staffNotesFromBody(body);
    const nowIso = new Date().toISOString();

    const { data, error } = await db
      .from("trusted_pro_calls")
      .update({
        status: "approved",
        published_at: nowIso,
        reviewed_at: nowIso,
        reviewed_by_discord_id: staff.discordId,
        staff_notes: staffNotes,
        updated_at: nowIso,
      })
      .eq("id", callId)
      .eq("status", "pending")
      .select("id, status, published_at")
      .maybeSingle();

    if (error) {
      console.error("[mod/trusted-pro-calls/approve] supabase:", error);
      return Response.json({ success: false, error: "Failed to approve" }, { status: 500 });
    }
    if (!data) {
      return Response.json({ success: false, error: "Not found or not pending" }, { status: 404 });
    }

    return Response.json({ success: true, call: data });
  } catch (e) {
    console.error("[mod/trusted-pro-calls/approve] POST:", e);
    return Response.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}

