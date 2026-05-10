import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { readFixItTicketsModuleEnabled } from "@/lib/dashboardKv";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Whether the floating Fix-it ticket FAB should show (separate from NEXT_PUBLIC kill switch). */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id?.trim()) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getSupabaseAdmin();
  if (!db) {
    return Response.json({ ok: true as const, enabled: true });
  }

  const enabled = await readFixItTicketsModuleEnabled(db);
  return Response.json({ ok: true as const, enabled });
}
