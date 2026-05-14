import { requireDashboardAdmin } from "@/lib/adminGate";
import {
  buildXDigestScheduleInfo,
  digestKindEnabled,
} from "@/lib/xLeaderboardDigestSchedule";

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

  const nowMs = Date.now();
  const digestMaster = flag(process.env.X_LEADERBOARD_DIGEST_ENABLED);
  const masterOn = digestMaster === true;
  const schedule = buildXDigestScheduleInfo(nowMs, {
    X_LEADERBOARD_DIGEST_UTC_HOUR: process.env.X_LEADERBOARD_DIGEST_UTC_HOUR,
    X_LEADERBOARD_WEEKLY_UTC_WEEKDAY: process.env.X_LEADERBOARD_WEEKLY_UTC_WEEKDAY,
  });

  const nowPacific = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(new Date(nowMs));

  return Response.json({
    success: true,
    nowUtc: new Date().toISOString(),
    nowPacific,
    x: {
      digestEnabled: digestMaster,
      dailyEnabled: flag(process.env.X_LEADERBOARD_DAILY_DIGEST_ENABLED),
      weeklyEnabled: flag(process.env.X_LEADERBOARD_WEEKLY_DIGEST_ENABLED),
      monthlyEnabled: flag(process.env.X_LEADERBOARD_MONTHLY_DIGEST_ENABLED),
      /** When master digest is on, unset per-kind vars count as on. */
      dailyEffective: masterOn && digestKindEnabled(process.env.X_LEADERBOARD_DAILY_DIGEST_ENABLED),
      weeklyEffective: masterOn && digestKindEnabled(process.env.X_LEADERBOARD_WEEKLY_DIGEST_ENABLED),
      monthlyEffective: masterOn && digestKindEnabled(process.env.X_LEADERBOARD_MONTHLY_DIGEST_ENABLED),
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
      cronSecretConfigured: Boolean(String(process.env.CRON_SECRET ?? "").trim()),
      schedule,
    },
  });
}

