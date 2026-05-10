import { loadCopyTradeExecutorKeypair } from "@/lib/copyTrade/execution/executorKeypair";
import { isCopyTradeExecutionEnabled, runCopyTradeQueue } from "@/lib/copyTrade/execution/processCopyTradeQueue";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorizeCron(request: Request): boolean {
  const secret = (process.env.CRON_SECRET ?? "").trim();
  if (!secret) return false;
  const auth = request.headers.get("authorization") ?? "";
  const bearer = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  const header = (request.headers.get("x-cron-secret") ?? "").trim();
  return bearer === secret || header === secret;
}

function parseLimitFromUrl(request: Request): number {
  const { searchParams } = new URL(request.url);
  const n = Number(searchParams.get("limit") ?? "3");
  return Number.isFinite(n) ? n : 3;
}

async function runOnce(request: Request): Promise<Response> {
  if (!isCopyTradeExecutionEnabled()) {
    return Response.json({
      ok: true,
      executed: false,
      reason: "COPY_TRADE_EXECUTION_ENABLED is not true.",
      recovered: 0,
      results: [],
    });
  }

  const kp = loadCopyTradeExecutorKeypair();
  if (!kp) {
    return Response.json(
      { ok: false, error: "COPY_TRADE_EXECUTOR_SOL_SECRET_BASE58 (or _JSON) not set." },
      { status: 503 }
    );
  }

  const db = getSupabaseAdmin();
  if (!db) {
    return Response.json({ ok: false, error: "Database not configured" }, { status: 503 });
  }

  const limit = parseLimitFromUrl(request);
  const { recovered, results } = await runCopyTradeQueue({
    db,
    keypair: kp,
    limit,
    recoverStaleMs: 900_000,
  });

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

export async function GET(request: Request) {
  if (!authorizeCron(request)) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  return runOnce(request);
}

export async function POST(request: Request) {
  if (!authorizeCron(request)) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  return runOnce(request);
}
