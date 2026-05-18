import { NextResponse } from "next/server";
import { approveMilestoneGrant } from "@/lib/affiliate/affiliateMilestones";
import { requireAffiliateOpsAdmin } from "@/lib/affiliate/requireAffiliateOpsAccess";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  _request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const gate = await requireAffiliateOpsAdmin();
  if (!gate.ok) return gate.response;

  const { id } = await ctx.params;
  const ok = await approveMilestoneGrant({
    grantId: id,
    reviewerDiscordId: gate.discordId,
  });
  if (!ok) {
    return NextResponse.json({ success: false, error: "Could not approve grant." }, { status: 400 });
  }
  return NextResponse.json({ success: true });
}
