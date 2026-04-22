import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ONLINE_WINDOW_MS = 5 * 60_000;

export async function GET() {
  try {
    const db = getSupabaseAdmin();
    if (!db) {
      return Response.json(
        { success: false, error: "Supabase not configured" },
        { status: 500 }
      );
    }

    const nowIso = new Date().toISOString();
    const onlineMinIso = new Date(Date.now() - ONLINE_WINDOW_MS).toISOString();

    const [totalRes, onlineRes] = await Promise.all([
      db.from("users").select("id", { count: "exact", head: true }),
      db
        .from("user_presence")
        .select("user_id", { count: "exact", head: true })
        .gte("last_seen_at", onlineMinIso),
    ]);

    if (totalRes.error) {
      console.error("[public/user-counts] total:", totalRes.error);
      return Response.json(
        { success: false, error: "Failed to load user stats" },
        { status: 500 }
      );
    }

    if (onlineRes.error) {
      console.error("[public/user-counts] online:", onlineRes.error);
      return Response.json(
        { success: false, error: "Failed to load user stats" },
        { status: 500 }
      );
    }

    return Response.json({
      success: true,
      at: nowIso,
      totalUsers: totalRes.count ?? 0,
      onlineUsers: onlineRes.count ?? 0,
    });
  } catch (e) {
    console.error("[public/user-counts] GET:", e);
    return Response.json(
      { success: false, error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

