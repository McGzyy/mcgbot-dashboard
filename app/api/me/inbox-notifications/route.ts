import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { loadUserInboxBellRows } from "@/lib/userInboxLoad";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id?.trim() ?? "";
    if (!userId) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();
    if (!supabase) {
      return Response.json({ items: [], unreadCount: 0 });
    }

    const payload = await loadUserInboxBellRows(supabase, userId, 50);
    return Response.json(payload);
  } catch (e) {
    console.error("[inbox-notifications] GET:", e);
    return Response.json({ items: [], unreadCount: 0 });
  }
}

/** @deprecated Prefer PATCH /api/me/inbox with `{ all: true }`. */
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id?.trim() ?? "";
    if (!userId) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    let readAll = false;
    try {
      const j = (await req.json().catch(() => ({}))) as { readAll?: unknown };
      readAll = j.readAll === true;
    } catch {
      /* ignore */
    }
    if (!readAll) {
      return Response.json({ error: "Unsupported body" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    if (!supabase) {
      return Response.json({ ok: false, error: "Server storage not configured" }, { status: 503 });
    }

    const now = new Date().toISOString();
    const { error } = await supabase
      .from("user_inbox_notifications")
      .update({ read_at: now })
      .eq("user_id", userId)
      .is("read_at", null);

    if (error) {
      console.error("[inbox-notifications] POST:", error);
      return Response.json({ ok: false }, { status: 500 });
    }

    return Response.json({ ok: true });
  } catch (e) {
    console.error("[inbox-notifications] POST:", e);
    return Response.json({ ok: false }, { status: 500 });
  }
}
