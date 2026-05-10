import { applyOutsideCallTrustUpdate, type ApplyOutsideCallTrustBody } from "@/lib/outsideXCalls/applyOutsideCallTrust";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function optionalFinite(n: unknown): number | undefined {
  if (n === undefined || n === null) return undefined;
  const x = Number(n);
  return Number.isFinite(x) ? x : undefined;
}

function bearerToken(request: Request): string | null {
  const h = request.headers.get("authorization");
  if (!h || !h.toLowerCase().startsWith("bearer ")) return null;
  return h.slice(7).trim() || null;
}

export async function POST(request: Request) {
  const secret = process.env.OUTSIDE_CALL_TRUST_SECRET?.trim();
  if (!secret) {
    return Response.json(
      { ok: false, error: "OUTSIDE_CALL_TRUST_SECRET is not configured on this host." },
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
  const payload: ApplyOutsideCallTrustBody = {
    callId: typeof o.callId === "string" ? o.callId : "",
    athMultiple: Number(o.athMultiple),
    markDefinedFailure: o.markDefinedFailure === true,
    entryMcapUsd: optionalFinite(o.entryMcapUsd),
    entryLiquidityUsd: optionalFinite(o.entryLiquidityUsd),
    currentLiquidityUsd: optionalFinite(o.currentLiquidityUsd),
    currentMcapUsd: optionalFinite(o.currentMcapUsd),
    pairInactiveOrRemoved: o.pairInactiveOrRemoved === true,
  };

  const result = await applyOutsideCallTrustUpdate(payload);
  if (!result.ok) {
    return Response.json({ ok: false, error: result.error }, { status: result.status ?? 500 });
  }

  return Response.json(result);
}
