import type { TrophyTimeframe } from "@/lib/awardTrophies";

/** Stored in `dashboard_admin_settings.x_leaderboard_digest_format` (jsonb). */
export type XLeaderboardDigestFormat = {
  headDaily: string;
  headWeekly: string;
  headMonthly: string;
  rowLine: string;
  rowSep: string;
};

export const DEFAULT_DIGEST_FORMAT: XLeaderboardDigestFormat = {
  headDaily: "📊 McGBot daily leaderboard ({dateUtc} UTC)",
  headWeekly: "📊 McGBot weekly leaderboard (week of {dateUtc} UTC)",
  headMonthly: "📊 McGBot monthly leaderboard ({dateUtc} UTC)",
  rowLine: "#{rank} {username} {avgX}x avg",
  rowSep: " · ",
};

const PACIFIC_TZ = "America/Los_Angeles";

function replacePlaceholders(template: string, vars: Record<string, string>): string {
  let out = template;
  for (const [k, v] of Object.entries(vars)) {
    out = out.split(`{${k}}`).join(v);
  }
  return out;
}

function formatDatePacific(periodStartMs: number): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: PACIFIC_TZ,
    dateStyle: "medium",
  }).format(new Date(periodStartMs));
}

/** Merge DB json (possibly null/partial) with built-in defaults. */
export function mergeDigestFormat(stored: unknown): XLeaderboardDigestFormat {
  const base: XLeaderboardDigestFormat = { ...DEFAULT_DIGEST_FORMAT };
  if (!stored || typeof stored !== "object") return base;
  const o = stored as Record<string, unknown>;
  for (const key of ["headDaily", "headWeekly", "headMonthly", "rowLine", "rowSep"] as const) {
    if (typeof o[key] === "string" && String(o[key]).trim()) {
      base[key] = String(o[key]).trim().slice(0, 500);
    }
  }
  return base;
}

export function formatDigestTweet(
  kind: TrophyTimeframe,
  periodStartMs: number,
  rows: { rank: number; username: string; avgX: number }[],
  format: XLeaderboardDigestFormat | null | undefined,
  siteBaseUrl: string
): string {
  const f = format == null ? DEFAULT_DIGEST_FORMAT : format;
  const y = new Date(periodStartMs);
  const dateUtc = `${y.getUTCFullYear()}-${String(y.getUTCMonth() + 1).padStart(2, "0")}-${String(y.getUTCDate()).padStart(2, "0")}`;
  const datePacific = formatDatePacific(periodStartMs);

  const headTpl =
    kind === "daily" ? f.headDaily : kind === "weekly" ? f.headWeekly : f.headMonthly;
  const head = replacePlaceholders(headTpl, { dateUtc, datePacific });

  const rowSep = f.rowSep || DEFAULT_DIGEST_FORMAT.rowSep;
  const body = rows
    .map((r) =>
      replacePlaceholders(f.rowLine || DEFAULT_DIGEST_FORMAT.rowLine, {
        rank: String(r.rank),
        username: r.username.replace(/\s+/g, " ").slice(0, 18),
        avgX: r.avgX.toFixed(1),
      })
    )
    .join(rowSep);

  const base = siteBaseUrl.replace(/\/+$/, "");
  const tail = base ? `\n${base}/leaderboard` : "";
  return `${head}\n${body}${tail}`.slice(0, 280);
}
