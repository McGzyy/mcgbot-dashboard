import { NextResponse } from "next/server";
import { listAffiliateCommissionsForPartner } from "@/lib/affiliate/affiliateCommissions";
import { requireAffiliateSession } from "@/lib/affiliate/requireAffiliateSession";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_STATUS = new Set(["all", "pending", "approved", "paid", "voided"]);

export async function GET(request: Request) {
  const auth = await requireAffiliateSession({ requireVerified: true, requireActive: true });
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const statusParam = url.searchParams.get("status")?.trim().toLowerCase() ?? "all";
  const status = ALLOWED_STATUS.has(statusParam) ? statusParam : "all";
  const limitParam = Math.floor(Number(url.searchParams.get("limit")));
  const limit = Number.isFinite(limitParam) ? limitParam : 100;

  const commissions = await listAffiliateCommissionsForPartner(auth.session.affiliateId, {
    limit,
    status: status === "all" ? null : status,
  });

  return NextResponse.json({ success: true, commissions, filter: { status } });
}
