import { requireDashboardAdmin } from "@/lib/adminGate";
import {
  normalizeCategoryOther,
  parseSocialFeedCategorySlug,
} from "@/lib/socialFeedCategories";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isUuid(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id.trim());
}

function asBool(v: unknown): boolean {
  return v === true || v === "true" || v === 1 || v === "1";
}

function normalizeHandle(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const h = raw.trim().replace(/^@+/, "").toLowerCase();
  if (!h || h.length > 80) return null;
  return h;
}

type SourceRow = {
  id: string;
  platform: string;
  handle: string;
  display_name: string | null;
  active: boolean;
  category: string | null;
  category_other: string | null;
  x_exclude_replies: boolean;
};

const SELECT_RETURN =
  "id, platform, handle, display_name, active, category, category_other, x_exclude_replies";

/**
 * Update a monitored social source (partial body). At least one of:
 * display_name, handle, category, category_other, active, x_exclude_replies
 */
export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireDashboardAdmin();
  if (!gate.ok) return gate.response;

  const { id: rawId } = await ctx.params;
  const id = typeof rawId === "string" ? rawId.trim() : "";
  if (!id || !isUuid(id)) {
    return Response.json({ error: "Invalid source id" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const o = body && typeof body === "object" ? (body as Record<string, unknown>) : {};

  const db = getSupabaseAdmin();
  if (!db) {
    return Response.json({ error: "Database not configured" }, { status: 503 });
  }

  const { data: existing, error: loadErr } = await db
    .from("social_feed_sources")
    .select("id, platform, handle, display_name, active, category, category_other, x_exclude_replies")
    .eq("id", id)
    .maybeSingle();

  if (loadErr) {
    console.error("[admin/social-feed-sources PATCH] load", loadErr);
    return Response.json({ error: "Failed to load source" }, { status: 500 });
  }
  if (!existing || typeof existing !== "object") {
    return Response.json({ error: "Source not found" }, { status: 404 });
  }

  const ex = existing as SourceRow;
  const platform = String(ex.platform || "").toLowerCase();

  const patch: Record<string, unknown> = {};

  if ("display_name" in o) {
    const d = typeof o.display_name === "string" ? o.display_name.trim() : "";
    patch.display_name = d.length > 0 ? d.slice(0, 120) : null;
  }

  if ("handle" in o) {
    const nh = normalizeHandle(o.handle);
    if (!nh) {
      return Response.json({ error: "Invalid handle (use letters/numbers/underscore; max 80 chars)." }, { status: 400 });
    }
    const cur = String(ex.handle || "")
      .trim()
      .replace(/^@+/, "")
      .toLowerCase();
    if (nh !== cur) {
      const { data: others, error: dupErr } = await db
        .from("social_feed_sources")
        .select("id, handle")
        .eq("platform", ex.platform)
        .neq("id", id);
      if (dupErr) {
        console.error("[admin/social-feed-sources PATCH] dup check", dupErr);
        return Response.json({ error: "Could not verify handle uniqueness" }, { status: 500 });
      }
      const clash = (others ?? []).some(
        (r) =>
          String((r as { handle?: string }).handle || "")
            .trim()
            .replace(/^@+/, "")
            .toLowerCase() === nh
      );
      if (clash) {
        return Response.json(
          { error: "Another source already uses this handle on the same platform." },
          { status: 409 }
        );
      }
      patch.handle = nh;
    }
  }

  if ("category" in o) {
    const slug = parseSocialFeedCategorySlug(o.category);
    if (!slug) {
      return Response.json({ error: "Invalid category slug." }, { status: 400 });
    }
    patch.category = slug;
    if (slug !== "other") {
      patch.category_other = null;
    } else if ("category_other" in o) {
      patch.category_other = normalizeCategoryOther(o.category_other);
    }
  } else if ("category_other" in o && String(ex.category || "").toLowerCase() === "other") {
    patch.category_other = normalizeCategoryOther(o.category_other);
  }

  if ("active" in o) {
    patch.active = asBool(o.active);
  }

  if ("x_exclude_replies" in o) {
    if (platform === "x") {
      patch.x_exclude_replies = asBool(o.x_exclude_replies);
    }
  }

  if (Object.keys(patch).length === 0) {
    return Response.json(
      {
        error:
          "Nothing to update. Send one or more of: display_name, handle, category, category_other, active, x_exclude_replies.",
      },
      { status: 400 }
    );
  }

  const { data: updated, error } = await db
    .from("social_feed_sources")
    .update(patch)
    .eq("id", id)
    .select(SELECT_RETURN)
    .maybeSingle();

  if (error) {
    if ((error as { code?: string }).code === "23505") {
      return Response.json({ error: "Handle conflict (unique platform + handle)." }, { status: 409 });
    }
    console.error("[admin/social-feed-sources PATCH]", error);
    return Response.json({ error: "Update failed" }, { status: 500 });
  }

  return Response.json({ success: true, source: updated });
}

/** Deletes the source and all cached posts (FK cascade). */
export async function DELETE(_request: Request, ctx: { params: Promise<{ id: string }> }) {
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

  const { error } = await db.from("social_feed_sources").delete().eq("id", id);
  if (error) {
    console.error("[admin/social-feed-sources DELETE]", error);
    return Response.json({ error: "Delete failed" }, { status: 500 });
  }

  return Response.json({ success: true });
}
