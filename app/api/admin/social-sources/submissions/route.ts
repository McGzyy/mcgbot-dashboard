import { requireDashboardAdmin } from "@/lib/adminGate";
import { parseSocialFeedCategorySlug } from "@/lib/socialFeedCategories";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function dbOr503() {
  const db = getSupabaseAdmin();
  if (!db) {
    return Response.json({ success: false, error: "Supabase not configured" }, { status: 503 });
  }
  return db;
}

function asId(raw: unknown): string {
  return typeof raw === "string" ? raw.trim() : String(raw ?? "").trim();
}

export async function GET() {
  const gate = await requireDashboardAdmin();
  if (!gate.ok) return gate.response;

  const db = dbOr503();
  if (db instanceof Response) return db;

  const { data, error } = await db
    .from("social_feed_source_submissions")
    .select("*")
    .order("submitted_at", { ascending: false })
    .limit(250);

  if (error) {
    console.error("[admin social submissions] GET:", error);
    return Response.json({ success: false, error: "Failed to load submissions" }, { status: 500 });
  }

  return Response.json({ success: true, submissions: data ?? [] });
}

export async function PATCH(request: Request) {
  const gate = await requireDashboardAdmin();
  if (!gate.ok) return gate.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ success: false, error: "Invalid JSON" }, { status: 400 });
  }
  const o = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const id = asId(o.id);
  const action = typeof o.action === "string" ? o.action.trim().toLowerCase() : "";
  const note = typeof o.note === "string" ? o.note.trim().slice(0, 500) : null;

  if (!id || (action !== "approve" && action !== "deny")) {
    return Response.json({ success: false, error: "Missing id or invalid action" }, { status: 400 });
  }

  const db = dbOr503();
  if (db instanceof Response) return db;

  const { data: row, error: getErr } = await db
    .from("social_feed_source_submissions")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (getErr) {
    console.error("[admin social submissions] load:", getErr);
    return Response.json({ success: false, error: "Failed to load submission" }, { status: 500 });
  }
  if (!row) {
    return Response.json({ success: false, error: "Submission not found" }, { status: 404 });
  }

  const statusNext = action === "approve" ? "approved" : "denied";

  // Approve: upsert source row first, then mark submission approved.
  if (statusNext === "approved") {
    const platform = String((row as any).platform ?? "").trim();
    const handle = String((row as any).handle ?? "")
      .trim()
      .replace(/^@/, "")
      .replace(/\s+/g, "")
      .toLowerCase();
    const display_name = (row as any).display_name ?? null;

    if (!platform || !handle) {
      return Response.json({ success: false, error: "Invalid submission payload" }, { status: 400 });
    }

    // Avoid `onConflict` expressions (PostgREST only accepts column names).
    const { data: existing, error: exErr } = await db
      .from("social_feed_sources")
      .select("id")
      .eq("platform", platform)
      .ilike("handle", handle)
      .maybeSingle();
    if (exErr) {
      console.error("[admin social submissions] approve existing:", exErr);
      return Response.json({ success: false, error: "Failed to create source" }, { status: 500 });
    }
    if (existing && (existing as any).id) {
      const { error: updErr } = await db
        .from("social_feed_sources")
        .update({
          handle,
          display_name,
          active: true,
        })
        .eq("id", (existing as any).id);
      if (updErr) {
        console.error("[admin social submissions] approve update source:", updErr);
        return Response.json({ success: false, error: "Failed to create source" }, { status: 500 });
      }
    } else {
      const { error: insErr } = await db.from("social_feed_sources").insert({
        platform,
        handle,
        display_name,
        created_by_discord_id: gate.discordId,
        active: true,
        category,
        category_other,
      });
      if (insErr) {
        console.error("[admin social submissions] approve insert source:", insErr);
        return Response.json({ success: false, error: "Failed to create source" }, { status: 500 });
      }
    }
  }

  const { error: patchErr } = await db
    .from("social_feed_source_submissions")
    .update({
      status: statusNext,
      reviewed_at: new Date().toISOString(),
      reviewed_by_discord_id: gate.discordId,
      review_note: note,
    })
    .eq("id", id);

  if (patchErr) {
    console.error("[admin social submissions] PATCH:", patchErr);
    return Response.json({ success: false, error: "Failed to update submission" }, { status: 500 });
  }

  return Response.json({ success: true });
}

