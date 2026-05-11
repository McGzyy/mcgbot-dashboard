import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Primary dashboard-linked Solana wallet (one per Discord user). */
export async function GET() {
  const session = await getServerSession(authOptions);
  const discordId = session?.user?.id?.trim() ?? "";
  if (!discordId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getSupabaseAdmin();
  if (!db) {
    return Response.json({ error: "Database not configured" }, { status: 503 });
  }

  const { data, error } = await db
    .from("dashboard_linked_wallets")
    .select("chain, wallet_pubkey, verified_at")
    .eq("discord_id", discordId)
    .maybeSingle();

  if (error) {
    console.error("[me/wallet GET]", error);
    return Response.json({ error: "Could not load wallet" }, { status: 500 });
  }

  if (!data || !(data as { wallet_pubkey?: string }).wallet_pubkey) {
    return Response.json({ wallet: null });
  }

  const row = data as { chain?: string; wallet_pubkey: string; verified_at?: string };
  return Response.json({
    wallet: {
      chain: typeof row.chain === "string" && row.chain ? row.chain : "solana",
      walletPubkey: row.wallet_pubkey,
      verifiedAt: typeof row.verified_at === "string" ? row.verified_at : null,
    },
  });
}
