import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  evaluateCopyTradeAccess,
  fetchUserCopyTradeAccessRow,
} from "@/lib/copyTrade/copyTradeAccess";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    const uid = session?.user?.id?.trim() ?? "";
    if (!session?.user?.id || !uid) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const ht = session.user.helpTier;
    const helpTier = ht === "admin" || ht === "mod" || ht === "user" ? ht : "user";

    const db = getSupabaseAdmin();
    if (!db) return Response.json({ error: "Database not configured" }, { status: 503 });

    const row = await fetchUserCopyTradeAccessRow(db, uid);
    const gate = evaluateCopyTradeAccess({ helpTier, user: row });

    if (gate.allowed) {
      return Response.json({ ok: false, error: "You already have copy trade access." }, { status: 400 });
    }

    if (gate.accessState === "pending") {
      return Response.json({ ok: false, error: "A request is already pending." }, { status: 400 });
    }

    const now = new Date().toISOString();
    const { error } = await db
      .from("users")
      .update({
        copy_trade_access_state: "pending",
        copy_trade_access_requested_at: now,
        copy_trade_access_decided_at: null,
        copy_trade_access_decided_by: null,
      })
      .eq("discord_id", uid);

    if (error) {
      console.error("[copy-trade-access-request]", error);
      return Response.json({ error: "Could not submit request." }, { status: 500 });
    }

    return Response.json({ ok: true, message: "Request submitted. Staff will review your account." });
  } catch (e) {
    console.error("[copy-trade-access-request POST]", e);
    return Response.json({ error: "Internal error" }, { status: 500 });
  }
}
