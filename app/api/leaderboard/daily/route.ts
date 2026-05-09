import { CALL_PERFORMANCE_ELIGIBLE_FOR_PUBLIC_STATS_OR } from "@/lib/callPerformanceDashboardVisibility";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
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
    const supabase = getSupabaseAdmin();
    if (!supabase) {
      return Response.json({ success: false, error: "Supabase not configured" }, { status: 500 });
    }

    const nowMs = Date.now();
    const windowId = clampWindow(new URL(req.url).searchParams.get("window") ?? "");
    const minMsBase = windowId === "today" ? startOfUtcDayMs(nowMs) : nowMs - DAY;
    const cutoverMs = await getStatsCutoverUtcMs();
    const minMs = mergeStatsCutoverIntoMin(minMsBase, cutoverMs);

    // `call_performance.call_time` is BIGINT (epoch ms) in this project — compare with numbers, not ISO strings.
    // Be tolerant if the `excluded_from_stats` migration hasn't been applied yet.
    // In that case, we still want the widget to work (it just won't be able to exclude rows).
    let data: unknown[] | null = null;
    {
      const r = await supabase
        .from("call_performance")
        .select("username, call_time, excluded_from_stats")
        .or(CALL_PERFORMANCE_ELIGIBLE_FOR_PUBLIC_STATS_OR)
        .gte("call_time", minMs)
        .order("call_time", { ascending: false })
        .limit(5000);
      if (!r.error) {
        data = (Array.isArray(r.data) ? r.data : []) as unknown[];
      } else {
        const msg = String((r.error as any).message ?? "");
        if (msg.toLowerCase().includes("excluded_from_stats")) {
          const fallback = await supabase
            .from("call_performance")
            .select("username, call_time")
            .or(CALL_PERFORMANCE_ELIGIBLE_FOR_PUBLIC_STATS_OR)
            .gte("call_time", minMs)
            .order("call_time", { ascending: false })
            .limit(5000);
          if (fallback.error) {
            console.error("[leaderboard/daily] supabase fallback:", fallback.error);
            return Response.json(
              { success: false, error: "Failed to load leaderboard" },
              { status: 500 }
            );
          }
          data = (Array.isArray(fallback.data) ? fallback.data : []) as unknown[];
        } else {
          console.error("[leaderboard/daily] supabase:", r.error);
          return Response.json(
            { success: false, error: "Failed to load leaderboard" },
            { status: 500 }
          );
        }
      }
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

