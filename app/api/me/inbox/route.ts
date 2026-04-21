import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

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

    const { data, error } = await db
      .from("user_inbox_notifications")
      .select("id, title, body, kind, created_at, read_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      console.error("[me/inbox] select:", error);
      return Response.json({ error: "Failed to load inbox" }, { status: 500 });
    }

    const rows = (Array.isArray(data) ? data : []).map((r) => ({
      id: String((r as any).id ?? ""),
      title: String((r as any).title ?? ""),
      body: String((r as any).body ?? ""),
      kind: String((r as any).kind ?? "info"),
      createdAt: String((r as any).created_at ?? ""),
      readAt: (r as any).read_at == null ? null : String((r as any).read_at),
    }));

    const unread = rows.filter((r) => !r.readAt).length;

    return Response.json({ success: true, unread, rows });
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

