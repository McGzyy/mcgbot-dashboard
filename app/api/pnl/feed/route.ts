import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requirePremiumAndDiscord } from "@/app/api/pnl/_lib/pnlGate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const gate = await requirePremiumAndDiscord();
  if (!gate.ok) return gate.response;

  const url = new URL(req.url);
  const ca = (url.searchParams.get("ca") ?? "").trim();
  const limit = Math.max(1, Math.min(50, Number(url.searchParams.get("limit") ?? 20) || 20));

  const db = getSupabaseAdmin();
  if (!db) {
    return Response.json({ success: false, error: "Database not configured" }, { status: 503 });
  }

  let q = db
    .from("pnl_posts")
    .select(
      "id, username, wallet_pubkey, token_ca, realized_pnl_sol, realized_pnl_pct, unrealized_pnl_sol, unrealized_pnl_pct, cost_basis_sol, proceeds_sol, qty_remaining, price_per_token_sol, computed_at, created_at"
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  if (ca) {
    q = q.eq("token_ca", ca);
  }

  const { data, error } = await q;
  if (error) {
    console.error("[pnl/feed] select:", error);
    return Response.json({ success: false, error: "Failed to load feed" }, { status: 500 });
  }

  return Response.json({ success: true, posts: Array.isArray(data) ? data : [] });
}

