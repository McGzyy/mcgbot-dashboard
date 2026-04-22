import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

function clampLimit(x: number) {
  if (!Number.isFinite(x)) return DEFAULT_LIMIT;
  return Math.min(MAX_LIMIT, Math.max(1, Math.floor(x)));
}

export async function GET(request: Request) {
  try {
    const db = getSupabaseAdmin();
    if (!db) {
      return Response.json({ success: false, error: "Supabase not configured" }, { status: 500 });
    }

    const url = new URL(request.url);
    const limit = clampLimit(Number(url.searchParams.get("limit") || DEFAULT_LIMIT));
    const offset = Math.max(0, Math.floor(Number(url.searchParams.get("offset") || 0)));
    const author = (url.searchParams.get("author") || "").trim();

    let q = db
      .from("trusted_pro_calls")
      .select(
        "id, author_discord_id, contract_address, thesis, narrative, catalysts, risks, time_horizon, entry_plan, invalidation, sources, tags, status, staff_notes, reviewed_at, reviewed_by_discord_id, published_at, views_count, created_at, updated_at"
      )
      .eq("status", "approved")
      .order("published_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (author) {
      q = q.eq("author_discord_id", author);
    }

    const { data, error } = await q;
    if (error) {
      console.error("[public/trusted-pro-calls] supabase:", error);
      return Response.json({ success: false, error: "Failed to load calls" }, { status: 500 });
    }

    return Response.json({
      success: true,
      calls: Array.isArray(data) ? data : [],
      limit,
      offset,
    });
  } catch (e) {
    console.error("[public/trusted-pro-calls] GET:", e);
    return Response.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}

