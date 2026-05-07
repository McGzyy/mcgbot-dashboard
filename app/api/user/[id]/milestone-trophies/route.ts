import {
  looksLikeDiscordSnowflake,
  resolveDiscordIdFromProfileRouteParam,
} from "@/lib/discordIdentity";
import { isPublicProfileHiddenFromViewer } from "@/lib/profileGuildVisibility";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export type MilestoneTrophyRowDto = {
  id: string;
  milestoneKey: string;
  createdAt: string | null;
};

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: rawId } = await context.params;
    const routeParam = decodeURIComponent(String(rawId ?? "")).trim();
    if (!routeParam || routeParam.length > 200) {
      return Response.json({ error: "Invalid user id" }, { status: 400 });
    }

    const db = getSupabaseAdmin();
    if (!db) {
      return Response.json(
        { error: "Supabase not configured" },
        { status: 500 }
      );
    }

    const discordId = looksLikeDiscordSnowflake(routeParam)
      ? routeParam.trim()
      : await resolveDiscordIdFromProfileRouteParam(db, routeParam);

    if (!discordId) {
      return Response.json({ error: "User not found" }, { status: 404 });
    }

    if (await isPublicProfileHiddenFromViewer(discordId)) {
      return Response.json({ error: "User not found" }, { status: 404 });
    }

    const { data, error } = await db
      .from("user_milestone_trophies")
      .select("id, milestone_key, created_at")
      .eq("user_id", discordId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("[user milestone-trophies API] GET:", error);
      return Response.json(
        { error: "Failed to load milestone trophies" },
        { status: 500 }
      );
    }

    const raw = Array.isArray(data) ? data : [];
    const rows: MilestoneTrophyRowDto[] = [];
    for (const r of raw) {
      const row = r as Record<string, unknown>;
      const id = typeof row.id === "string" ? row.id : String(row.id ?? "");
      const mk =
        typeof row.milestone_key === "string"
          ? row.milestone_key.trim()
          : "";
      const ca = row.created_at;
      const createdAt =
        ca == null
          ? null
          : typeof ca === "string"
            ? ca
            : String(ca);
      if (!id || !mk || mk.length > 96) continue;
      rows.push({ id, milestoneKey: mk, createdAt });
    }

    return Response.json({ milestones: rows });
  } catch (e) {
    console.error("[user milestone-trophies API] GET:", e);
    return Response.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
