import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id?.trim();
    if (!userId) {
      return Response.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const db = getSupabaseAdmin();
    if (!db) {
      return Response.json({ success: false, error: "Supabase not configured" }, { status: 500 });
    }

    const { error } = await db
      .from("user_presence")
      .upsert({ user_id: userId, last_seen_at: new Date().toISOString() }, { onConflict: "user_id" });

    if (error) {
      console.error("[me/presence] upsert:", error);
      return Response.json({ success: false, error: "Failed to update presence" }, { status: 500 });
    }

    return Response.json({ success: true });
  } catch (e) {
    console.error("[me/presence] POST:", e);
    return Response.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}

