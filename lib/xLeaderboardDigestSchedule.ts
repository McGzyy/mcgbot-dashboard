/** Optional per-kind digest toggles: unset = on (when master `X_LEADERBOARD_DIGEST_ENABLED` is on). */
export function digestKindEnabled(envVar: string | undefined): boolean {
  if (envVar == null || String(envVar).trim() === "") return true;
  const s = String(envVar).trim().toLowerCase();
  if (["0", "false", "no", "off"].includes(s)) return false;
  if (["1", "true", "yes", "on"].includes(s)) return true;
  return true;
}

export function effectiveDigestUtcHour(raw: string | undefined): number {
  if (raw == null || String(raw).trim() === "") return 15;
  const n = Number(raw);
  if (!Number.isFinite(n)) return 15;
  return Math.min(23, Math.max(0, Math.floor(n)));
}

/** `Date#getUTCDay()` convention: 0 = Sunday … 6 = Saturday. Default `1` = Monday. */
export function effectiveWeeklyUtcWeekday(raw: string | undefined): number {
  if (raw == null || String(raw).trim() === "") return 1;
  const n = Number(raw);
  if (!Number.isFinite(n)) return 1;
  return ((Math.floor(n) % 7) + 7) % 7;
}

/** Pacific display uses `America/Los_Angeles` (PST/PDT). Digest hour env is still UTC. */
const PACIFIC_TZ = "America/Los_Angeles";

function formatPacific(ms: number, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat("en-US", { timeZone: PACIFIC_TZ, ...options }).format(new Date(ms));
}

export type XDigestScheduleInfo = {
  vercelCronPath: string;
  vercelCronExpression: string;
  vercelCronDescription: string;
  digestUtcHour: number;
  digestWindowLabel: string;
  /** Same digest hour window, expressed in Pacific (Los Angeles). */
  digestWindowLabelPacific: string;
  nextDigestHourWindowStartIso: string;
  nextDigestHourWindowStartPacific: string;
  digestHourActiveNow: boolean;
  weeklyUtcWeekday: number;
  weeklyUtcWeekdayLabel: string;
  monthlyRunsOn: string;
  utcEnvReminder: string;
};

export function buildXDigestScheduleInfo(
  nowMs: number,
  env: { X_LEADERBOARD_DIGEST_UTC_HOUR?: string; X_LEADERBOARD_WEEKLY_UTC_WEEKDAY?: string }
): XDigestScheduleInfo {
  const digestHour = effectiveDigestUtcHour(env.X_LEADERBOARD_DIGEST_UTC_HOUR);
  const weeklyDow = effectiveWeeklyUtcWeekday(env.X_LEADERBOARD_WEEKLY_UTC_WEEKDAY);
  const names = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const z = new Date(nowMs);
  const h = z.getUTCHours();
  const startToday = Date.UTC(z.getUTCFullYear(), z.getUTCMonth(), z.getUTCDate(), digestHour, 0, 0);
  let nextDigestHourWindowStartIso: string;
  let digestHourActiveNow = false;
  if (h < digestHour) {
    nextDigestHourWindowStartIso = new Date(startToday).toISOString();
  } else if (h === digestHour) {
    nextDigestHourWindowStartIso = new Date(startToday).toISOString();
    digestHourActiveNow = true;
  } else {
    nextDigestHourWindowStartIso = new Date(
      Date.UTC(z.getUTCFullYear(), z.getUTCMonth(), z.getUTCDate() + 1, digestHour, 0, 0)
    ).toISOString();
  }

  const windowStartMs = Date.parse(nextDigestHourWindowStartIso);
  const windowEndMs = windowStartMs + 60 * 60 * 1000 - 1;
  const digestWindowLabelPacific = `${formatPacific(windowStartMs, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  })} → ${formatPacific(windowEndMs, {
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  })}`;

  return {
    vercelCronPath: "/api/cron/x-leaderboard-digest",
    vercelCronExpression: "0 * * * *",
    vercelCronDescription:
      "Vercel invokes this route every UTC hour at :00. The handler only posts tweets during the digest hour below.",
    digestUtcHour: digestHour,
    digestWindowLabel: `${String(digestHour).padStart(2, "0")}:00–${String(digestHour).padStart(2, "0")}:59 UTC`,
    digestWindowLabelPacific,
    nextDigestHourWindowStartIso,
    nextDigestHourWindowStartPacific: formatPacific(windowStartMs, {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
    }),
    digestHourActiveNow,
    weeklyUtcWeekday: weeklyDow,
    weeklyUtcWeekdayLabel: names[weeklyDow] ?? String(weeklyDow),
    monthlyRunsOn: "UTC day-of-month 1 (with daily/weekly rules inside the same digest hour)",
    utcEnvReminder:
      "Vercel still reads `X_LEADERBOARD_DIGEST_UTC_HOUR` as UTC (0–23). Pacific labels are for your local planning only.",
  };
}
