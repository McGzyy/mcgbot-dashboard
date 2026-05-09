import { requireDashboardAdmin } from "@/lib/adminGate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function flag(v: string | undefined): boolean | null {
  if (v == null) return null;
  const s = String(v).trim().toLowerCase();
  if (s === "") return null;
  if (["1", "true", "yes", "on"].includes(s)) return true;
  if (["0", "false", "no", "off"].includes(s)) return false;
  return null;
}

function num(v: string | undefined): number | null {
  if (v == null) return null;
  const s = String(v).trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export async function GET() {
  const gate = await requireDashboardAdmin();
  if (!gate.ok) return gate.response;

  return Response.json({
    success: true,
    nowUtc: new Date().toISOString(),
    x: {
      digestEnabled: flag(process.env.X_LEADERBOARD_DIGEST_ENABLED),
      dailyEnabled: flag(process.env.X_LEADERBOARD_DAILY_DIGEST_ENABLED),
      weeklyEnabled: flag(process.env.X_LEADERBOARD_WEEKLY_DIGEST_ENABLED),
      monthlyEnabled: flag(process.env.X_LEADERBOARD_MONTHLY_DIGEST_ENABLED),
      digestUtcHour: num(process.env.X_LEADERBOARD_DIGEST_UTC_HOUR),
      weeklyUtcWeekday: num(process.env.X_LEADERBOARD_WEEKLY_UTC_WEEKDAY),
      weeklyStatsSnapshotEnabled: flag(process.env.X_WEEKLY_STATS_SNAPSHOT_ENABLED),
      weeklyStatsUtcHour: num(process.env.X_WEEKLY_STATS_UTC_HOUR),
      weeklyStatsUtcWeekday: num(process.env.X_WEEKLY_STATS_UTC_WEEKDAY),
      oauth1aConfigured: Boolean(
        String(process.env.X_API_KEY || "").trim() &&
          String(process.env.X_API_SECRET || "").trim() &&
          String(process.env.X_ACCESS_TOKEN || "").trim() &&
          String(process.env.X_ACCESS_TOKEN_SECRET || "").trim()
      ),
      botUsername: String(process.env.X_BOT_USERNAME || "").trim() || null,
    },
  });
}

