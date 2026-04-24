import { requireDashboardAdmin } from "@/lib/adminGate";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_ROWS = 200;

export async function GET() {
  const gate = await requireDashboardAdmin();
  if (!gate.ok) return gate.response;

  const sb = getSupabaseAdmin();
  if (!sb) {
    return Response.json({ ok: false, error: "Supabase is not configured on this host." }, { status: 503 });
  }

  const { data, error } = await sb
    .from("voice_moderation_audit")
    .select("id, created_at, actor_discord_id, target_identity, lobby_id, room_name, action")
    .order("created_at", { ascending: false })
    .limit(MAX_ROWS);

  if (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }

  return Response.json({ ok: true, rows: data ?? [] });
}
