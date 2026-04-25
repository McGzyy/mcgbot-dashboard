import { createModServiceSupabase, requireModOrAdmin } from "@/lib/modStaffAuth";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string; action: string }> }
) {
  const gate = await requireModOrAdmin();
  if (!gate.ok) return gate.response;

  const supabase = createModServiceSupabase();
  if (!supabase) {
    return Response.json({ success: false, error: "Supabase not configured" }, { status: 500 });
  }

  const { id: rawId, action: rawAction } = await context.params;
  const id = decodeURIComponent(String(rawId ?? "")).trim();
  const action = decodeURIComponent(String(rawAction ?? "")).trim().toLowerCase();

  if (!UUID_RE.test(id)) {
    return Response.json({ success: false, error: "Invalid application id" }, { status: 400 });
  }
  if (action !== "approve" && action !== "deny") {
    return Response.json({ success: false, error: "Invalid action" }, { status: 400 });
  }

  let staffNotes: string | null = null;
  try {
    const body = await request.json().catch(() => ({}));
    if (body && typeof body === "object") {
      const sn = (body as Record<string, unknown>).staffNotes;
      if (typeof sn === "string") {
        const t = sn.trim();
        staffNotes = t.length > 0 ? t.slice(0, 4000) : null;
      }
    }
  } catch {
    staffNotes = null;
  }

  const now = new Date().toISOString();
  const status = action === "approve" ? "approved" : "denied";

  const { data: appRow, error: readErr } = await supabase
    .from("trusted_pro_applications")
    .select("id, applicant_discord_id, status")
    .eq("id", id)
    .limit(1);

  if (readErr) {
    console.error("[mod/trusted-pro-applications/action] read:", readErr);
    return Response.json({ success: false, error: "Database error" }, { status: 500 });
  }

  const row = appRow?.[0] as Record<string, unknown> | undefined;
  if (!row || String(row.status ?? "") !== "pending") {
    return Response.json({ success: false, error: "Application not found or already reviewed" }, { status: 404 });
  }

  const applicantDiscordId = String(row.applicant_discord_id ?? "").trim();
  if (!applicantDiscordId) {
    return Response.json({ success: false, error: "Invalid application" }, { status: 400 });
  }

  const { error: updErr } = await supabase
    .from("trusted_pro_applications")
    .update({
      status,
      staff_notes: staffNotes,
      reviewed_at: now,
      reviewed_by_discord_id: gate.staffDiscordId,
      updated_at: now,
    })
    .eq("id", id)
    .eq("status", "pending");

  if (updErr) {
    console.error("[mod/trusted-pro-applications/action] update:", updErr);
    return Response.json({ success: false, error: "Failed to update application" }, { status: 500 });
  }

  if (action === "approve") {
    const { error: userErr } = await supabase
      .from("users")
      .update({
        trusted_pro: true,
        trusted_pro_granted_at: now,
      })
      .eq("discord_id", applicantDiscordId);

    if (userErr) {
      console.error("[mod/trusted-pro-applications/action] user trusted_pro:", userErr);
      return Response.json(
        {
          success: false,
          error: "Application marked approved but failed to grant Trusted Pro on the user row.",
        },
        { status: 500 }
      );
    }
  }

  return Response.json({ success: true });
}
