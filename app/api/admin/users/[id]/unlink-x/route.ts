import { requireDashboardAdmin } from "@/lib/adminGate";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const gate = await requireDashboardAdmin();
  if (!gate.ok) return gate.response;

  const { id: rawId } = await context.params;
  const discordId = decodeURIComponent(String(rawId ?? "")).trim();
  if (!discordId || discordId.length > 64) {
    return Response.json({ success: false, error: "Invalid user id" }, { status: 400 });
  }

  const db = getSupabaseAdmin();
  if (!db) {
    return Response.json({ success: false, error: "Supabase not configured" }, { status: 500 });
  }

  const { error } = await db
    .from("users")
    .update({
      x_handle: null,
      x_verified: false,
    })
    .eq("discord_id", discordId);

  if (error) {
    console.error("[admin/users/unlink-x] update:", error);
    return Response.json({ success: false, error: "Failed to unlink X account" }, { status: 500 });
  }

  return Response.json({ success: true });
}
