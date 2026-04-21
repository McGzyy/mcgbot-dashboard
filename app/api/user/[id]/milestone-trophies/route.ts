import { createClient } from "@supabase/supabase-js";

export type MilestoneTrophyRowDto = {
  id: string;
  milestoneKey: string;
  createdAt: string | null;
};

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: rawId } = await context.params;
    const profileUserId = decodeURIComponent(String(rawId ?? "")).trim();
    if (!profileUserId || profileUserId.length > 64) {
      return Response.json({ error: "Invalid user id" }, { status: 400 });
    }

    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_ANON_KEY;

    if (!url || !key) {
      console.error("Missing Supabase env vars");
      return Response.json(
        { error: "Supabase not configured" },
        { status: 500 }
      );
    }

    const supabase = createClient(url, key);

    const { data, error } = await supabase
      .from("user_milestone_trophies")
      .select("id, milestone_key, created_at")
      .eq("user_id", profileUserId)
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
