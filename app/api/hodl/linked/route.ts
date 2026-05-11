import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Primary dashboard wallet + optional HODL-only wallet for the signed-in user. */
export async function GET() {
  const session = await getServerSession(authOptions);
  const discordId = session?.user?.id?.trim() ?? "";
  if (!discordId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session?.user?.hasDashboardAccess !== true) {
    return Response.json({ error: "Subscription required" }, { status: 402 });
  }

  const db = getSupabaseAdmin();
  if (!db) {
    return Response.json({ error: "Database not configured" }, { status: 503 });
  }

  const [dashRes, hodlRes] = await Promise.all([
    db.from("dashboard_linked_wallets").select("chain, wallet_pubkey, verified_at").eq("discord_id", discordId).maybeSingle(),
    db.from("hodl_linked_wallets").select("wallet_pubkey, verified_at").eq("discord_id", discordId).maybeSingle(),
  ]);

  const dashboard =
    dashRes.data && (dashRes.data as { wallet_pubkey?: string }).wallet_pubkey
      ? {
          chain:
            typeof (dashRes.data as { chain?: string }).chain === "string"
              ? (dashRes.data as { chain: string }).chain
              : "solana",
          walletPubkey: String((dashRes.data as { wallet_pubkey: string }).wallet_pubkey),
          verifiedAt:
            typeof (dashRes.data as { verified_at?: string }).verified_at === "string"
              ? (dashRes.data as { verified_at: string }).verified_at
              : null,
        }
      : null;

  const hodlOnly =
    hodlRes.data && (hodlRes.data as { wallet_pubkey?: string }).wallet_pubkey
      ? {
          walletPubkey: String((hodlRes.data as { wallet_pubkey: string }).wallet_pubkey),
          verifiedAt:
            typeof (hodlRes.data as { verified_at?: string }).verified_at === "string"
              ? (hodlRes.data as { verified_at: string }).verified_at
              : null,
        }
      : null;

  return Response.json({ dashboard, hodlOnly });
}
