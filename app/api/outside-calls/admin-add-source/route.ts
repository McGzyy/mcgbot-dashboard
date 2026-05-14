import { requireDashboardAdmin } from "@/lib/adminGate";
import { OUTSIDE_X_MAX_ACTIVE_SOURCES } from "@/lib/outsideXCalls/constants";
import { countActiveOutsideXSources } from "@/lib/outsideXCalls/activeSourcesCount";
import { isValidXHandleNormalized, normalizeXHandle } from "@/lib/outsideXCalls/normalizeXHandle";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function clip(s: string, max: number): string {
  const t = s.trim();
  if (t.length <= max) return t;
  return t.slice(0, max);
}

/**
 * Dashboard admins only: add an X monitor directly (no two-step submission queue).
 */
export async function POST(request: Request) {
  const gate = await requireDashboardAdmin();
  if (!gate.ok) return gate.response;

  const db = getSupabaseAdmin();
  if (!db) {
    return Response.json({ error: "Database not configured" }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const o = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const rawHandle = typeof o.xHandle === "string" ? o.xHandle : typeof o.handle === "string" ? o.handle : "";
  const displayNameIn = typeof o.displayName === "string" ? o.displayName : "";

  const handle = normalizeXHandle(rawHandle);
  if (!isValidXHandleNormalized(handle)) {
    return Response.json(
      { error: "Invalid X handle", hint: "Use 1–15 letters, numbers, or underscores. You can include @ when typing; it is stripped before save." },
      { status: 400 }
    );
  }

  const displayName = clip(displayNameIn, 80);
  if (displayName.length < 2) {
    return Response.json({ error: "Display name must be at least 2 characters." }, { status: 400 });
  }

  const { data: existingSource } = await db
    .from("outside_x_sources")
    .select("id,status")
    .eq("x_handle_normalized", handle)
    .in("status", ["active", "suspended"])
    .maybeSingle();
  if (existingSource) {
    return Response.json({ error: "That X account is already on the monitor list.", code: "DUPLICATE" }, { status: 409 });
  }

  const activeCount = await countActiveOutsideXSources(db);
  if (activeCount >= OUTSIDE_X_MAX_ACTIVE_SOURCES) {
    return Response.json(
      {
        error: `Monitor list is at capacity (${OUTSIDE_X_MAX_ACTIVE_SOURCES}). Remove or suspend a source first.`,
        code: "CAPACITY",
      },
      { status: 503 }
    );
  }

  const nowIso = new Date().toISOString();
  const { data: inserted, error } = await db
    .from("outside_x_sources")
    .insert({
      x_handle_normalized: handle,
      display_name: displayName,
      trust_score: 50,
      status: "active",
      suspension_review_pending: false,
      created_at: nowIso,
      updated_at: nowIso,
    })
    .select("id")
    .maybeSingle();

  if (error) {
    if ((error as { code?: string }).code === "23505") {
      return Response.json({ error: "That handle is already on the monitor list.", code: "DUPLICATE" }, { status: 409 });
    }
    console.error("[outside-calls/admin-add-source]", error);
    return Response.json({ error: "Could not create source" }, { status: 500 });
  }

  const id = inserted && typeof (inserted as { id?: string }).id === "string" ? (inserted as { id: string }).id : null;
  if (!id) {
    return Response.json({ error: "Could not create source" }, { status: 500 });
  }

  return Response.json({
    success: true,
    sourceId: id,
    message: "Monitor added. Ingestion can use this handle immediately.",
  });
}
