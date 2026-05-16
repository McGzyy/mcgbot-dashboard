import type { SupabaseClient } from "@supabase/supabase-js";

import { parseSolanaMintFromInput } from "@/lib/solanaCa";

export type WatchlistPayload = {
  private: string[];
  public: string[];
};

const MAX_ITEMS = 200;

const DEFAULT_WIDGETS = {
  market: true,
  live_tracked_calls: true,
  top_performers: true,
  rank: true,
  activity: true,
  trending: true,
  notes: false,
  recent_calls: true,
  referral_link: true,
  referrals: true,
  hot_now: true,
  quick_actions: true,
};

export function normalizeWatchlistMint(raw: unknown): string | null {
  return parseSolanaMintFromInput(raw);
}

export function normalizeWatchlist(raw: unknown): string[] {
  if (raw == null) return [];
  let arr: unknown = raw;
  if (typeof raw === "string") {
    const t = raw.trim();
    if (!t) return [];
    try {
      arr = JSON.parse(t) as unknown;
    } catch {
      return [];
    }
  }
  if (!Array.isArray(arr)) return [];
  const out: string[] = [];
  for (const v of arr) {
    const mint = normalizeWatchlistMint(v);
    if (mint && !out.includes(mint)) out.push(mint);
  }
  return out.slice(0, MAX_ITEMS);
}

export async function loadUserWatchlist(
  supabase: SupabaseClient,
  discordId: string
): Promise<{ payload: WatchlistPayload; row: Record<string, unknown> | null; readError: Error | null }> {
  const { data: rows, error } = await supabase
    .from("user_dashboard_settings")
    .select(
      "widgets_enabled, alert_prefs, private_watchlist, public_dashboard_watchlist"
    )
    .eq("discord_id", discordId)
    .limit(1);

  if (error) {
    return {
      payload: { private: [], public: [] },
      row: null,
      readError: error,
    };
  }

  const row = (rows?.[0] ?? null) as Record<string, unknown> | null;
  return {
    payload: {
      private: normalizeWatchlist(row?.private_watchlist),
      public: normalizeWatchlist(row?.public_dashboard_watchlist),
    },
    row,
    readError: null,
  };
}

export async function saveUserWatchlist(
  supabase: SupabaseClient,
  discordId: string,
  payload: WatchlistPayload,
  existingRow: Record<string, unknown> | null
): Promise<{ error: Error | null }> {
  const widgets =
    existingRow?.widgets_enabled && typeof existingRow.widgets_enabled === "object"
      ? existingRow.widgets_enabled
      : DEFAULT_WIDGETS;

  const alertPrefs =
    existingRow?.alert_prefs && typeof existingRow.alert_prefs === "object"
      ? existingRow.alert_prefs
      : {};

  const { error } = await supabase.from("user_dashboard_settings").upsert(
    {
      discord_id: discordId,
      widgets_enabled: widgets,
      alert_prefs: alertPrefs,
      private_watchlist: payload.private,
      public_dashboard_watchlist: payload.public,
    },
    { onConflict: "discord_id" }
  );

  return { error: error ?? null };
}
