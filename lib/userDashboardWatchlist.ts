import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";

import { parseSolanaContractAddressFromInput } from "@/lib/solanaCa";

export type WatchlistPayload = {
  private: string[];
  public: string[];
};

const MAX_ITEMS = 200;
const WATCHLIST_TABLE = "user_contract_watchlist";

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

export function normalizeWatchlistContractAddress(raw: unknown): string | null {
  return parseSolanaContractAddressFromInput(raw);
}

/** @deprecated Use {@link normalizeWatchlistContractAddress}. */
export const normalizeWatchlistMint = normalizeWatchlistContractAddress;

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
    const ca = normalizeWatchlistContractAddress(v);
    if (ca && !out.includes(ca)) out.push(ca);
  }
  return out.slice(0, MAX_ITEMS);
}

function isMissingWatchlistTableError(err: PostgrestError | null): boolean {
  if (!err) return false;
  const msg = `${err.message ?? ""} ${err.details ?? ""} ${err.hint ?? ""}`.toLowerCase();
  return (
    err.code === "42P01" ||
    err.code === "PGRST205" ||
    msg.includes("user_contract_watchlist") ||
    msg.includes("does not exist")
  );
}

function isMissingJsonColumnError(err: PostgrestError | null): boolean {
  if (!err) return false;
  const msg = `${err.message ?? ""} ${err.details ?? ""}`.toLowerCase();
  return (
    err.code === "42703" ||
    err.code === "PGRST204" ||
    msg.includes("private_watchlist") ||
    msg.includes("public_dashboard_watchlist")
  );
}

export function watchlistErrorMessage(err: PostgrestError | null): string {
  if (!err) return "Failed to save watchlist";
  if (isMissingWatchlistTableError(err) || isMissingJsonColumnError(err)) {
    return "Watchlist storage is not set up in Supabase. Run the latest migrations (user_contract_watchlist or user_dashboard_settings watchlist columns).";
  }
  const msg = (err.message ?? "").trim();
  if (/permission denied|row-level security|rls/i.test(msg)) {
    return "Watchlist save blocked by database permissions. Check SUPABASE_SERVICE_ROLE_KEY on the dashboard host.";
  }
  if (msg) return msg.length > 180 ? `${msg.slice(0, 177)}…` : msg;
  return "Failed to save watchlist";
}

async function loadFromWatchlistTable(
  supabase: SupabaseClient,
  discordId: string
): Promise<{ payload: WatchlistPayload; error: PostgrestError | null }> {
  const { data, error } = await supabase
    .from(WATCHLIST_TABLE)
    .select("contract_address, scope, created_at")
    .eq("discord_id", discordId)
    .order("created_at", { ascending: false })
    .limit(MAX_ITEMS * 2);

  if (error) {
    return { payload: { private: [], public: [] }, error };
  }

  const priv: string[] = [];
  const pub: string[] = [];
  for (const row of data ?? []) {
    const ca = normalizeWatchlistContractAddress(
      (row as { contract_address?: unknown }).contract_address
    );
    if (!ca) continue;
    const scope = String((row as { scope?: unknown }).scope ?? "").trim();
    if (scope === "private") {
      if (!priv.includes(ca)) priv.push(ca);
    } else if (scope === "public") {
      if (!pub.includes(ca)) pub.push(ca);
    }
  }

  return {
    payload: {
      private: priv.slice(0, MAX_ITEMS),
      public: pub.slice(0, MAX_ITEMS),
    },
    error: null,
  };
}

async function loadFromSettingsJson(
  supabase: SupabaseClient,
  discordId: string
): Promise<{
  payload: WatchlistPayload;
  row: Record<string, unknown> | null;
  error: PostgrestError | null;
}> {
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
      error,
    };
  }

  const row = (rows?.[0] ?? null) as Record<string, unknown> | null;
  return {
    payload: {
      private: normalizeWatchlist(row?.private_watchlist),
      public: normalizeWatchlist(row?.public_dashboard_watchlist),
    },
    row,
    error: null,
  };
}

