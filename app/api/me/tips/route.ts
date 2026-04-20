import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  const discordId = session?.user?.id?.trim() ?? "";
  if (!discordId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getSupabaseAdmin();
  if (!db) {
    return Response.json({ success: false, error: "Database not configured" }, { status: 503 });
  }

  const { data, error } = await db
    .from("bot_tips")
    .select("amount_sol, amount_lamports, reference_pubkey, status, signature, from_wallet, created_at, confirmed_at")
    .eq("discord_id", discordId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    console.error("[me/tips] select:", error);
    return Response.json({ success: false, error: "Failed to load tips" }, { status: 500 });
  }

  return Response.json({ success: true, tips: Array.isArray(data) ? data : [] });
}

