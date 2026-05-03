import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

type InboxRow = {
  id: string;
  title: string;
  body: string;
  kind: string;
  created_at: string;
  read_at: string | null;
};

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id?.trim() ?? "";
    if (!userId) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();
    if (!supabase) {
      return Response.json({ items: [] as InboxRow[], unreadCount: 0 });
    }

    const { data, error } = await supabase
      .from("user_inbox_notifications")
      .select("id, title, body, kind, created_at, read_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      console.error("[inbox-notifications] GET:", error);
      return Response.json({ items: [] as InboxRow[], unreadCount: 0 });
    }

    const items: InboxRow[] = [];
    for (const row of data ?? []) {
      if (!row || typeof row !== "object") continue;
      const o = row as Record<string, unknown>;
      const id = typeof o.id === "string" ? o.id : "";
      if (!id) continue;
      items.push({
        id,
        title: typeof o.title === "string" ? o.title : "",
        body: typeof o.body === "string" ? o.body : "",
        kind: typeof o.kind === "string" ? o.kind : "info",
        created_at:
          typeof o.created_at === "string"
            ? o.created_at
            : new Date(0).toISOString(),
        read_at:
          o.read_at == null
            ? null
            : typeof o.read_at === "string"
              ? o.read_at
              : null,
      });
    }

    const unreadCount = items.filter((r) => r.read_at == null).length;
    return Response.json({ items, unreadCount });
  } catch (e) {
    console.error("[inbox-notifications] GET:", e);
    return Response.json({ items: [], unreadCount: 0 });
  }
}

/** Mark all inbox rows read for the signed-in user (clears bell badge for server-sent messages). */
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
