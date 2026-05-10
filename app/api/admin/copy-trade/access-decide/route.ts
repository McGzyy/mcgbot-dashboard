import { requireDashboardAdmin } from "@/lib/adminGate";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const gate = await requireDashboardAdmin();
  if (!gate.ok) return gate.response;

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const targetId = typeof body?.discordId === "string" ? body.discordId.trim() : "";
  const action = typeof body?.action === "string" ? body.action.trim().toLowerCase() : "";
  if (!targetId) {
    return Response.json({ ok: false, error: "Missing discordId." }, { status: 400 });
  }
  if (action !== "approved" && action !== "denied") {
    return Response.json({ ok: false, error: "action must be approved or denied." }, { status: 400 });
  }

  const db = getSupabaseAdmin();
  if (!db) return Response.json({ error: "Database not configured" }, { status: 503 });

  const now = new Date().toISOString();
  const nextState = action as "approved" | "denied";

  const { data: cur, error: fetchErr } = await db
    .from("users")
    .select("discord_id, copy_trade_access_state")
    .eq("discord_id", targetId)
    .maybeSingle();

  if (fetchErr) {
    console.error("[admin/copy-trade/access-decide] fetch", fetchErr.message);
    return Response.json({ ok: false, error: "Lookup failed." }, { status: 500 });
  }
  if (!cur) {
    return Response.json({ ok: false, error: "User not found." }, { status: 404 });
  }
  const state = typeof (cur as { copy_trade_access_state?: string }).copy_trade_access_state === "string"
    ? (cur as { copy_trade_access_state: string }).copy_trade_access_state
    : "none";
  if (state !== "pending") {
    return Response.json({ ok: false, error: `User is not pending (state=${state}).` }, { status: 409 });
  }

  const { error: updErr } = await db
    .from("users")
    .update({
      copy_trade_access_state: nextState,
      copy_trade_access_decided_at: now,
      copy_trade_access_decided_by: gate.discordId,
    })
    .eq("discord_id", targetId)
    .eq("copy_trade_access_state", "pending");

  if (updErr) {
    console.error("[admin/copy-trade/access-decide] update", updErr.message);
    return Response.json({ ok: false, error: "Update failed." }, { status: 500 });
  }

  return Response.json({ ok: true, discordId: targetId, state: nextState });
}
