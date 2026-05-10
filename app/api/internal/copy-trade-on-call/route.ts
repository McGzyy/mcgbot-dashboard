import { processCopyTradeOnCall } from "@/lib/copyTrade/onCallProcessor";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function bearerToken(request: Request): string | null {
  const h = request.headers.get("authorization");
  if (!h || !h.toLowerCase().startsWith("bearer ")) return null;
  return h.slice(7).trim() || null;
}

export async function POST(request: Request) {
  const secret = process.env.COPY_TRADE_SIGNAL_SECRET?.trim();
  if (!secret) {
    return Response.json(
      { ok: false, error: "COPY_TRADE_SIGNAL_SECRET is not configured on this host." },
      { status: 503 }
    );
  }

  const token = bearerToken(request);
  if (token !== secret) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const o = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const callPerformanceId = typeof o.callPerformanceId === "string" ? o.callPerformanceId : "";
  const call_ca = typeof o.call_ca === "string" ? o.call_ca : "";
  const source = typeof o.source === "string" ? o.source : "";
  const snapshot = o.snapshot && typeof o.snapshot === "object" ? (o.snapshot as Record<string, unknown>) : null;

  const db = getSupabaseAdmin();
  if (!db) {
    return Response.json({ ok: false, error: "Database not configured" }, { status: 503 });
  }

  const result = await processCopyTradeOnCall(db, {
    callPerformanceId,
    call_ca,
    source,
    snapshot,
  });

  if (!result.ok) {
    return Response.json({ ok: false, error: result.error }, { status: result.status });
  }

  return Response.json({ ok: true, ...result.result });
}
