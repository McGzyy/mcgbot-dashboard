import { requireDashboardSession } from "@/lib/requireDashboardSession";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const auth = await requireDashboardSession();
  if (!auth.ok) return auth.response;
  const db = getSupabaseAdmin();
  if (!db) return Response.json({ success: false, error: "Database not available." }, { status: 503 });
  const { error } = await db
    .from("users")
    .update({ totp_pending_enc: null })
    .eq("discord_id", auth.discordId);
  if (error) {
    console.error("[totp] enroll-cancel", error);
    return Response.json({ success: false, error: "Could not cancel enrollment." }, { status: 500 });
  }
  return Response.json({ success: true });
}
