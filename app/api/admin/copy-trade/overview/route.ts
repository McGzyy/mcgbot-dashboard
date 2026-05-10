import { requireDashboardAdmin } from "@/lib/adminGate";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const gate = await requireDashboardAdmin();
  if (!gate.ok) return gate.response;

  const db = getSupabaseAdmin();
  if (!db) return Response.json({ error: "Database not configured" }, { status: 503 });

  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [
    wallets,
    openPositions,
    intentsQueued,
    intentsProcessing,
    intentsCompleted24h,
    intentsFailed24h,
    intentsSkipped24h,
    intentsCompleted7d,
    intentsFailed7d,
    pendingAccess,
    failedListRes,
  ] = await Promise.all([
    db.from("copy_trade_user_wallets").select("discord_user_id", { count: "exact", head: true }),
    db.from("copy_trade_positions").select("id", { count: "exact", head: true }).eq("status", "open"),
    db.from("copy_trade_intents").select("id", { count: "exact", head: true }).eq("status", "queued"),
    db.from("copy_trade_intents").select("id", { count: "exact", head: true }).eq("status", "processing"),
    db
      .from("copy_trade_intents")
      .select("id", { count: "exact", head: true })
      .eq("status", "completed")
      .gte("created_at", since24h),
    db
      .from("copy_trade_intents")
      .select("id", { count: "exact", head: true })
      .eq("status", "failed")
      .gte("created_at", since24h),
    db
      .from("copy_trade_intents")
      .select("id", { count: "exact", head: true })
      .eq("status", "skipped")
      .gte("created_at", since24h),
    db
      .from("copy_trade_intents")
      .select("id", { count: "exact", head: true })
      .eq("status", "completed")
      .gte("created_at", since7d),
    db
      .from("copy_trade_intents")
      .select("id", { count: "exact", head: true })
      .eq("status", "failed")
      .gte("created_at", since7d),
    db.from("users").select("id", { count: "exact", head: true }).eq("copy_trade_access_state", "pending"),
    db
      .from("copy_trade_intents")
      .select("id,discord_user_id,created_at,error_message,signal_id")
      .eq("status", "failed")
      .order("created_at", { ascending: false })
      .limit(25),
  ]);

  const failedRows = Array.isArray(failedListRes.data) ? failedListRes.data : [];
  const signalIds = [...new Set(failedRows.map((r: { signal_id?: string }) => String(r.signal_id ?? "").trim()).filter(Boolean))];
  const caBySig = new Map<string, string>();
  if (signalIds.length) {
    const { data: sigs } = await db.from("copy_trade_signals").select("id,call_ca").in("id", signalIds);
    for (const s of sigs ?? []) {
      const o = s as { id: string; call_ca: string };
      if (o?.id) caBySig.set(String(o.id), String(o.call_ca ?? ""));
    }
  }

  const recentFailedIntents = failedRows.map((r: Record<string, unknown>) => ({
    id: r.id,
    discord_user_id: r.discord_user_id,
    created_at: r.created_at,
    error_message: r.error_message,
    call_ca: caBySig.get(String(r.signal_id ?? "")) ?? null,
  }));

  return Response.json({
    ok: true,
    counts: {
      custodialWallets: wallets.count ?? 0,
      openPositions: openPositions.count ?? 0,
      intentsQueued: intentsQueued.count ?? 0,
      intentsProcessing: intentsProcessing.count ?? 0,
      intentsCompleted24h: intentsCompleted24h.count ?? 0,
      intentsFailed24h: intentsFailed24h.count ?? 0,
      intentsSkipped24h: intentsSkipped24h.count ?? 0,
      intentsCompleted7d: intentsCompleted7d.count ?? 0,
      intentsFailed7d: intentsFailed7d.count ?? 0,
      copyTradeAccessPending: pendingAccess.count ?? 0,
    },
    recentFailedIntents,
  });
}
