import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { resolveHelpTierAsync } from "@/lib/helpRole";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

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
  return withoutAt.replace(/\s+/g, "").slice(0, 64);
}

function normalizeDisplayName(raw: unknown): string | null {
  const s = typeof raw === "string" ? raw.trim() : "";
  return s ? s.slice(0, 80) : null;
}

function dbOr503() {
  const db = getSupabaseAdmin();
  if (!db) {
    return Response.json(
      { success: false, error: "Supabase not configured" },
      { status: 503 }
    );
  }
  return db;
}

/** Public (authenticated) read of approved sources for the expanded widget. */
export async function GET() {
  const db = dbOr503();
  if (db instanceof Response) return db;

  const { data, error } = await db
    .from("social_feed_sources")
    .select("id, platform, handle, display_name, active, created_at")
    .eq("active", true)
    .order("created_at", { ascending: false })
    .limit(250);

  if (error) {
    console.error("[social-sources] GET:", error);
    return Response.json(
      { success: false, error: "Failed to load sources" },
      { status: 500 }
    );
  }

  const rows = (data ?? []).map((r) => r as any);
  return Response.json({
    success: true,
    sources: rows.map((r) => ({
      id: String(r.id ?? ""),
      platform: r.platform === "instagram" ? "instagram" : "x",
      handle: String(r.handle ?? ""),
      displayName: typeof r.display_name === "string" ? r.display_name : null,
      createdAt: r.created_at ?? null,
    })),
  });
}

/**
 * Admin: add directly to live sources.
 * Mod: submit a source for approval.
 */
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id?.trim() ?? "";
  if (!userId) {
    return Response.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ success: false, error: "Invalid JSON" }, { status: 400 });
  }

  const o = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const platform = parsePlatform(o.platform);
  const handle = normalizeHandle(o.handle);
  const displayName = normalizeDisplayName(o.displayName ?? o.display_name);

  if (!platform || !handle) {
    return Response.json(
      { success: false, error: "Missing platform or handle" },
      { status: 400 }
    );
  }

  const tier = await resolveHelpTierAsync(userId);
  if (tier !== "admin" && tier !== "mod") {
    return Response.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const db = dbOr503();
  if (db instanceof Response) return db;

  if (tier === "admin") {
    const { error } = await db.from("social_feed_sources").upsert(
      {
        platform,
        handle,
        display_name: displayName,
        created_by_discord_id: userId,
        active: true,
      },
      { onConflict: "platform,lower(handle)" as any }
    );
    if (error) {
      console.error("[social-sources] POST admin:", error);
      return Response.json(
        { success: false, error: "Failed to add source" },
        { status: 500 }
      );
    }
    return Response.json({ success: true, mode: "added" as const });
  }

  const { error } = await db.from("social_feed_source_submissions").insert({
    platform,
    handle,
    display_name: displayName,
    status: "pending",
    submitted_by_discord_id: userId,
  });

  if (error) {
    if ((error as any).code === "23505") {
      return Response.json({ success: true, mode: "submitted" as const, alreadyPending: true });
    }
    console.error("[social-sources] POST mod submit:", error);
    return Response.json(
      { success: false, error: "Failed to submit source" },
      { status: 500 }
    );
  }

  return Response.json({ success: true, mode: "submitted" as const });
}

