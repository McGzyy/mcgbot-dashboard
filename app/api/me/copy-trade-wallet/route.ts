import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createCopyTradeUserWallet } from "@/lib/copyTrade/userWalletService";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    const uid = session?.user?.id?.trim() ?? "";
    if (!uid) return Response.json({ error: "Unauthorized" }, { status: 401 });

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
