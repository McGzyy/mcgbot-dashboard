import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requirePremiumAndDiscord } from "@/app/api/pnl/_lib/pnlGate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function normalizeCa(raw: string): string {
  return raw.trim();
}

export async function GET(req: Request) {
  const gate = await requirePremiumAndDiscord();
  if (!gate.ok) return gate.response;

  const ca = normalizeCa(new URL(req.url).searchParams.get("ca") ?? "");
  if (!ca || ca.length > 80) {
    return Response.json({ success: false, error: "Invalid contract address" }, { status: 400 });
  }

  const db = getSupabaseAdmin();
  if (!db) {
    return Response.json({ success: false, error: "Database not configured" }, { status: 503 });
  }

  // Eligible if it has ever been called (bot or user). If exclusions column isn't present, tolerate it.
  const attempt = await db
    .from("call_performance")
    .select("id, excluded_from_stats")
    .eq("call_ca", ca)
    .limit(1);

  if (attempt.error) {
    const msg = String((attempt.error as any).message ?? "");
    if (msg.toLowerCase().includes("excluded_from_stats")) {
      const fallback = await db.from("call_performance").select("id").eq("call_ca", ca).limit(1);
      if (fallback.error) {
        console.error("[pnl/eligible] fallback:", fallback.error);
        return Response.json({ success: false, error: "Failed eligibility check" }, { status: 500 });
      }
      return Response.json({ success: true, eligible: Array.isArray(fallback.data) && fallback.data.length > 0 });
    }
    console.error("[pnl/eligible] attempt:", attempt.error);
    return Response.json({ success: false, error: "Failed eligibility check" }, { status: 500 });
  }

  const rows = Array.isArray(attempt.data) ? attempt.data : [];
  const eligible = rows.length > 0 && rows.some((r) => (r as any).excluded_from_stats !== true);
  return Response.json({ success: true, eligible });
}

