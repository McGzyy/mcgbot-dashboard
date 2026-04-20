import { createClient } from "@supabase/supabase-js";
import { filterCallRowsForStats, getStatsCutoverUtcMs, mergeStatsCutoverIntoMin } from "@/lib/statsCutover";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type WindowId = "rolling24h" | "today";

const DAY = 86_400_000;

function startOfUtcDayMs(ms: number): number {
  const d = new Date(ms);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

function clampWindow(raw: string): WindowId {
  return raw === "today" ? "today" : "rolling24h";
}

export async function GET(req: Request) {
  try {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_ANON_KEY;
    if (!url || !key) {
      return Response.json({ success: false, error: "Supabase not configured" }, { status: 500 });
    }
    const supabase = createClient(url, key);

    const nowMs = Date.now();
    const windowId = clampWindow(new URL(req.url).searchParams.get("window") ?? "");
    const minMsBase = windowId === "today" ? startOfUtcDayMs(nowMs) : nowMs - DAY;
    const cutoverMs = await getStatsCutoverUtcMs();
    const minMs = mergeStatsCutoverIntoMin(minMsBase, cutoverMs);

    const { data, error } = await supabase
      .from("call_performance")
      .select("username, call_time, excluded_from_stats")
      .gte("call_time", new Date(minMs).toISOString());

    if (error) {
      console.error("[leaderboard/daily] supabase:", error);
      return Response.json({ success: false, error: "Failed to load leaderboard" }, { status: 500 });
    }

    const raw = (Array.isArray(data) ? data : []) as Record<string, unknown>[];
    const rows = filterCallRowsForStats(raw, cutoverMs);

    const counts = new Map<string, number>();
    for (const r of rows) {
      const u = typeof r.username === "string" ? r.username.trim() : String(r.username ?? "").trim();
      if (!u) continue;
      counts.set(u, (counts.get(u) ?? 0) + 1);
    }

    const out = [...counts.entries()]
      .map(([username, calls]) => ({ username, calls }))
      .sort((a, b) => b.calls - a.calls)
      .slice(0, 50);

    return Response.json({ success: true, rows: out });
  } catch (e) {
    console.error("[leaderboard/daily] GET:", e);
    return Response.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}

