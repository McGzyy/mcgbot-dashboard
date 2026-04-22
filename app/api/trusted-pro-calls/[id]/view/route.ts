import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  _request: Request,
  ctx: { params: { id: string } }
) {
  try {
    const { id } = ctx.params;
    const callId = String(id || "").trim();
    if (!callId) {
      return Response.json({ success: false, error: "Missing id" }, { status: 400 });
    }

    const db = getSupabaseAdmin();
    if (!db) {
      return Response.json({ success: false, error: "Supabase not configured" }, { status: 500 });
    }

    const session = await getServerSession(authOptions);
    const viewerDiscordId = session?.user?.id?.trim() || null;

    if (viewerDiscordId) {
      // Best-effort: insert unique view row; duplicates are ignored by unique index.
      await db.from("trusted_pro_call_views").insert({
        call_id: callId,
        viewer_discord_id: viewerDiscordId,
      });
    }

    // Increment aggregate counter (best-effort; some races are acceptable for v1).
    const { data: row, error: loadErr } = await db
      .from("trusted_pro_calls")
      .select("views_count")
      .eq("id", callId)
      .maybeSingle();
    if (!loadErr) {
      const cur = Number((row as any)?.views_count ?? 0);
      const next = Number.isFinite(cur) && cur >= 0 ? cur + 1 : 1;
      await db.from("trusted_pro_calls").update({ views_count: next }).eq("id", callId);
    }

    return Response.json({ success: true });
  } catch (e) {
    console.error("[trusted-pro-calls/view] POST:", e);
    return Response.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}