export async function loadUserWatchlist(
  supabase: SupabaseClient,
  discordId: string
): Promise<{
  payload: WatchlistPayload;
  row: Record<string, unknown> | null;
  readError: PostgrestError | null;
  storage: "table" | "json" | null;
}> {
  const tableLoad = await loadFromWatchlistTable(supabase, discordId);
  if (!tableLoad.error) {
    const { row } = await loadFromSettingsJson(supabase, discordId);
    return {
      payload: tableLoad.payload,
      row,
      readError: null,
      storage: "table",
    };
  }

  if (!isMissingWatchlistTableError(tableLoad.error)) {
    console.warn("[watchlist] table read failed, trying JSON fallback:", tableLoad.error.message);
  }

  const jsonLoad = await loadFromSettingsJson(supabase, discordId);
  return {
    payload: jsonLoad.payload,
    row: jsonLoad.row,
    readError: jsonLoad.error,
    storage: jsonLoad.error ? null : "json",
  };
}

async function saveToWatchlistTable(
  supabase: SupabaseClient,
  discordId: string,
  payload: WatchlistPayload
): Promise<{ error: PostgrestError | null }> {
  const { error: delErr } = await supabase
    .from(WATCHLIST_TABLE)
    .delete()
    .eq("discord_id", discordId);

  if (delErr) return { error: delErr };

  const rows = [
    ...payload.private.map((contract_address) => ({
      discord_id: discordId,
      contract_address,
      scope: "private" as const,
    })),
    ...payload.public.map((contract_address) => ({
      discord_id: discordId,
      contract_address,
      scope: "public" as const,
    })),
  ];

  if (rows.length === 0) return { error: null };

  const { error: insErr } = await supabase.from(WATCHLIST_TABLE).insert(rows);
  return { error: insErr };
}

async function saveToSettingsJson(
  supabase: SupabaseClient,
  discordId: string,
  payload: WatchlistPayload,
  existingRow: Record<string, unknown> | null
): Promise<{ error: PostgrestError | null }> {
  const widgets =
    existingRow?.widgets_enabled && typeof existingRow.widgets_enabled === "object"
      ? existingRow.widgets_enabled
      : DEFAULT_WIDGETS;

  const alertPrefs =
    existingRow?.alert_prefs && typeof existingRow.alert_prefs === "object"
      ? existingRow.alert_prefs
      : {};

  if (existingRow) {
    const { error } = await supabase
      .from("user_dashboard_settings")
      .update({
        private_watchlist: payload.private,
        public_dashboard_watchlist: payload.public,
      })
      .eq("discord_id", discordId);

    if (!error) return { error: null };

    if (!isMissingJsonColumnError(error)) {
      return { error };
    }
  }

  const { error: insertErr } = await supabase.from("user_dashboard_settings").insert({
    discord_id: discordId,
    widgets_enabled: widgets,
    alert_prefs: alertPrefs,
    private_watchlist: payload.private,
    public_dashboard_watchlist: payload.public,
  });

  if (insertErr && insertErr.code === "23505") {
    const { error: updateErr } = await supabase
      .from("user_dashboard_settings")
      .update({
        private_watchlist: payload.private,
        public_dashboard_watchlist: payload.public,
      })
      .eq("discord_id", discordId);
    return { error: updateErr };
  }

  return { error: insertErr };
}

export async function saveUserWatchlist(
  supabase: SupabaseClient,
  discordId: string,
  payload: WatchlistPayload,
  existingRow: Record<string, unknown> | null
): Promise<{ error: PostgrestError | null }> {
  const tableSave = await saveToWatchlistTable(supabase, discordId, payload);
  if (!tableSave.error) {
    return { error: null };
  }

  if (!isMissingWatchlistTableError(tableSave.error)) {
    return { error: tableSave.error };
  }

  return saveToSettingsJson(supabase, discordId, payload, existingRow);
}
