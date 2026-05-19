import { requireAffiliateOpsAdmin } from "@/lib/affiliate/requireAffiliateOpsAccess";
import {
  updateAffiliateAccountCommissionRateBps,
  updateAffiliateApplicationReview,
  updateAffiliateAdminReviewNotes,
} from "@/lib/affiliate/affiliateDb";
import type { AffiliateAccountStatus } from "@/lib/affiliate/affiliateSession";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseStatus(raw: string): AffiliateAccountStatus | null {
  if (
    raw === "pending" ||
    raw === "needs_contact" ||
    raw === "denied" ||
    raw === "active" ||
    raw === "suspended"
  ) {
    return raw;
  }
  return null;
}

export async function PATCH(
  request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const gate = await requireAffiliateOpsAdmin();
  if (!gate.ok) return gate.response;

  const { id } = await ctx.params;
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const statusRaw = typeof body?.status === "string" ? body.status.trim() : "";
  const status = statusRaw ? parseStatus(statusRaw) : null;

  const hasBps = body?.commissionRateBps !== undefined && body?.commissionRateBps !== null;
  const bps = hasBps ? Math.floor(Number(body?.commissionRateBps)) : NaN;
  const hasReviewNotes = body !== null && Object.prototype.hasOwnProperty.call(body, "adminReviewNotes");
  const adminReviewNotes = hasReviewNotes
    ? typeof body?.adminReviewNotes === "string"
      ? body.adminReviewNotes
      : null
    : undefined;
  const hasDenialReason = body !== null && Object.prototype.hasOwnProperty.call(body, "denialReason");
  const denialReason = hasDenialReason
    ? typeof body?.denialReason === "string"
      ? body.denialReason
      : null
    : undefined;
  const hasDenialReapplyAllowed =
    body !== null && Object.prototype.hasOwnProperty.call(body, "denialReapplyAllowed");
  const denialReapplyAllowed = hasDenialReapplyAllowed ? body?.denialReapplyAllowed === true : undefined;
  const hasReapplyAfter = body !== null && Object.prototype.hasOwnProperty.call(body, "reapplyAfter");
  const reapplyAfter =
    hasReapplyAfter && typeof body?.reapplyAfter === "string"
      ? body.reapplyAfter
      : hasReapplyAfter
        ? null
        : undefined;

  if (!status && !hasBps && !hasReviewNotes) {
    return Response.json(
      { success: false, error: "Provide status, commissionRateBps, and/or adminReviewNotes" },
      { status: 400 }
    );
  }

  if (hasBps && (!Number.isFinite(bps) || bps < 0 || bps > 10000)) {
    return Response.json({ success: false, error: "commissionRateBps must be 0–10000" }, { status: 400 });
  }

  if (status) {
    const review = await updateAffiliateApplicationReview(id, {
      status,
      denialReason: status === "denied" ? denialReason : null,
      denialReapplyAllowed: status === "denied" ? denialReapplyAllowed : undefined,
      reapplyAfter: status === "denied" ? reapplyAfter : undefined,
    });
    if (!review.ok) {
      return Response.json({ success: false, error: review.error }, { status: 400 });
    }
  }

  if (hasBps) {
    const ok = await updateAffiliateAccountCommissionRateBps(id, bps);
    if (!ok) {
      return Response.json({ success: false, error: "Commission rate update failed" }, { status: 500 });
    }
  }

  if (hasReviewNotes) {
    const ok = await updateAffiliateAdminReviewNotes(id, adminReviewNotes ?? null);
    if (!ok) {
      return Response.json({ success: false, error: "Review notes update failed" }, { status: 500 });
    }
  }

  return Response.json({
    success: true,
    status: status ?? undefined,
    commissionRateBps: hasBps ? bps : undefined,
    adminReviewNotes: hasReviewNotes ? adminReviewNotes : undefined,
    denialReason: status === "denied" ? denialReason : undefined,
  });
}
