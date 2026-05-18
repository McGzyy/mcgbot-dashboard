import { NextResponse } from "next/server";
import { listPendingMilestoneGrantsForAdmin } from "@/lib/affiliate/affiliateMilestones";
import { requireAffiliateOpsAdmin } from "@/lib/affiliate/requireAffiliateOpsAccess";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const gate = await requireAffiliateOpsAdmin();
  if (!gate.ok) return gate.response;
  const grants = await listPendingMilestoneGrantsForAdmin();
  return NextResponse.json({ success: true, grants });
}
