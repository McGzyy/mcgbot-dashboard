import type { SupabaseClient } from "@supabase/supabase-js";
import {
  aggregateCallPerformanceRows,
  fetchCallPerformanceForSource,
  filterRowsByCallTimeWindow,
  rankTopN,
} from "@/lib/callPerformanceLeaderboard";
import { closedTrophyWindowUtcMs } from "@/lib/leaderboardTimeWindows";
import { getStatsCutoverUtcMs, mergeStatsCutoverIntoMin } from "@/lib/statsCutover";
import { grantTopCallerDiscordRole } from "@/lib/discordHonorRoles";
import { fetchDiscordIdsExcludedFromLeaderboards } from "@/lib/guildMembershipSync";
import { TOP_CALLER_BADGE_KEY } from "@/lib/topCallerBadgeDisplay";

export type AwardMonthlyTopCallerResult = {
  periodStartMs: number;
  winnerId: string | null;
  /** True when this run applied a new monthly award (not a duplicate cron). */
  awarded: boolean;
  /** New total times_awarded for the winner after this run (null if none). */
  timesAwarded: number | null;
  error: Error | null;
};

/**
 * Awards **#1 monthly leaderboard** (same closed calendar month + `call_time`
 * window as trophies) with the `top_caller` badge. Repeats increment
 * `user_badges.times_awarded`. Idempotent per month via `monthly_top_caller_awards`.
 */
export async function awardMonthlyTopCallerBadge(
  supabase: SupabaseClient,
  options?: { nowMs?: number; source?: string }
): Promise<AwardMonthlyTopCallerResult> {
  const nowMs = options?.nowMs ?? Date.now();
  const source = options?.source ?? "user";
  const window = closedTrophyWindowUtcMs("monthly", nowMs);
  if (!window) {
    return {
      periodStartMs: 0,
      winnerId: null,
      awarded: false,
      timesAwarded: null,
      error: new Error("Could not resolve monthly window"),
    };
  }
  const { periodStartMs, endMsExclusive } = window;

  const [{ rows, error: fetchErr }, cutoverMs, excludedDiscordIds] = await Promise.all([
    fetchCallPerformanceForSource(supabase, source),
    getStatsCutoverUtcMs(),
    fetchDiscordIdsExcludedFromLeaderboards(),
  ]);
  if (fetchErr) {
    return {
      periodStartMs,
      winnerId: null,
      awarded: false,
      timesAwarded: null,
      error: fetchErr,
    };
  }

  const minMs = mergeStatsCutoverIntoMin(periodStartMs, cutoverMs);
  const filtered = filterRowsByCallTimeWindow(rows, minMs, endMsExclusive);
  const aggregated = aggregateCallPerformanceRows(filtered, excludedDiscordIds);
  const top1 = rankTopN(aggregated, 1);
  const winnerId = top1[0]?.discordId?.trim() || null;

  if (!winnerId) {
    return { periodStartMs, winnerId: null, awarded: false, timesAwarded: null, error: null };
  }

  const { error: insPeriodErr } = await supabase.from("monthly_top_caller_awards").insert({
    period_start_ms: periodStartMs,
    user_id: winnerId,
  });

  if (insPeriodErr) {
    const code = (insPeriodErr as { code?: string }).code;
    const msg = insPeriodErr.message || "";
    if (code === "23505" || msg.toLowerCase().includes("duplicate")) {
      return {
        periodStartMs,
        winnerId,
        awarded: false,
        timesAwarded: null,
        error: null,
      };
    }
    return {
      periodStartMs,
      winnerId,
      awarded: false,
      timesAwarded: null,
      error: new Error(insPeriodErr.message),
    };
  }

  const { data: existing, error: readBadgeErr } = await supabase
    .from("user_badges")
    .select("times_awarded")
    .eq("user_id", winnerId)
    .eq("badge", TOP_CALLER_BADGE_KEY)
    .maybeSingle();

  if (readBadgeErr) {
    return {
      periodStartMs,
      winnerId,
      awarded: true,
      timesAwarded: null,
      error: new Error(readBadgeErr.message),
    };
  }

  const prev = Number((existing as { times_awarded?: unknown } | null)?.times_awarded);
  const prevSafe = Number.isFinite(prev) && prev >= 1 ? prev : 0;
  const nextTimes = prevSafe > 0 ? prevSafe + 1 : 1;

  if (prevSafe > 0) {
    const { error: upErr } = await supabase
      .from("user_badges")
      .update({ times_awarded: nextTimes })
      .eq("user_id", winnerId)
      .eq("badge", TOP_CALLER_BADGE_KEY);
    if (upErr) {
      return {
        periodStartMs,
        winnerId,
        awarded: true,
        timesAwarded: null,
        error: new Error(upErr.message),
      };
    }
  } else {
    const { error: insBadgeErr } = await supabase.from("user_badges").insert({
      user_id: winnerId,
      badge: TOP_CALLER_BADGE_KEY,
      times_awarded: 1,
    });
    if (insBadgeErr) {
      return {
        periodStartMs,
        winnerId,
        awarded: true,
        timesAwarded: null,
        error: new Error(insBadgeErr.message),
      };
    }
  }

  await supabase.from("users").update({ is_top_caller: true }).eq("discord_id", winnerId);

  await grantTopCallerDiscordRole(winnerId);

  return {
    periodStartMs,
    winnerId,
    awarded: true,
    timesAwarded: nextTimes,
    error: null,
  };
}
