import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  const id = session?.user?.id?.trim();
  if (!id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getSupabaseAdmin();
  if (!db) {
    return Response.json({ success: false, error: "Database not configured" }, { status: 503 });
  }

  const { data: sub } = await db
    .from("subscriptions")
    .select("current_period_end, plan_id")
    .eq("discord_id", id)
    .maybeSingle();

  const end = sub?.current_period_end ? String(sub.current_period_end) : null;
  const active = end != null && new Date(end).getTime() > Date.now();

  const { data: pending } = await db
    .from("payment_invoices")
    .select("id, lamports, quote_expires_at, reference_pubkey, treasury_pubkey, status, created_at")
    .eq("discord_id", id)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return Response.json({
    success: true,
    active,
    currentPeriodEnd: end,
    pendingInvoice: pending ?? null,
  });
}
