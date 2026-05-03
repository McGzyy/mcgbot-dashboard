import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const discordId = session?.user?.id?.trim() ?? "";
    if (!discordId) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const db = getSupabaseAdmin();
    if (!db) {
      return Response.json({ wallet: null, error: "Database not configured" }, { status: 503 });
    }

    const { data, error } = await db
      .from("dashboard_linked_wallets")
      .select("chain, wallet_pubkey, verified_at")
      .eq("discord_id", discordId)
      .maybeSingle();

    if (error) {
      console.error("[me/wallet] GET:", error);
      return Response.json({ error: "Could not load wallet" }, { status: 500 });
    }

    if (!data || typeof data !== "object") {
      return Response.json({ wallet: null });
    }

    const row = data as Record<string, unknown>;
    const walletPubkey =
      typeof row.wallet_pubkey === "string" ? row.wallet_pubkey.trim() : "";
    if (!walletPubkey) {
      return Response.json({ wallet: null });
    }

    return Response.json({
      wallet: {
        chain: typeof row.chain === "string" ? row.chain : "solana",
        walletPubkey,
        verifiedAt:
          typeof row.verified_at === "string" ? row.verified_at : null,
      },
    });
  } catch (e) {
    console.error("[me/wallet] GET:", e);
    return Response.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const session = await getServerSession(authOptions);
    const discordId = session?.user?.id?.trim() ?? "";
    if (!discordId) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const db = getSupabaseAdmin();
    if (!db) {
      return Response.json({ error: "Database not configured" }, { status: 503 });
    }

    const { error } = await db.from("dashboard_linked_wallets").delete().eq("discord_id", discordId);
    if (error) {
      console.error("[me/wallet] DELETE:", error);
      return Response.json({ error: "Could not disconnect" }, { status: 500 });
    }

    await db.from("wallet_link_challenges").delete().eq("discord_id", discordId);

    return Response.json({ ok: true });
  } catch (e) {
    console.error("[me/wallet] DELETE:", e);
    return Response.json({ error: "Internal error" }, { status: 500 });
  }
}
