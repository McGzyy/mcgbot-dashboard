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

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const staff = await requireDashboardStaff();
  if (!staff.ok) return staff.response;

  try {
    const { id } = await ctx.params;
    const appId = String(id || "").trim();
    if (!appId) {
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
      .from("trusted_pro_applications")
      .update({
        status: "denied",
        staff_notes: staffNotes,
        reviewed_at: nowIso,
        reviewed_by_discord_id: staff.discordId,
        updated_at: nowIso,
      })
      .eq("id", appId)
      .eq("status", "pending")
      .select("id")
      .maybeSingle();

    if (error) {
      console.error("[mod/tp-apps/deny] supabase:", error);
      return Response.json({ success: false, error: "Failed to deny" }, { status: 500 });
    }
    if (!data) {
      return Response.json({ success: false, error: "Not found or not pending" }, { status: 404 });
    }

    return Response.json({ success: true });
  } catch (e) {
    console.error("[mod/tp-apps/deny] POST:", e);
    return Response.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}

