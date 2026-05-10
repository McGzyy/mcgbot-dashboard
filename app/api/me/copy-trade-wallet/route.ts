import { assertCopyTradeFeatureAccess } from "@/lib/copyTrade/copyTradeAccessHttp";
import { createCopyTradeUserWallet } from "@/lib/copyTrade/userWalletService";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const gate = await assertCopyTradeFeatureAccess();
    if (!gate.ok) return gate.response;
    const uid = gate.discordId;

    const db = getSupabaseAdmin();
    if (!db) return Response.json({ error: "Database not configured" }, { status: 503 });

    const created = await createCopyTradeUserWallet(db, uid);
    if (!created.ok) {
      return Response.json({ ok: false, error: created.error }, { status: 400 });
    }
    return Response.json({ ok: true, publicKey: created.publicKey });
  } catch (e) {
    console.error("[copy-trade-wallet POST]", e);
    return Response.json({ error: "Internal error" }, { status: 500 });
  }
}
