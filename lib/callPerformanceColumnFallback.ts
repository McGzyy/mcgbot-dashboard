import type { PostgrestError } from "@supabase/supabase-js";

export function isMissingColumnPostgrestError(
  error: PostgrestError | null | undefined
): boolean {
  if (!error) return false;
  const m = `${error.message ?? ""} ${(error as { details?: string }).details ?? ""}`;
  return /column|does not exist|Could not find the .+ column/i.test(m);
}

/** Core columns present before token snapshot migrations. */
export const CP_PROFILE_LEGACY =
  "id, username, call_ca, ath_multiple, call_time, excluded_from_stats";

export const CP_PROFILE_WITH_SNAPSHOT = `${CP_PROFILE_LEGACY}, token_name, token_ticker, call_market_cap_usd, token_image_url`;

export const CP_RECENT_LEGACY =
  "id, call_ca, ath_multiple, call_time, excluded_from_stats";

export const CP_RECENT_WITH_SNAPSHOT = `${CP_RECENT_LEGACY}, token_name, token_ticker, call_market_cap_usd, token_image_url`;

export const CP_TAPE_LEGACY =
  "id, call_ca, ath_multiple, call_time, source, message_url, username, excluded_from_stats";

export const CP_TAPE_WITH_SNAPSHOT = `${CP_TAPE_LEGACY}, token_name, token_ticker, call_market_cap_usd, token_image_url`;

export const CP_ACTIVITY_LEGACY =
  "username, discord_id, ath_multiple, call_time, source, call_ca, message_url, excluded_from_stats";

export const CP_ACTIVITY_WITH_SNAPSHOT = `${CP_ACTIVITY_LEGACY}, token_name, token_ticker, call_market_cap_usd, token_image_url`;

export async function selectCallPerformanceWithSnapshotFallback(opts: {
  run: (columns: string) => Promise<{
    data: unknown;
    error: PostgrestError | null;
    count?: number | null;
  }>;
  columnsWithSnapshot: string;
  columnsLegacy: string;
}): Promise<{
  data: unknown;
  error: PostgrestError | null;
  count?: number | null;
}> {
  const first = await opts.run(opts.columnsWithSnapshot);
  if (!first.error) return first;
  if (!isMissingColumnPostgrestError(first.error)) return first;
  return opts.run(opts.columnsLegacy);
}
