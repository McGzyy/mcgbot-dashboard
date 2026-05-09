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
  entry_mcap_usd: number | null;
  exit_mcap_usd: number | null;
  exit_mcaps_note: string | null;
  profit_usd: number | null;
  profit_pct: number | null;
  thesis: string | null;
  narrative: string | null;
  entry_justification: string | null;
  planned_invalidation: string | null;
  lessons_learned: string | null;
  token_symbol: string | null;
  token_name: string | null;
  timeframe: string | null;
  position_size_usd: number | null;
  entry_price_usd: number | null;
  exit_price_usd: number | null;
  created_at: string;
  updated_at: string;
};

function numOrNull(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function strOrNull(v: unknown, max: number): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  if (!s) return null;
  return s.slice(0, max);
}

function textOrNull(v: unknown, max: number): string | null {
  if (v == null) return null;
  const s = String(v);
  if (!s.trim()) return null;
  return s.slice(0, max);
}

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
    entry_mcap_usd: numOrNull(raw.entry_mcap_usd),
    exit_mcap_usd: numOrNull(raw.exit_mcap_usd),
    exit_mcaps_note: textOrNull(raw.exit_mcaps_note, 8000),
    profit_usd: numOrNull(raw.profit_usd),
    profit_pct: numOrNull(raw.profit_pct),
    thesis: textOrNull(raw.thesis, 8000),
    narrative: textOrNull(raw.narrative, 12000),
    entry_justification: textOrNull(raw.entry_justification, 8000),
    planned_invalidation: textOrNull(raw.planned_invalidation, 4000),
    lessons_learned: textOrNull(raw.lessons_learned, 8000),
    token_symbol: strOrNull(raw.token_symbol, 64),
    token_name: strOrNull(raw.token_name, 200),
    timeframe: strOrNull(raw.timeframe, 64),
    position_size_usd: numOrNull(raw.position_size_usd),
    entry_price_usd: numOrNull(raw.entry_price_usd),
    exit_price_usd: numOrNull(raw.exit_price_usd),
    created_at: String(raw.created_at ?? ""),
    updated_at: String(raw.updated_at ?? ""),
  };
}

export type TradeJournalWritePayload = {
  title: string;
  notes?: string;
  mint?: string | null;
  tags?: string[];
  status?: TradeJournalStatus;
  hasEdge?: boolean;
  entryMcapUsd?: number | null;
  exitMcapUsd?: number | null;
  exitMcapsNote?: string | null;
  profitUsd?: number | null;
  profitPct?: number | null;
  thesis?: string | null;
  narrative?: string | null;
  entryJustification?: string | null;
  plannedInvalidation?: string | null;
  lessonsLearned?: string | null;
  tokenSymbol?: string | null;
  tokenName?: string | null;
  timeframe?: string | null;
  positionSizeUsd?: number | null;
  entryPriceUsd?: number | null;
  exitPriceUsd?: number | null;
};

function buildInsertPatch(p: TradeJournalWritePayload, now: string): Record<string, unknown> {
  return {
    title: p.title.trim().slice(0, 500),
    notes: String(p.notes ?? "").slice(0, 20000),
    mint: p.mint?.trim() || null,
    tags: Array.isArray(p.tags) ? p.tags.map((t) => String(t).trim()).filter(Boolean).slice(0, 24) : [],
    status: p.status === "closed" ? "closed" : "open",
    has_edge: Boolean(p.hasEdge),
    entry_mcap_usd: p.entryMcapUsd ?? null,
    exit_mcap_usd: p.exitMcapUsd ?? null,
    exit_mcaps_note:
      p.exitMcapsNote != null && String(p.exitMcapsNote).trim() ? String(p.exitMcapsNote).slice(0, 8000) : null,
    profit_usd: p.profitUsd ?? null,
    profit_pct: p.profitPct ?? null,
    thesis: p.thesis != null && String(p.thesis).trim() ? String(p.thesis).slice(0, 8000) : null,
    narrative: p.narrative != null && String(p.narrative).trim() ? String(p.narrative).slice(0, 12000) : null,
    entry_justification:
      p.entryJustification != null && String(p.entryJustification).trim()
        ? String(p.entryJustification).slice(0, 8000)
        : null,
    planned_invalidation:
      p.plannedInvalidation != null && String(p.plannedInvalidation).trim()
        ? String(p.plannedInvalidation).slice(0, 4000)
        : null,
    lessons_learned:
      p.lessonsLearned != null && String(p.lessonsLearned).trim() ? String(p.lessonsLearned).slice(0, 8000) : null,
    token_symbol: p.tokenSymbol != null ? String(p.tokenSymbol).trim().slice(0, 64) || null : null,
    token_name: p.tokenName != null ? String(p.tokenName).trim().slice(0, 200) || null : null,
    timeframe: p.timeframe != null ? String(p.timeframe).trim().slice(0, 64) || null : null,
    position_size_usd: p.positionSizeUsd ?? null,
    entry_price_usd: p.entryPriceUsd ?? null,
    exit_price_usd: p.exitPriceUsd ?? null,
    created_at: now,
    updated_at: now,
  };
}

