import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { loadUserInboxBellRows } from "@/lib/userInboxLoad";

const DEFAULT_LIMIT = 20;

function parseLimit(raw: string | null): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return DEFAULT_LIMIT;
  return Math.min(50, Math.max(1, Math.floor(n)));
}

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id?.trim() ?? "";
    if (!userId) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const db = getSupabaseAdmin();
    if (!db) {
      return Response.json({ error: "Supabase not configured" }, { status: 500 });
    }

    const { searchParams } = new URL(request.url);
    const limit = parseLimit(searchParams.get("limit"));

    const payload = await loadUserInboxBellRows(db, userId, limit);
    const rows = payload.items.map((r) => ({
      id: r.id,
      title: r.title,
      body: r.body,
      kind: r.kind,
      actionHref: r.action_href,
      createdAt: r.created_at,
      readAt: r.read_at,
    }));

    return Response.json({ success: true, unread: payload.unreadCount, rows });
  } catch (e) {
    console.error("[me/inbox] GET:", e);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id?.trim() ?? "";
    if (!userId) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const db = getSupabaseAdmin();
    if (!db) {
      return Response.json({ error: "Supabase not configured" }, { status: 500 });
    }

    const body = (await request.json().catch(() => null)) as unknown;
    const o = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
    const idsRaw = o.ids;
    const all = o.all === true;

    const nowIso = new Date().toISOString();

    if (all) {
      const { error } = await db
        .from("user_inbox_notifications")
        .update({ read_at: nowIso })
        .eq("user_id", userId)
        .is("read_at", null);
      if (error) {
        console.error("[me/inbox] mark all read:", error);
        return Response.json({ error: "Failed to update inbox" }, { status: 500 });
      }
      return Response.json({ success: true });
    }

    if (!Array.isArray(idsRaw) || idsRaw.length === 0) {
      return Response.json({ error: "Missing ids" }, { status: 400 });
    }

    const ids = idsRaw
      .map((x) => (typeof x === "string" ? x.trim() : String(x ?? "").trim()))
      .filter(Boolean)
      .slice(0, 50);

    if (ids.length === 0) {
      return Response.json({ error: "Missing ids" }, { status: 400 });
    }

    const { error } = await db
      .from("user_inbox_notifications")
      .update({ read_at: nowIso })
      .eq("user_id", userId)
      .in("id", ids);

    if (error) {
      console.error("[me/inbox] mark read:", error);
      return Response.json({ error: "Failed to update inbox" }, { status: 500 });
    }

    return Response.json({ success: true });
  } catch (e) {
    console.error("[me/inbox] PATCH:", e);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
