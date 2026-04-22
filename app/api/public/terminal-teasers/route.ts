import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { rowAthMultiple } from "@/lib/callPerformanceMultiples";
import { filterCallRowsForStats, getStatsCutoverUtcMs, mergeStatsCutoverIntoMin } from "@/lib/statsCutover";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DAY = 86_400_000;

export async function GET() {
  try {
    const db = getSupabaseAdmin();
    if (!db) {
      return Response.json({ success: false, error: "Supabase not configured" }, { status: 500 });
    }

    const nowMs = Date.now();
    const weekMinBase = nowMs - 7 * DAY;
    const cutoverMs = await getStatsCutoverUtcMs();
    const weekMinMs = mergeStatsCutoverIntoMin(weekMinBase, cutoverMs);

    const { data, error } = await db
      .from("call_performance")
      .select(
        "id, username, call_ca, ath_multiple, spot_multiple, call_time, source, excluded_from_stats"
      )
      .gte("call_time", weekMinMs)
      .order("call_time", { ascending: false })
      .limit(5000);

    if (error) {
      console.error("[public/terminal-teasers] supabase:", error);
      return Response.json({ success: false, error: "Failed to load teasers" }, { status: 500 });
    }

    const raw = (Array.isArray(data) ? data : []) as Record<string, unknown>[];
    const rows = filterCallRowsForStats(raw, cutoverMs);

    let sum = 0;
    let n = 0;
    const top = new Map<string, { token: string; multiple: number; username: string; source: string; time: unknown }>();
    for (const r of rows) {
      const multiple = rowAthMultiple(r);
      sum += multiple;
      n += 1;

      const id = typeof r.id === "string" ? r.id : String(r.id ?? "");
      const username = typeof r.username === "string" ? r.username.trim() : String(r.username ?? "").trim();
      const token = typeof r.call_ca === "string" ? r.call_ca.trim() : String(r.call_ca ?? "").trim();
      const source = typeof r.source === "string" ? r.source : "user";
      const time = r.call_time;
      const prev = top.get(id);
      if (!prev || multiple > prev.multiple) {
        top.set(id, { token: token || "Unknown", multiple, username: username || "Unknown", source, time });
      }
    }

    const topWeek = [...top.values()]
      .filter((x) => x.multiple > 0)
      .sort((a, b) => b.multiple - a.multiple)
      .slice(0, 5);

    return Response.json({
      success: true,
      week: {
        calls: n,
        avgX: n > 0 ? sum / n : 0,
        topCalls: topWeek,
      },
    });
  } catch (e) {
    console.error("[public/terminal-teasers] GET:", e);
    return Response.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}

