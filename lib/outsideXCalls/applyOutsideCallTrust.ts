import {
  OUTSIDE_X_TRUST_CEILING,
  OUTSIDE_X_TRUST_DEFINED_FAILURE_PENALTY,
  OUTSIDE_X_TRUST_FLOOR,
  OUTSIDE_X_TRUST_SUSPENSION_REVIEW_THRESHOLD,
} from "@/lib/outsideXCalls/constants";
import { evaluateOutsideDefinedFailure, type OutsideDefinedFailureSignals } from "@/lib/outsideXCalls/definedFailure";
import { cumulativeOutsideUpsidePointsAtMultiple, upsideTrustDeltaBetweenMultiples } from "@/lib/outsideXCalls/trustTierMath";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import type { SupabaseClient } from "@supabase/supabase-js";

export type ApplyOutsideCallTrustBody = {
  callId: string;
  /** Latest ATH multiple for this call (worker / indexer). */
  athMultiple: number;
  /** When true, forces defined-failure if still eligible (sub-2×). For staff or bot override. */
  markDefinedFailure?: boolean;
  /** Optional snapshots (stored on first non-null write). */
  entryMcapUsd?: number | null;
  entryLiquidityUsd?: number | null;
  currentLiquidityUsd?: number | null;
  currentMcapUsd?: number | null;
  pairInactiveOrRemoved?: boolean;
};

export type ApplyOutsideCallTrustResult = {
  ok: true;
  sourceId: string;
  trustBefore: number;
  trustAfter: number;
  upsideDelta: number;
  failureDelta: number;
  newMaxAth: number;
  trustUpsideAwarded: number;
  failureApplied: boolean;
  failureReason: string | null;
  suspensionReviewPending: boolean;
};

function clampTrust(n: number): number {
  return Math.min(OUTSIDE_X_TRUST_CEILING, Math.max(OUTSIDE_X_TRUST_FLOOR, Math.round(n)));
}

type CallRow = {
  id: string;
  source_id: string;
  trust_max_ath_multiple: number;
  trust_upside_awarded: number;
  trust_failure_applied: boolean;
  trust_failure_reason: string | null;
  entry_mcap_usd: number | null;
  entry_liquidity_usd: number | null;
};

type SourceRow = {
  id: string;
  trust_score: number;
  suspension_review_pending: boolean;
};

/**
 * Applies one evaluation tick: raises ATH, credits capped upside ladder, optionally applies defined failure once,
 * writes `outside_trust_score_events`, updates source trust + review flag.
 */
