import { requireDashboardAdmin } from "@/lib/adminGate";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const gate = await requireDashboardAdmin();
  if (!gate.ok) return gate.response;

  const db = getSupabaseAdmin();
  if (!db) return Response.json({ error: "Database not configured" }, { status: 503 });

  const { data, error } = await db
    .from("users")
    .select("discord_id, discord_display_name, created_at, copy_trade_access_requested_at")
    .eq("copy_trade_access_state", "pending")
    .order("copy_trade_access_requested_at", { ascending: false })
    .limit(200);

  if (error) {
    console.error("[admin/copy-trade/access-pending]", error.message);
    return Response.json({ ok: false, error: "Could not load pending requests." }, { status: 500 });
  }

  const rows = Array.isArray(data) ? data : [];
  return Response.json({
    ok: true,
    pending: rows.map((r: Record<string, unknown>) => ({
      discord_id: String(r.discord_id ?? ""),
      discord_display_name: typeof r.discord_display_name === "string" ? r.discord_display_name : null,
      created_at: r.created_at,
      copy_trade_access_requested_at: r.copy_trade_access_requested_at,
    })),
  });
}
