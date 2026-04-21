import { awardTrophies } from "@/lib/awardTrophies";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorizeCron(request: Request): boolean {
  const secret = (process.env.CRON_SECRET ?? "").trim();
  if (!secret) return false;
  const auth = request.headers.get("authorization") ?? "";
  const bearer = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  const header = (request.headers.get("x-cron-secret") ?? "").trim();
  return bearer === secret || header === secret;
}

type TrophyTimeframe = "daily" | "weekly" | "monthly";

export async function POST(request: Request) {
  if (!authorizeCron(request)) {
    return Response.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const db = getSupabaseAdmin();
  if (!db) {
    return Response.json(
      { success: false, error: "Database not configured" },
      { status: 503 }
    );
  }

  const nowMs = Date.now();
  const d = new Date(nowMs);
  const dow = d.getUTCDay();
  const dom = d.getUTCDate();

  const timeframes: TrophyTimeframe[] = ["daily"];
  if (dow === 1) timeframes.push("weekly");
  if (dom === 1) timeframes.push("monthly");

  const runs: Array<{
    timeframe: TrophyTimeframe;
    periodStartMs: number;
    inserted: number;
    leaderCount: number;
    error?: string;
  }> = [];

  for (const timeframe of timeframes) {
    const r = await awardTrophies(db, timeframe, { nowMs });
    runs.push({
      timeframe,
      periodStartMs: r.periodStartMs,
      inserted: r.inserted,
      leaderCount: r.leaders.length,
      error: r.error ? r.error.message : undefined,
    });
  }

  const failed = runs.find((x) => x.error);
  if (failed) {
    console.error("[cron/award-leaderboard-trophies]", failed);
    return Response.json({ success: false, runs }, { status: 500 });
  }

  return Response.json({ success: true, runs });
}

export async function GET(request: Request) {
  return POST(request);
}