export async function applyOutsideCallTrustUpdate(
  body: ApplyOutsideCallTrustBody
): Promise<ApplyOutsideCallTrustResult | { ok: false; error: string; status?: number }> {
  const callId = typeof body.callId === "string" ? body.callId.trim() : "";
  if (!callId) return { ok: false, error: "callId is required", status: 400 };

  const ath = Number(body.athMultiple);
  if (!Number.isFinite(ath) || ath < 0) {
    return { ok: false, error: "athMultiple must be a non-negative finite number", status: 400 };
  }

  const db = getSupabaseAdmin();
  if (!db) return { ok: false, error: "Database not configured", status: 503 };

  const { data: callRaw, error: cErr } = await db
    .from("outside_calls")
    .select(
      "id,source_id,trust_max_ath_multiple,trust_upside_awarded,trust_failure_applied,trust_failure_reason,entry_mcap_usd,entry_liquidity_usd"
    )
    .eq("id", callId)
    .maybeSingle();

  if (cErr || !callRaw) {
    return { ok: false, error: cErr?.message ?? "Call not found", status: 404 };
  }

  const call = callRaw as CallRow;
  const { data: srcRaw, error: sErr } = await db
    .from("outside_x_sources")
    .select("id,trust_score,suspension_review_pending")
    .eq("id", call.source_id)
    .maybeSingle();

  if (sErr || !srcRaw) {
    return { ok: false, error: sErr?.message ?? "Source not found", status: 404 };
  }

  const source = srcRaw as SourceRow;
  const trustBefore = clampTrust(source.trust_score);

  if (call.trust_failure_applied === true) {
    return {
      ok: true,
      sourceId: source.id,
      trustBefore,
      trustAfter: trustBefore,
      upsideDelta: 0,
      failureDelta: 0,
      newMaxAth: Math.max(Number(call.trust_max_ath_multiple) || 0, ath),
      trustUpsideAwarded: call.trust_upside_awarded,
      failureApplied: true,
      failureReason: call.trust_failure_reason,
      suspensionReviewPending: source.suspension_review_pending === true,
    };
  }

  const prevMax = Math.max(0, Number(call.trust_max_ath_multiple) || 0);
  const newMax = Math.max(prevMax, ath);
  const upsideDelta = upsideTrustDeltaBetweenMultiples(prevMax, newMax);
  const awardedTotal = cumulativeOutsideUpsidePointsAtMultiple(newMax);

  const entryMcap =
    call.entry_mcap_usd != null && Number.isFinite(Number(call.entry_mcap_usd))
      ? Number(call.entry_mcap_usd)
      : body.entryMcapUsd != null && Number.isFinite(Number(body.entryMcapUsd))
        ? Number(body.entryMcapUsd)
        : null;
  const entryLiq =
    call.entry_liquidity_usd != null && Number.isFinite(Number(call.entry_liquidity_usd))
      ? Number(call.entry_liquidity_usd)
      : body.entryLiquidityUsd != null && Number.isFinite(Number(body.entryLiquidityUsd))
        ? Number(body.entryLiquidityUsd)
        : null;

  const signals: OutsideDefinedFailureSignals = {
    maxAthMultiple: newMax,
    currentLiquidityUsd: body.currentLiquidityUsd,
    entryLiquidityUsd: entryLiq,
    currentMcapUsd: body.currentMcapUsd,
    entryMcapUsd: entryMcap,
    pairInactiveOrRemoved: body.pairInactiveOrRemoved,
  };

  const autoFailure = evaluateOutsideDefinedFailure(signals);
  const explicitFailure = body.markDefinedFailure === true && newMax < 2 - 1e-9;
  const shouldFail = !call.trust_failure_applied && (autoFailure || explicitFailure);

  const failureDelta = shouldFail ? OUTSIDE_X_TRUST_DEFINED_FAILURE_PENALTY : 0;
  const failureReason = shouldFail ? (explicitFailure && !autoFailure ? "explicit" : "below_2x_pair_dead") : null;

  let runningTrust = trustBefore;
  if (upsideDelta !== 0) {
    runningTrust = clampTrust(runningTrust + upsideDelta);
  }
  if (failureDelta !== 0 && failureReason) {
    runningTrust = clampTrust(runningTrust + failureDelta);
  }

  const trustAfter = runningTrust;
  const crossedBelowReview =
    trustBefore >= OUTSIDE_X_TRUST_SUSPENSION_REVIEW_THRESHOLD &&
    trustAfter < OUTSIDE_X_TRUST_SUSPENSION_REVIEW_THRESHOLD;
  const suspensionReviewPending = crossedBelowReview || source.suspension_review_pending === true;

  const nowIso = new Date().toISOString();

  const { data: updatedRows, error: upCallErr } = await db
    .from("outside_calls")
    .update({
      trust_max_ath_multiple: newMax,
      trust_upside_awarded: awardedTotal,
      trust_failure_applied: call.trust_failure_applied || shouldFail,
      trust_failure_reason: shouldFail ? failureReason : call.trust_failure_reason,
      entry_mcap_usd: call.entry_mcap_usd ?? (body.entryMcapUsd != null ? body.entryMcapUsd : null),
      entry_liquidity_usd: call.entry_liquidity_usd ?? (body.entryLiquidityUsd != null ? body.entryLiquidityUsd : null),
    })
    .eq("id", callId)
    .eq("trust_failure_applied", call.trust_failure_applied)
    .select("id");

  if (upCallErr) {
    return { ok: false, error: upCallErr.message || "Failed to update call", status: 500 };
  }
  if (!updatedRows?.length) {
    return { ok: false, error: "Call trust state changed concurrently; retry.", status: 409 };
  }

  const { error: srcErr } = await db
    .from("outside_x_sources")
    .update({
      trust_score: trustAfter,
      suspension_review_pending: suspensionReviewPending,
      updated_at: nowIso,
    })
    .eq("id", source.id);

  if (srcErr) {
    return { ok: false, error: srcErr.message || "Failed to update source", status: 500 };
  }

  if (upsideDelta !== 0) {
    const trustAfterUpside = clampTrust(trustBefore + upsideDelta);
    await insertTrustEvent(db, {
      sourceId: source.id,
      callId,
      delta: upsideDelta,
      trustAfter: trustAfterUpside,
      kind: "upside_tier",
      detail: { prevMaxAth: prevMax, newMaxAth: newMax, upsideDelta },
    });
  }
  if (failureDelta !== 0 && failureReason) {
    await insertTrustEvent(db, {
      sourceId: source.id,
      callId,
      delta: failureDelta,
      trustAfter,
      kind: "defined_failure",
      detail: { reason: failureReason, maxAth: newMax, signals },
    });
  }

  return {
    ok: true,
    sourceId: source.id,
    trustBefore,
    trustAfter,
    upsideDelta,
    failureDelta,
    newMaxAth: newMax,
    trustUpsideAwarded: awardedTotal,
    failureApplied: call.trust_failure_applied || shouldFail,
    failureReason: shouldFail ? failureReason : call.trust_failure_reason,
    suspensionReviewPending,
  };
}

async function insertTrustEvent(
  db: SupabaseClient,
  row: {
    sourceId: string;
    callId: string;
    delta: number;
    trustAfter: number;
    kind: string;
    detail: Record<string, unknown>;
  }
): Promise<void> {
  const { error } = await db.from("outside_trust_score_events").insert({
    source_id: row.sourceId,
    call_id: row.callId,
    delta: row.delta,
    trust_after: row.trustAfter,
    kind: row.kind,
    detail: row.detail,
    created_at: new Date().toISOString(),
  });
  if (error) {
    console.error("[outside trust] event insert failed", error);
  }
}
