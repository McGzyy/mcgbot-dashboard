import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export type TradeJournalStatus = "open" | "closed";

export type TradeJournalRow = {
  id: string;
  discord_user_id: string;
  title: string;
  notes: string;
  mint: string | null;
  tags: string[];
  status: TradeJournalStatus;
  has_edge: boolean;
  created_at: string;
  updated_at: string;
};

function mapRow(raw: Record<string, unknown>): TradeJournalRow | null {
  const id = typeof raw.id === "string" ? raw.id : "";
  if (!id) return null;
  const tags = Array.isArray(raw.tags) ? raw.tags.filter((t): t is string => typeof t === "string") : [];
  const status = raw.status === "closed" ? "closed" : "open";
  return {
    id,
    discord_user_id: String(raw.discord_user_id ?? ""),
    title: String(raw.title ?? ""),
    notes: String(raw.notes ?? ""),
    mint: raw.mint == null || raw.mint === "" ? null : String(raw.mint),
    tags,
    status,
    has_edge: raw.has_edge === true || raw.has_edge === 1 || String(raw.has_edge).toLowerCase() === "true",
    created_at: String(raw.created_at ?? ""),
    updated_at: String(raw.updated_at ?? ""),
  };
}

export async function listTradeJournalEntries(discordUserId: string): Promise<TradeJournalRow[]> {
  const db = getSupabaseAdmin();
  if (!db) return [];
  const uid = discordUserId.trim();
  if (!uid) return [];

  const { data, error } = await db
    .from("trade_journal_entries")
    .select("*")
    .eq("discord_user_id", uid)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[tradeJournalDb] list:", error);
    return [];
  }
  const out: TradeJournalRow[] = [];
  for (const r of data || []) {
    const row = mapRow(r as Record<string, unknown>);
    if (row) out.push(row);
  }
  return out;
}

export async function insertTradeJournalEntry(params: {
  discordUserId: string;
  title: string;
  notes?: string;
  mint?: string | null;
  tags?: string[];
  status?: TradeJournalStatus;
  hasEdge?: boolean;
}): Promise<{ ok: true; row: TradeJournalRow } | { ok: false; error: string }> {
  const db = getSupabaseAdmin();
  if (!db) return { ok: false, error: "Database not configured." };
  const uid = params.discordUserId.trim();
  if (!uid) return { ok: false, error: "Missing user." };

  const now = new Date().toISOString();
  const row = {
    discord_user_id: uid,
    title: params.title.trim().slice(0, 500),
    notes: String(params.notes ?? "").slice(0, 20000),
    mint: params.mint?.trim() || null,
    tags: Array.isArray(params.tags) ? params.tags.map((t) => String(t).trim()).filter(Boolean).slice(0, 24) : [],
    status: params.status === "closed" ? "closed" : "open",
    has_edge: Boolean(params.hasEdge),
    created_at: now,
    updated_at: now,
  };

  const { data, error } = await db.from("trade_journal_entries").insert(row).select("*").maybeSingle();
  if (error) {
    console.error("[tradeJournalDb] insert:", error);
    return { ok: false, error: error.message || "Insert failed." };
  }
  const mapped = data ? mapRow(data as Record<string, unknown>) : null;
  if (!mapped) return { ok: false, error: "Insert returned no row." };
  return { ok: true, row: mapped };
}

export async function updateTradeJournalEntry(params: {
  discordUserId: string;
  id: string;
  title?: string;
  notes?: string;
  mint?: string | null;
  tags?: string[];
  status?: TradeJournalStatus;
  hasEdge?: boolean;
}): Promise<{ ok: true; row: TradeJournalRow } | { ok: false; error: string }> {
  const db = getSupabaseAdmin();
  if (!db) return { ok: false, error: "Database not configured." };
  const uid = params.discordUserId.trim();
  const id = params.id.trim();
  if (!uid || !id) return { ok: false, error: "Missing id or user." };

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (params.title !== undefined) patch.title = String(params.title).trim().slice(0, 500);
  if (params.notes !== undefined) patch.notes = String(params.notes).slice(0, 20000);
  if (params.mint !== undefined) patch.mint = params.mint?.trim() || null;
  if (params.tags !== undefined) {
    patch.tags = Array.isArray(params.tags)
      ? params.tags.map((t) => String(t).trim()).filter(Boolean).slice(0, 24)
      : [];
  }
  if (params.status !== undefined) patch.status = params.status === "closed" ? "closed" : "open";
  if (params.hasEdge !== undefined) patch.has_edge = Boolean(params.hasEdge);

  const { data, error } = await db
    .from("trade_journal_entries")
    .update(patch)
    .eq("id", id)
    .eq("discord_user_id", uid)
    .select("*")
    .maybeSingle();

  if (error) {
    console.error("[tradeJournalDb] update:", error);
    return { ok: false, error: error.message || "Update failed." };
  }
  const mapped = data ? mapRow(data as Record<string, unknown>) : null;
  if (!mapped) return { ok: false, error: "Entry not found." };
  return { ok: true, row: mapped };
}

export async function deleteTradeJournalEntry(
  discordUserId: string,
  id: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const db = getSupabaseAdmin();
  if (!db) return { ok: false, error: "Database not configured." };
  const uid = discordUserId.trim();
  const eid = id.trim();
  if (!uid || !eid) return { ok: false, error: "Missing id or user." };

  const { data, error } = await db
    .from("trade_journal_entries")
    .delete()
    .eq("id", eid)
    .eq("discord_user_id", uid)
    .select("id");

  if (error) {
    console.error("[tradeJournalDb] delete:", error);
    return { ok: false, error: error.message || "Delete failed." };
  }
  if (!Array.isArray(data) || data.length === 0) {
    return { ok: false, error: "Entry not found." };
  }
  return { ok: true };
}
