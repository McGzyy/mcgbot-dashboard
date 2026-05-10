import { loadCopyTradeExecutorKeypair } from "@/lib/copyTrade/execution/executorKeypair";
import { runCopyTradeSellPass } from "@/lib/copyTrade/execution/processCopyTradePositionSells";
import { isCopyTradeExecutionEnabled, runCopyTradeQueue } from "@/lib/copyTrade/execution/processCopyTradeQueue";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function bearerToken(request: Request): string | null {
  const h = request.headers.get("authorization");
  if (!h || !h.toLowerCase().startsWith("bearer ")) return null;
  return h.slice(7).trim() || null;
}

function parseBodyLimit(o: Record<string, unknown>): number {
  const raw = o.limit ?? o.batchSize;
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n)) return 3;
  return Math.floor(n);
}

function parseRecoverStaleMs(o: Record<string, unknown>): number | undefined {
  if (o.recoverStale === false || o.recoverStaleMs === false) return undefined;
  const raw = o.recoverStaleMs ?? o.recoverStaleMinutes;
  if (raw === undefined || raw === null) return 900_000;
  if (typeof raw === "number" && Number.isFinite(raw)) return raw <= 120 ? raw * 60_000 : raw;
  const n = Number(raw);
  if (!Number.isFinite(n)) return 900_000;
  return n <= 120 ? n * 60_000 : n;
}

export async function POST(request: Request) {
  const secret = process.env.COPY_TRADE_EXECUTION_SECRET?.trim();
  if (!secret) {
    return Response.json(
      { ok: false, error: "COPY_TRADE_EXECUTION_SECRET is not configured on this host." },
      { status: 503 }
    );
  }

  const token = bearerToken(request);
  if (token !== secret) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  if (!isCopyTradeExecutionEnabled()) {
    return Response.json({
      ok: true,
      executed: false,
      reason: "COPY_TRADE_EXECUTION_ENABLED is not true — no swaps attempted.",
      recovered: 0,
      results: [],
      sellPass: [],
    });
  }

  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const o = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const limit = parseBodyLimit(o);
  const sellLimit = parseSellLimit(o, limit);
  const recoverStaleMs = parseRecoverStaleMs(o);

  const kp = loadCopyTradeExecutorKeypair();
  if (!kp) {
    return Response.json(
      {
        ok: false,
        error:
          "Executor key missing. Set COPY_TRADE_EXECUTOR_SOL_SECRET_BASE58 (or COPY_TRADE_EXECUTOR_SOL_SECRET_JSON).",
      },
      { status: 503 }
    );
  }

  const db = getSupabaseAdmin();
  if (!db) {
    return Response.json({ ok: false, error: "Database not configured" }, { status: 503 });
  }

  const { recovered, results } = await runCopyTradeQueue({
    db,
    keypair: kp,
    limit,
    recoverStaleMs,
  });

  const sellPass = await runCopyTradeSellPass(db, kp, sellLimit);

  const completed = results.filter((r) => r.outcome === "completed").length;
  const failed = results.filter((r) => r.outcome === "failed").length;
  const skipped = results.filter((r) => r.outcome === "skipped").length;

  return Response.json({
    ok: true,
    executed: true,
    recovered,
    processed: results.length,
    completed,
    failed,
    skipped,
    sellPass: sellPass.results,
    results: results.map((r) =>
      r.outcome === "completed"
        ? { outcome: r.outcome, intentId: r.intentId, signature: r.signature }
        : r.outcome === "failed"
          ? { outcome: r.outcome, intentId: r.intentId, error: r.error }
          : r.outcome === "skipped"
            ? { outcome: r.outcome, intentId: r.intentId, reason: r.reason }
            : { outcome: r.outcome }
    ),
  });
}
