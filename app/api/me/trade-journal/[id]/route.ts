import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function clampStr(raw: unknown, max: number): string | null {
  if (raw == null) return null;
  if (typeof raw !== "string") return null;
  const t = raw.trim();
  if (!t) return null;
  return t.slice(0, max);
}

function normalizeMint(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const s = raw.trim();
  if (!s) return null;
  if (s.length < 20 || s.length > 60) return null;
  if (!/^[1-9A-HJ-NP-Za-km-z]+$/.test(s)) return null;
  return s;
}

function normalizeLinks(raw: unknown): string[] | undefined {
  if (raw === undefined) return undefined;
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

function optNum(raw: unknown): number | null | undefined {
  if (raw === undefined) return undefined;
  if (raw == null || raw === "") return null;
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n)) return null;
  return n;
}

function optIso(raw: unknown): string | null | undefined {
  if (raw === undefined) return undefined;
  if (raw == null) return null;
  if (typeof raw !== "string") return null;
  const s = raw.trim();
  if (!s) return null;
  const t = Date.parse(s);
  if (!Number.isFinite(t)) return null;
  return new Date(t).toISOString();
}

function normalizeHttpUrl(raw: unknown, max: number): string | null | undefined {
  if (raw === undefined) return undefined;
  if (raw == null) return null;
  if (typeof raw !== "string") return null;
  const s = raw.trim().slice(0, max);
  if (!s) return null;
  try {
    const u = new URL(s);
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    return u.toString().slice(0, max);
  } catch {
    return null;
  }
}

function normalizeStatus(raw: unknown): "open" | "closed" | undefined {
  if (raw === undefined) return undefined;
  if (raw === "open" || raw === "closed") return raw;
  return undefined;
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
    tokenImageUrl: typeof o.token_image_url === "string" ? o.token_image_url : null,
    createdAt: typeof o.created_at === "string" ? o.created_at : null,
    updatedAt: typeof o.updated_at === "string" ? o.updated_at : null,
  };
}

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: Ctx) {
  try {
    const session = await getServerSession(authOptions);
    const discordId = session?.user?.id?.trim() ?? "";
    if (!discordId) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { id: idRaw } = await context.params;
    const id = typeof idRaw === "string" ? idRaw.trim() : "";
    if (!id) return Response.json({ error: "Invalid id" }, { status: 400 });

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "Invalid JSON" }, { status: 400 });
    }
    const o = body && typeof body === "object" ? (body as Record<string, unknown>) : {};

    const patch: Record<string, unknown> = {};

    if ("mint" in o) {
      const m = normalizeMint(o.mint);
      if (!m) return Response.json({ error: "Invalid mint" }, { status: 400 });
      patch.mint = m;
    }
    if ("tokenSymbol" in o || "token_symbol" in o) {
      patch.token_symbol = clampStr(o.tokenSymbol ?? o.token_symbol, 32);
    }
    if ("tokenName" in o || "token_name" in o) {
      patch.token_name = clampStr(o.tokenName ?? o.token_name, 120);
    }
    if ("tradedAt" in o || "traded_at" in o) {
      patch.traded_at = optIso(o.tradedAt ?? o.traded_at);
    }
    if ("closedAt" in o || "closed_at" in o) {
      patch.closed_at = optIso(o.closedAt ?? o.closed_at);
    }
    const st = normalizeStatus(o.status);
    if (st !== undefined) patch.status = st;
    if ("setupLabel" in o || "setup_label" in o) {
      patch.setup_label = clampStr(o.setupLabel ?? o.setup_label, 120);
    }
    if ("thesis" in o) patch.thesis = clampStr(o.thesis, 4000);
    if ("plannedInvalidation" in o || "planned_invalidation" in o) {
      patch.planned_invalidation = clampStr(
        o.plannedInvalidation ?? o.planned_invalidation,
        2000
      );
    }
    if ("entryPriceUsd" in o || "entry_price_usd" in o) {
      patch.entry_price_usd = optNum(o.entryPriceUsd ?? o.entry_price_usd);
    }
    if ("exitPriceUsd" in o || "exit_price_usd" in o) {
      patch.exit_price_usd = optNum(o.exitPriceUsd ?? o.exit_price_usd);
    }
    if ("sizeUsd" in o || "size_usd" in o) {
      patch.size_usd = optNum(o.sizeUsd ?? o.size_usd);
    }
    if ("pnlUsd" in o || "pnl_usd" in o) {
      patch.pnl_usd = optNum(o.pnlUsd ?? o.pnl_usd);
    }
    if ("pnlPct" in o || "pnl_pct" in o) {
      patch.pnl_pct = optNum(o.pnlPct ?? o.pnl_pct);
    }
    if ("notes" in o) patch.notes = clampStr(o.notes, 8000);
    if ("referenceLinks" in o || "reference_links" in o) {
      const links = normalizeLinks(o.referenceLinks ?? o.reference_links);
      if (links !== undefined) patch.reference_links = links;
    }
    if ("sourceTxSignature" in o || "source_tx_signature" in o) {
      patch.source_tx_signature = clampStr(
        o.sourceTxSignature ?? o.source_tx_signature,
        128
      );
    }
    if ("tokenImageUrl" in o || "token_image_url" in o) {
      patch.token_image_url = normalizeHttpUrl(o.tokenImageUrl ?? o.token_image_url, 800);
    }

    patch.updated_at = new Date().toISOString();

    if (Object.keys(patch).length <= 1) {
      return Response.json({ error: "No fields to update" }, { status: 400 });
    }

    const db = getSupabaseAdmin();
    if (!db) return Response.json({ error: "Database not configured" }, { status: 503 });

    const { data, error } = await db
      .from("trade_journal_entries")
      .update(patch)
      .eq("id", id)
      .eq("discord_id", discordId)
      .select("*")
      .maybeSingle();

    if (error) {
      console.error("[me/trade-journal/:id] PATCH:", error);
      return Response.json({ error: "Could not update" }, { status: 500 });
    }
    if (!data) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }

    return Response.json({ success: true as const, entry: rowToApi(data as Record<string, unknown>) });
  } catch (e) {
    console.error("[me/trade-journal/:id] PATCH exception:", e);
    return Response.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: Ctx) {
  try {
    const session = await getServerSession(authOptions);
    const discordId = session?.user?.id?.trim() ?? "";
    if (!discordId) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { id: idRaw } = await context.params;
    const id = typeof idRaw === "string" ? idRaw.trim() : "";
    if (!id) return Response.json({ error: "Invalid id" }, { status: 400 });

    const db = getSupabaseAdmin();
    if (!db) return Response.json({ error: "Database not configured" }, { status: 503 });

    const { data, error } = await db
      .from("trade_journal_entries")
      .delete()
      .eq("id", id)
      .eq("discord_id", discordId)
      .select("id");

    if (error) {
      console.error("[me/trade-journal/:id] DELETE:", error);
      return Response.json({ error: "Could not delete" }, { status: 500 });
    }
    if (!data?.length) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }

    return Response.json({ success: true as const });
  } catch (e) {
    console.error("[me/trade-journal/:id] DELETE exception:", e);
    return Response.json({ error: "Internal error" }, { status: 500 });
  }
}
