import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requireDashboardStaff } from "@/lib/staffGate";
import { grantTrustedProDiscordRoleAndBadgeRow } from "@/lib/trustedProApprovalSideEffects";

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

    const { data: row, error: loadErr } = await db
      .from("trusted_pro_applications")
      .select("id, applicant_discord_id, status")
      .eq("id", appId)
      .maybeSingle();
    if (loadErr) {
      console.error("[mod/tp-apps/approve] load:", loadErr);
      return Response.json({ success: false, error: "Failed to load application" }, { status: 500 });
    }
    if (!row || row.status !== "pending") {
      return Response.json({ success: false, error: "Not found or not pending" }, { status: 404 });
    }

    const applicant = String((row as any).applicant_discord_id || "").trim();
    if (!applicant) {
      return Response.json({ success: false, error: "Invalid applicant" }, { status: 400 });
    }

    const [appRes, userRes] = await Promise.all([
      db
        .from("trusted_pro_applications")
        .update({
          status: "approved",
          staff_notes: staffNotes,
          reviewed_at: nowIso,
          reviewed_by_discord_id: staff.discordId,
          updated_at: nowIso,
        })
        .eq("id", appId),
      db
        .from("users")
        .update({
          trusted_pro: true,
          trusted_pro_granted_at: nowIso,
        })
        .eq("discord_id", applicant),
    ]);

    if (appRes.error) {
      console.error("[mod/tp-apps/approve] update app:", appRes.error);
      return Response.json({ success: false, error: "Failed to approve" }, { status: 500 });
    }
    if (userRes.error) {
      console.error("[mod/tp-apps/approve] update user:", userRes.error);
      return Response.json({ success: false, error: "Failed to grant Trusted Pro" }, { status: 500 });
    }

    await grantTrustedProDiscordRoleAndBadgeRow(db, applicant);

    return Response.json({ success: true });
  } catch (e) {
    console.error("[mod/tp-apps/approve] POST:", e);
    return Response.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}