function applyUpdatePatch(patch: Record<string, unknown>, p: Partial<TradeJournalWritePayload>) {
  if (p.title !== undefined) patch.title = String(p.title).trim().slice(0, 500);
  if (p.notes !== undefined) patch.notes = String(p.notes).slice(0, 20000);
  if (p.mint !== undefined) patch.mint = p.mint?.trim() || null;
  if (p.tags !== undefined) {
    patch.tags = Array.isArray(p.tags) ? p.tags.map((t) => String(t).trim()).filter(Boolean).slice(0, 24) : [];
  }
  if (p.status !== undefined) patch.status = p.status === "closed" ? "closed" : "open";
  if (p.hasEdge !== undefined) patch.has_edge = Boolean(p.hasEdge);
  if (p.entryMcapUsd !== undefined) patch.entry_mcap_usd = p.entryMcapUsd;
  if (p.exitMcapUsd !== undefined) patch.exit_mcap_usd = p.exitMcapUsd;
  if (p.exitMcapsNote !== undefined) {
    patch.exit_mcaps_note =
      p.exitMcapsNote != null && String(p.exitMcapsNote).trim() ? String(p.exitMcapsNote).slice(0, 8000) : null;
  }
  if (p.profitUsd !== undefined) patch.profit_usd = p.profitUsd;
  if (p.profitPct !== undefined) patch.profit_pct = p.profitPct;
  if (p.thesis !== undefined) {
    patch.thesis = p.thesis != null && String(p.thesis).trim() ? String(p.thesis).slice(0, 8000) : null;
  }
  if (p.narrative !== undefined) {
    patch.narrative = p.narrative != null && String(p.narrative).trim() ? String(p.narrative).slice(0, 12000) : null;
  }
  if (p.entryJustification !== undefined) {
    patch.entry_justification =
      p.entryJustification != null && String(p.entryJustification).trim()
        ? String(p.entryJustification).slice(0, 8000)
        : null;
  }
  if (p.plannedInvalidation !== undefined) {
    patch.planned_invalidation =
      p.plannedInvalidation != null && String(p.plannedInvalidation).trim()
        ? String(p.plannedInvalidation).slice(0, 4000)
        : null;
  }
  if (p.lessonsLearned !== undefined) {
    patch.lessons_learned =
      p.lessonsLearned != null && String(p.lessonsLearned).trim() ? String(p.lessonsLearned).slice(0, 8000) : null;
  }
  if (p.tokenSymbol !== undefined) patch.token_symbol = p.tokenSymbol != null ? String(p.tokenSymbol).trim().slice(0, 64) || null : null;
  if (p.tokenName !== undefined) patch.token_name = p.tokenName != null ? String(p.tokenName).trim().slice(0, 200) || null : null;
  if (p.timeframe !== undefined) patch.timeframe = p.timeframe != null ? String(p.timeframe).trim().slice(0, 64) || null : null;
  if (p.positionSizeUsd !== undefined) patch.position_size_usd = p.positionSizeUsd;
  if (p.entryPriceUsd !== undefined) patch.entry_price_usd = p.entryPriceUsd;
  if (p.exitPriceUsd !== undefined) patch.exit_price_usd = p.exitPriceUsd;
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

export async function insertTradeJournalEntry(
  params: { discordUserId: string } & TradeJournalWritePayload
): Promise<{ ok: true; row: TradeJournalRow } | { ok: false; error: string }> {
  const db = getSupabaseAdmin();
  if (!db) return { ok: false, error: "Database not configured." };
  const uid = params.discordUserId.trim();
  if (!uid) return { ok: false, error: "Missing user." };

  const now = new Date().toISOString();
  const row = {
    discord_user_id: uid,
    ...buildInsertPatch(params, now),
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
} & Partial<TradeJournalWritePayload>): Promise<{ ok: true; row: TradeJournalRow } | { ok: false; error: string }> {
  const db = getSupabaseAdmin();
  if (!db) return { ok: false, error: "Database not configured." };
  const uid = params.discordUserId.trim();
  const id = params.id.trim();
  if (!uid || !id) return { ok: false, error: "Missing id or user." };

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  const {
    discordUserId: _d,
    id: _i,
    ...rest
  } = params as { discordUserId: string; id: string } & Partial<TradeJournalWritePayload>;
  applyUpdatePatch(patch, rest);

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

/** Parse JSON number fields from dashboard API (accepts strings with commas). */
export function parseOptionalNumberInput(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const s = String(v).trim().replace(/,/g, "");
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export function tradeJournalPayloadFromBody(body: Record<string, unknown> | null): TradeJournalWritePayload | null {
  if (!body || typeof body !== "object") return null;
  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!title) return null;
  return {
    title,
    notes: typeof body.notes === "string" ? body.notes : "",
    mint: body.mint != null && body.mint !== "" ? String(body.mint) : null,
    tags: Array.isArray(body.tags) ? body.tags.filter((t): t is string => typeof t === "string") : [],
    status: body.status === "closed" ? "closed" : "open",
    hasEdge: Boolean(body.hasEdge),
    entryMcapUsd: parseOptionalNumberInput(body.entryMcapUsd),
    exitMcapUsd: parseOptionalNumberInput(body.exitMcapUsd),
    exitMcapsNote: typeof body.exitMcapsNote === "string" ? body.exitMcapsNote : null,
    profitUsd: parseOptionalNumberInput(body.profitUsd),
    profitPct: parseOptionalNumberInput(body.profitPct),
    thesis: typeof body.thesis === "string" ? body.thesis : null,
    narrative: typeof body.narrative === "string" ? body.narrative : null,
    entryJustification: typeof body.entryJustification === "string" ? body.entryJustification : null,
    plannedInvalidation: typeof body.plannedInvalidation === "string" ? body.plannedInvalidation : null,
    lessonsLearned: typeof body.lessonsLearned === "string" ? body.lessonsLearned : null,
    tokenSymbol: typeof body.tokenSymbol === "string" ? body.tokenSymbol : null,
    tokenName: typeof body.tokenName === "string" ? body.tokenName : null,
    timeframe: typeof body.timeframe === "string" ? body.timeframe : null,
    positionSizeUsd: parseOptionalNumberInput(body.positionSizeUsd),
    entryPriceUsd: parseOptionalNumberInput(body.entryPriceUsd),
    exitPriceUsd: parseOptionalNumberInput(body.exitPriceUsd),
  };
}

export function tradeJournalPatchFromBody(body: Record<string, unknown> | null): Partial<TradeJournalWritePayload> | null {
  if (!body || typeof body !== "object") return null;
  const out: Partial<TradeJournalWritePayload> = {};
  if (typeof body.title === "string") out.title = body.title.trim();
  if (typeof body.notes === "string") out.notes = body.notes;
  if (body.mint !== undefined) out.mint = typeof body.mint === "string" ? body.mint : null;
  if (Array.isArray(body.tags)) out.tags = body.tags.filter((t): t is string => typeof t === "string");
  if (body.status === "open" || body.status === "closed") out.status = body.status;
  if ("hasEdge" in body && typeof body.hasEdge === "boolean") out.hasEdge = body.hasEdge;
  if ("entryMcapUsd" in body) out.entryMcapUsd = parseOptionalNumberInput(body.entryMcapUsd);
  if ("exitMcapUsd" in body) out.exitMcapUsd = parseOptionalNumberInput(body.exitMcapUsd);
  if ("exitMcapsNote" in body) out.exitMcapsNote = typeof body.exitMcapsNote === "string" ? body.exitMcapsNote : null;
  if ("profitUsd" in body) out.profitUsd = parseOptionalNumberInput(body.profitUsd);
  if ("profitPct" in body) out.profitPct = parseOptionalNumberInput(body.profitPct);
  if ("thesis" in body) out.thesis = typeof body.thesis === "string" ? body.thesis : null;
  if ("narrative" in body) out.narrative = typeof body.narrative === "string" ? body.narrative : null;
  if ("entryJustification" in body) out.entryJustification = typeof body.entryJustification === "string" ? body.entryJustification : null;
  if ("plannedInvalidation" in body) out.plannedInvalidation = typeof body.plannedInvalidation === "string" ? body.plannedInvalidation : null;
  if ("lessonsLearned" in body) out.lessonsLearned = typeof body.lessonsLearned === "string" ? body.lessonsLearned : null;
  if ("tokenSymbol" in body) out.tokenSymbol = typeof body.tokenSymbol === "string" ? body.tokenSymbol : null;
  if ("tokenName" in body) out.tokenName = typeof body.tokenName === "string" ? body.tokenName : null;
  if ("timeframe" in body) out.timeframe = typeof body.timeframe === "string" ? body.timeframe : null;
  if ("positionSizeUsd" in body) out.positionSizeUsd = parseOptionalNumberInput(body.positionSizeUsd);
  if ("entryPriceUsd" in body) out.entryPriceUsd = parseOptionalNumberInput(body.entryPriceUsd);
  if ("exitPriceUsd" in body) out.exitPriceUsd = parseOptionalNumberInput(body.exitPriceUsd);
  return out;
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
