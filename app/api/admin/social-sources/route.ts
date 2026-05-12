import { requireDashboardAdmin } from "@/lib/adminGate";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SocialPlatform = "x" | "instagram";

function parsePlatform(raw: unknown): SocialPlatform | null {
  const s = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  if (s === "x") return "x";
  if (s === "instagram") return "instagram";
  return null;
}

function normalizeHandle(raw: unknown): string {
  const s = typeof raw === "string" ? raw.trim() : String(raw ?? "").trim();
  const withoutAt = s.startsWith("@") ? s.slice(1) : s;
  return withoutAt.replace(/\s+/g, "").toLowerCase().slice(0, 64);
}

function normalizeDisplayName(raw: unknown): string | null {
  const s = typeof raw === "string" ? raw.trim() : "";
  return s ? s.slice(0, 80) : null;
}

function dbOr503() {
  const db = getSupabaseAdmin();
  if (!db) {
    return Response.json({ success: false, error: "Supabase not configured" }, { status: 503 });
  }
  return db;
}

/** List monitored sources (active and disabled) for admin tooling. */
export async function GET(request: Request) {
  const gate = await requireDashboardAdmin();
  if (!gate.ok) return gate.response;

  const url = new URL(request.url);
  const activeOnly = url.searchParams.get("active") === "1";

  const db = dbOr503();
  if (db instanceof Response) return db;

  let q = db
    .from("social_feed_sources")
    .select("id, platform, handle, display_name, active, created_at, created_by_discord_id, last_seen_post_at")
    .order("active", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(500);

  if (activeOnly) {
    q = q.eq("active", true);
  }

  const { data, error } = await q;

  if (error) {
    console.error("[admin social-sources] GET:", error);
    return Response.json({ success: false, error: "Failed to load sources" }, { status: 500 });
  }

  const rows = (data ?? []).map((r) => r as Record<string, unknown>);
  return Response.json({
    success: true,
    sources: rows.map((r) => ({
      id: String(r.id ?? ""),
      platform: r.platform === "instagram" ? "instagram" : "x",
      handle: String(r.handle ?? ""),
      displayName: typeof r.display_name === "string" ? r.display_name : null,
      active: r.active === true,
      createdAt: r.created_at ?? null,
      createdByDiscordId:
        typeof r.created_by_discord_id === "string" ? r.created_by_discord_id : null,
      lastSeenPostAt: r.last_seen_post_at ?? null,
    })),
  });
}

/** Update a source (display name, platform/handle, or enable/disable). */
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
  const id = typeof o.id === "string" ? o.id.trim() : "";
  if (!id) {
    return Response.json({ success: false, error: "Missing id" }, { status: 400 });
  }

  const db = dbOr503();
  if (db instanceof Response) return db;

  const { data: row, error: loadErr } = await db
    .from("social_feed_sources")
    .select("id, platform, handle, display_name, active")
    .eq("id", id)
    .maybeSingle();

  if (loadErr) {
    console.error("[admin social-sources] PATCH load:", loadErr);
    return Response.json({ success: false, error: "Failed to load source" }, { status: 500 });
  }
  if (!row) {
    return Response.json({ success: false, error: "Source not found" }, { status: 404 });
  }

  const cur = row as Record<string, unknown>;
  const updates: Record<string, unknown> = {};

  if ("displayName" in o || "display_name" in o) {
    updates.display_name = normalizeDisplayName(o.displayName ?? o.display_name);
  }

  if ("active" in o) {
    if (typeof o.active !== "boolean") {
      return Response.json({ success: false, error: "active must be a boolean" }, { status: 400 });
    }
    updates.active = o.active;
  }

  const wantPlatform = "platform" in o;
  const wantHandle = "handle" in o;
  if (wantPlatform || wantHandle) {
    const platformNext = wantPlatform ? parsePlatform(o.platform) : parsePlatform(cur.platform);
    const handleRaw = wantHandle ? o.handle : cur.handle;
    const handleNext = normalizeHandle(handleRaw);
    if (!platformNext || !handleNext) {
      return Response.json(
        { success: false, error: "Invalid platform or handle when updating identity" },
        { status: 400 }
      );
    }
    const { data: conflict, error: cErr } = await db
      .from("social_feed_sources")
      .select("id")
      .eq("platform", platformNext)
      .ilike("handle", handleNext)
      .neq("id", id)
      .maybeSingle();
    if (cErr) {
      console.error("[admin social-sources] PATCH conflict:", cErr);
      return Response.json({ success: false, error: "Failed to validate handle" }, { status: 500 });
    }
    if (conflict && (conflict as { id?: string }).id) {
      return Response.json(
        { success: false, error: "Another source already uses this platform and handle" },
        { status: 409 }
      );
    }
    updates.platform = platformNext;
    updates.handle = handleNext;
  }

  if (Object.keys(updates).length === 0) {
    return Response.json({ success: false, error: "No fields to update" }, { status: 400 });
  }

  const { error: updErr } = await db.from("social_feed_sources").update(updates).eq("id", id);
  if (updErr) {
    if ((updErr as { code?: string }).code === "23505") {
      return Response.json(
        { success: false, error: "Duplicate platform and handle" },
        { status: 409 }
      );
    }
    console.error("[admin social-sources] PATCH:", updErr);
    return Response.json({ success: false, error: "Failed to update source" }, { status: 500 });
  }

  return Response.json({ success: true });
}
