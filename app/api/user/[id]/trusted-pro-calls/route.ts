import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { resolveDiscordIdFromProfileRouteParam } from "@/lib/discordIdentity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id: rawId } = await context.params;
    const routeParam = decodeURIComponent(String(rawId ?? "")).trim();
    if (!routeParam || routeParam.length > 200) {
      return Response.json({ success: false, error: "Invalid user id" }, { status: 400 });
    }

    const db = getSupabaseAdmin();
    if (!db) {
      return Response.json({ success: false, error: "Supabase not configured" }, { status: 500 });
    }

    const discordId = await resolveDiscordIdFromProfileRouteParam(db as any, routeParam);
    if (!discordId) {
      return Response.json({ success: false, error: "User not found" }, { status: 404 });
    }

    const session = await getServerSession(authOptions);
    const viewerId = session?.user?.id?.trim() ?? "";
    const canModerate = session?.user?.canModerate === true;
    const isOwner = viewerId && viewerId === discordId;
    const includeAllStatuses = Boolean(isOwner || canModerate);

    let q = db
      .from("trusted_pro_calls")
      .select(
        "id, contract_address, thesis, narrative, status, staff_notes, reviewed_at, published_at, views_count, created_at"
      )
      .eq("author_discord_id", discordId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (!includeAllStatuses) {
      q = q.eq("status", "approved");
    }

    const { data, error } = await q;
    if (error) {
      console.error("[user/trusted-pro-calls] supabase:", error);
      return Response.json({ success: false, error: "Failed to load calls" }, { status: 500 });
    }

    return Response.json({
      success: true,
      includeAllStatuses,
      rows: Array.isArray(data) ? data : [],
    });
  } catch (e) {
    console.error("[user/trusted-pro-calls] GET:", e);
    return Response.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}

