import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { readCopyTradePagePublicEnabled } from "@/lib/dashboardKv";
import {
  copyTradeStaffBypass,
  evaluateCopyTradeAccess,
  fetchUserCopyTradeAccessRow,
} from "@/lib/copyTrade/copyTradeAccess";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export async function assertCopyTradeFeatureAccess(): Promise<
  | { ok: true; discordId: string }
  | { ok: false; response: Response }
> {
  const session = await getServerSession(authOptions);
  const uid = session?.user?.id?.trim() ?? "";
  if (!session?.user?.id || !uid) {
    return { ok: false, response: Response.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const db = getSupabaseAdmin();
  if (!db) {
    return { ok: false, response: Response.json({ error: "Database not configured" }, { status: 503 }) };
  }

  const ht = session.user.helpTier;
  const helpTier = ht === "admin" || ht === "mod" || ht === "user" ? ht : "user";

  if (!copyTradeStaffBypass(helpTier)) {
    const pageOpen = await readCopyTradePagePublicEnabled(db);
    if (!pageOpen) {
      return {
        ok: false,
        response: Response.json(
          { ok: false, error: "Copy trade is not available yet.", code: "copy_trade_page_closed" },
          { status: 403 }
        ),
      };
    }
  }

  const row = await fetchUserCopyTradeAccessRow(db, uid);
  const gate = evaluateCopyTradeAccess({ helpTier, user: row });

  if (!gate.allowed) {
    return {
      ok: false,
      response: Response.json(
        { ok: false, error: gate.reason ?? "Copy trade is not available for your account.", access: gate },
        { status: 403 }
      ),
    };
  }

  return { ok: true, discordId: uid };
}
