import { requireDashboardAdmin } from "@/lib/adminGate";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const gate = await requireDashboardAdmin();
  if (!gate.ok) return gate.response;

  const db = getSupabaseAdmin();
  if (!db) {
    return Response.json({ success: false, error: "Supabase is not configured." }, { status: 503 });
  }

  const url = new URL(req.url);
  const status = (url.searchParams.get("status") || "open").trim().toLowerCase();
  const limit = Math.min(80, Math.max(1, Number(url.searchParams.get("limit")) || 40));

  let q = db.from("fix_it_tickets").select("*").order("created_at", { ascending: false }).limit(limit);
  if (status !== "all" && ["open", "triaged", "done", "dismissed"].includes(status)) {
    q = q.eq("status", status);
  }

  const { data, error } = await q;
  if (error) {
    console.error("[admin/fix-it-tickets] GET:", error);
    return Response.json({ success: false, error: "Could not load tickets." }, { status: 500 });
  }

  return Response.json({ success: true, rows: data ?? [] });
}

export async function PATCH(req: Request) {
  const gate = await requireDashboardAdmin();
  if (!gate.ok) return gate.response;

  const db = getSupabaseAdmin();
  if (!db) {
    return Response.json({ success: false, error: "Supabase is not configured." }, { status: 503 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ success: false, error: "Invalid JSON." }, { status: 400 });
  }

  const id = typeof body.id === "string" ? body.id.trim() : "";
  if (!id) {
    return Response.json({ success: false, error: "Missing id." }, { status: 400 });
  }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof body.status === "string") {
    const s = body.status.trim().toLowerCase();
    if (!["open", "triaged", "done", "dismissed"].includes(s)) {
      return Response.json({ success: false, error: "Invalid status." }, { status: 400 });
    }
    patch.status = s;
  }
  if (typeof body.staff_notes === "string") {
    patch.staff_notes = body.staff_notes.trim().slice(0, 8000) || null;
  }

  if (Object.keys(patch).length <= 1) {
    return Response.json({ success: false, error: "Nothing to update." }, { status: 400 });
  }

  const { error } = await db.from("fix_it_tickets").update(patch).eq("id", id);
  if (error) {
    console.error("[admin/fix-it-tickets] PATCH:", error);
    return Response.json({ success: false, error: "Update failed." }, { status: 500 });
  }

  return Response.json({ success: true });
}
