import { createClient } from "@supabase/supabase-js";
import { TOP_CALLER_BADGE_KEY, topCallerBadgeToken } from "@/lib/topCallerBadgeDisplay";

function parseUserIds(body: unknown): string[] {
  if (!body || typeof body !== "object") return [];
  const raw = (body as Record<string, unknown>).userIds;
  if (!Array.isArray(raw)) return [];
  const ids: string[] = [];
  for (const v of raw) {
    const s = typeof v === "string" ? v.trim() : String(v ?? "").trim();
    if (!s) continue;
    if (s.length > 64) continue;
    ids.push(s);
  }
  return Array.from(new Set(ids));
}

export async function POST(request: Request) {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const userIds = parseUserIds(body);
    if (userIds.length === 0) {
      return Response.json({});
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
      .select("user_id, badge, times_awarded")
      .in("user_id", userIds);

    if (error) {
      console.error("[badges API] POST:", error);
      return Response.json({ error: "Failed to load badges" }, { status: 500 });
    }

    const rows = Array.isArray(data) ? data : [];
    const out: Record<string, string[]> = {};
    for (const r of rows) {
      const row = r as Record<string, unknown>;
      const uid =
        typeof row.user_id === "string"
          ? row.user_id.trim()
          : String(row.user_id ?? "").trim();
      const badge =
        typeof row.badge === "string"
          ? row.badge.trim()
          : String(row.badge ?? "").trim();
      if (!uid || !badge) continue;
      const timesRaw = row.times_awarded;
      const times =
        typeof timesRaw === "number" && Number.isFinite(timesRaw)
          ? timesRaw
          : Number(timesRaw);
      const token =
        badge === TOP_CALLER_BADGE_KEY && Number.isFinite(times) && times >= 1
          ? topCallerBadgeToken(times)
          : badge;
      (out[uid] ??= []).push(token);
    }
    return Response.json(out);
  } catch (e) {
    console.error("[badges API] POST:", e);
    return Response.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

