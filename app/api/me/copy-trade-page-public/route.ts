import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { readCopyTradePagePublicEnabled } from "@/lib/dashboardKv";
import { copyTradeStaffBypass } from "@/lib/copyTrade/copyTradeAccess";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ht = session.user.helpTier;
  const helpTier = ht === "admin" || ht === "mod" || ht === "user" ? ht : "user";

  if (copyTradeStaffBypass(helpTier)) {
    return Response.json({ ok: true as const, enabled: true });
  }

  const db = getSupabaseAdmin();
  if (!db) {
    return Response.json({ ok: true as const, enabled: false });
  }

  const enabled = await readCopyTradePagePublicEnabled(db);
  return Response.json({ ok: true as const, enabled });
}
