import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requirePremiumAndDiscord } from "@/app/api/pnl/_lib/pnlGate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const gate = await requirePremiumAndDiscord();
  if (!gate.ok) return gate.response;

  const db = getSupabaseAdmin();
  if (!db) {
    return Response.json({ success: false, error: "Database not configured" }, { status: 503 });
  }

  const { data, error } = await db
    .from("pnl_wallets")
    .select("wallet_pubkey, created_at")
    .eq("discord_id", gate.discordId)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    console.error("[me/pnl-wallets] select:", error);
    return Response.json({ success: false, error: "Failed to load wallets" }, { status: 500 });
  }

  return Response.json({ success: true, wallets: Array.isArray(data) ? data : [] });
}

