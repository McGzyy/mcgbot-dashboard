import { createClient } from "@supabase/supabase-js";

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
      .from("user_badges")
      .select("badge")
      .eq("user_id", profileUserId);

    console.log("BADGES:", data, error);

    if (error) {
      console.error("[user badges API] GET:", error);
      return Response.json(
        { error: "Failed to load badges" },
        { status: 500 }
      );
    }

    const rows = Array.isArray(data) ? data : [];
    const badges = rows
      .map((r) => {
        const row = r as Record<string, unknown>;
        const b = row.badge;
        return typeof b === "string" ? b.trim() : String(b ?? "").trim();
      })
      .filter(Boolean);

    return Response.json(badges);
  } catch (e) {
    console.error("[user badges API] GET:", e);
    return Response.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

