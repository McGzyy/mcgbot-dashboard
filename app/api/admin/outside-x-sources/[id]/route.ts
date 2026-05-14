import { requireDashboardAdmin } from "@/lib/adminGate";
import { OUTSIDE_X_MAX_ACTIVE_SOURCES } from "@/lib/outsideXCalls/constants";
import { countActiveOutsideXSources } from "@/lib/outsideXCalls/activeSourcesCount";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATUS_SET = new Set(["active", "suspended", "removed"]);

function clip(s: string, max: number): string {
  const t = s.trim();
  if (t.length <= max) return t;
  return t.slice(0, max);
}

function isUuid(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    id.trim()
  );
}

/**
 * Update display label and/or lifecycle status for one `outside_x_sources` row.
 */
export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireDashboardAdmin();
  if (!gate.ok) return gate.response;

  const { id: rawId } = await ctx.params;
  const id = typeof rawId === "string" ? rawId.trim() : "";
  if (!id || !isUuid(id)) {
    return Response.json({ error: "Invalid source id" }, { status: 400 });
  }

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

  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if ("displayName" in o || "display_name" in o) {
    const dnIn =
      typeof o.displayName === "string"
        ? o.displayName
        : typeof o.display_name === "string"
          ? o.display_name
          : "";
    const displayName = clip(dnIn, 80);
    if (displayName.length < 2) {
      return Response.json({ error: "Display name must be at least 2 characters." }, { status: 400 });
    }
    patch.display_name = displayName;
  }

  if ("status" in o) {
    const st = typeof o.status === "string" ? o.status.trim().toLowerCase() : "";
    if (!STATUS_SET.has(st)) {
      return Response.json(
        { error: "Invalid status", allowed: ["active", "suspended", "removed"] },
        { status: 400 }
      );
    }
    patch.status = st;
    if (st === "removed") {
      patch.suspension_review_pending = false;
    }
  }

  if (Object.keys(patch).length <= 1) {
    return Response.json({ error: "Nothing to update (send displayName and/or status)." }, { status: 400 });
  }

  const { data: existing, error: loadErr } = await db
    .from("outside_x_sources")
    .select("id,x_handle_normalized,status")
    .eq("id", id)
    .maybeSingle();

  if (loadErr) {
    console.error("[admin/outside-x-sources PATCH] load", loadErr);
    return Response.json({ error: "Failed to load source" }, { status: 500 });
  }
  if (!existing || typeof existing !== "object") {
    return Response.json({ error: "Source not found" }, { status: 404 });
  }

  const prevStatus =
    typeof (existing as { status?: string }).status === "string"
      ? (existing as { status: string }).status.trim().toLowerCase()
      : "";
  const nextStatus =
    typeof patch.status === "string" ? (patch.status as string).trim().toLowerCase() : prevStatus;

  const prevInPool = prevStatus === "active" || prevStatus === "suspended";
  const nextInPool = nextStatus === "active" || nextStatus === "suspended";

  if (nextInPool) {
    const handle =
      typeof (existing as { x_handle_normalized?: string }).x_handle_normalized === "string"
        ? (existing as { x_handle_normalized: string }).x_handle_normalized.trim()
        : "";
    if (handle) {
      const { data: dup, error: dupErr } = await db
        .from("outside_x_sources")
        .select("id")
        .eq("x_handle_normalized", handle)
        .in("status", ["active", "suspended"])
        .neq("id", id)
        .maybeSingle();
      if (dupErr) {
        console.error("[admin/outside-x-sources PATCH] dup", dupErr);
        return Response.json({ error: "Could not verify handle uniqueness" }, { status: 500 });
      }
      if (dup) {
        return Response.json(
          { error: "Another monitor already uses this X handle while active or suspended." },
          { status: 409 }
        );
      }
    }
  }

  if (!prevInPool && nextInPool) {
    const activeCount = await countActiveOutsideXSources(db);
    if (activeCount >= OUTSIDE_X_MAX_ACTIVE_SOURCES) {
      return Response.json(
        {
          error: `Monitor list is at capacity (${OUTSIDE_X_MAX_ACTIVE_SOURCES}). Suspend or remove another source first.`,
          code: "CAPACITY",
        },
        { status: 503 }
      );
    }
  }

  const { data: updated, error } = await db
    .from("outside_x_sources")
    .update(patch)
    .eq("id", id)
    .select(
      "id,x_handle_normalized,display_name,trust_score,status,suspension_review_pending,created_at,updated_at"
    )
    .maybeSingle();

  if (error) {
    if ((error as { code?: string }).code === "23505") {
      return Response.json({ error: "Handle conflict with another active or suspended row." }, { status: 409 });
    }
    console.error("[admin/outside-x-sources PATCH]", error);
    return Response.json({ error: "Update failed" }, { status: 500 });
  }

  return Response.json({ success: true, source: updated });
}
