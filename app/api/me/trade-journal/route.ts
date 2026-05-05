import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function normalizeMint(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const s = raw.trim();
  if (!s) return null;
  if (s.length < 20 || s.length > 60) return null;
  if (!/^[1-9A-HJ-NP-Za-km-z]+$/.test(s)) return null;
  return s;
}

function clampStr(raw: unknown, max: number): string | null {
  if (raw == null) return null;
  if (typeof raw !== "string") return null;
  const t = raw.trim();
  if (!t) return null;
  return t.slice(0, max);
}

function normalizeLinks(raw: unknown): string[] {
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
    if (typeof v !== "string") continue;
    const u = v.trim().slice(0, 500);
    if (!u) continue;
    try {
      const parsed = new URL(u);
      if (parsed.protocol !== "https:" && parsed.protocol !== "http:") continue;
    } catch {
      continue;
    }
    if (!out.includes(u)) out.push(u);
    if (out.length >= 10) break;
  }
  return out;
}

function optNum(raw: unknown): number | null {
  if (raw == null || raw === "") return null;
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n)) return null;
  return n;
}

function optIso(raw: unknown): string | null {
  const s = clampStr(raw, 40);
  if (!s) return null;
  const t = Date.parse(s);
  if (!Number.isFinite(t)) return null;
  return new Date(t).toISOString();
}

function normalizeStatus(raw: unknown): "open" | "closed" | null {
  if (raw === "open" || raw === "closed") return raw;
  return null;
}

function rowToApi(o: Record<string, unknown>) {
  return {
    id: String(o.id ?? ""),
    mint: String(o.mint ?? ""),
    tokenSymbol: typeof o.token_symbol === "string" ? o.token_symbol : null,
    tokenName: typeof o.token_name === "string" ? o.token_name : null,
    tradedAt: typeof o.traded_at === "string" ? o.traded_at : null,
    closedAt: typeof o.closed_at === "string" ? o.closed_at : null,
    status: o.status === "closed" ? "closed" : "open",
    setupLabel: typeof o.setup_label === "string" ? o.setup_label : null,
    thesis: typeof o.thesis === "string" ? o.thesis : null,
    plannedInvalidation:
      typeof o.planned_invalidation === "string" ? o.planned_invalidation : null,
    entryPriceUsd: o.entry_price_usd != null ? Number(o.entry_price_usd) : null,
    exitPriceUsd: o.exit_price_usd != null ? Number(o.exit_price_usd) : null,
    sizeUsd: o.size_usd != null ? Number(o.size_usd) : null,
    pnlUsd: o.pnl_usd != null ? Number(o.pnl_usd) : null,
    pnlPct: o.pnl_pct != null ? Number(o.pnl_pct) : null,
    notes: typeof o.notes === "string" ? o.notes : null,
    referenceLinks: Array.isArray(o.reference_links)
      ? (o.reference_links as unknown[]).filter((x): x is string => typeof x === "string")
      : [],
    sourceTxSignature:
      typeof o.source_tx_signature === "string" ? o.source_tx_signature : null,
    createdAt: typeof o.created_at === "string" ? o.created_at : null,
    updatedAt: typeof o.updated_at === "string" ? o.updated_at : null,
  };
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const discordId = session?.user?.id?.trim() ?? "";
    if (!discordId) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const db = getSupabaseAdmin();
    if (!db) return Response.json({ error: "Database not configured" }, { status: 503 });

    const { data, error } = await db
      .from("trade_journal_entries")
      .select("*")
      .eq("discord_id", discordId)
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) {
      console.error("[me/trade-journal] GET:", error);
      return Response.json({ error: "Could not load entries" }, { status: 500 });
    }

    const rows = (Array.isArray(data) ? data : []) as Record<string, unknown>[];
    return Response.json({
      success: true as const,
      entries: rows.map(rowToApi),
    });
  } catch (e) {
    console.error("[me/trade-journal] GET exception:", e);
    return Response.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    const discordId = session?.user?.id?.trim() ?? "";
    if (!discordId) return Response.json({ error: "Unauthorized" }, { status: 401 });

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "Invalid JSON" }, { status: 400 });
    }
    const o = body && typeof body === "object" ? (body as Record<string, unknown>) : {};

    const mint = normalizeMint(o.mint);
    if (!mint) return Response.json({ error: "Invalid mint" }, { status: 400 });

    const status = normalizeStatus(o.status) ?? "open";
    const referenceLinks = normalizeLinks(o.referenceLinks ?? o.reference_links);

    const insert = {
      discord_id: discordId,
      mint,
      token_symbol: clampStr(o.tokenSymbol ?? o.token_symbol, 32),
      token_name: clampStr(o.tokenName ?? o.token_name, 120),
      traded_at: optIso(o.tradedAt ?? o.traded_at),
      closed_at: optIso(o.closedAt ?? o.closed_at),
      status,
      setup_label: clampStr(o.setupLabel ?? o.setup_label, 120),
      thesis: clampStr(o.thesis, 4000),
      planned_invalidation: clampStr(
        o.plannedInvalidation ?? o.planned_invalidation,
        2000
      ),
      entry_price_usd: optNum(o.entryPriceUsd ?? o.entry_price_usd),
      exit_price_usd: optNum(o.exitPriceUsd ?? o.exit_price_usd),
      size_usd: optNum(o.sizeUsd ?? o.size_usd),
      pnl_usd: optNum(o.pnlUsd ?? o.pnl_usd),
      pnl_pct: optNum(o.pnlPct ?? o.pnl_pct),
      notes: clampStr(o.notes, 8000),
      reference_links: referenceLinks,
      source_tx_signature: clampStr(
        o.sourceTxSignature ?? o.source_tx_signature,
        128
      ),
    };

    const db = getSupabaseAdmin();
    if (!db) return Response.json({ error: "Database not configured" }, { status: 503 });

    const { data, error } = await db
      .from("trade_journal_entries")
      .insert(insert)
      .select("*")
      .single();

    if (error || !data) {
      console.error("[me/trade-journal] POST:", error);
      return Response.json({ error: "Could not save entry" }, { status: 500 });
    }

    return Response.json({ success: true as const, entry: rowToApi(data as Record<string, unknown>) });
  } catch (e) {
    console.error("[me/trade-journal] POST exception:", e);
    return Response.json({ error: "Internal error" }, { status: 500 });
  }
}
