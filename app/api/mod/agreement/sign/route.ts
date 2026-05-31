import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { CURRENT_MOD_AGREEMENT_VERSION } from "@/lib/mod/modAgreement";
import { recordModAgreementSignature } from "@/lib/mod/modStaffDb";
import { requireModOrAdmin } from "@/lib/modStaffAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const auth = await requireModOrAdmin({ skipAgreement: true });
  if (!auth.ok) return auth.response;

  const body = (await request.json().catch(() => null)) as { accepted?: boolean } | null;
  if (body?.accepted !== true) {
    return NextResponse.json({ success: false, error: "You must accept the staff agreement." }, { status: 400 });
  }

  const session = await getServerSession(authOptions);
  const displayName = typeof session?.user?.name === "string" ? session.user.name : null;
  const signed = await recordModAgreementSignature(auth.staffDiscordId, displayName);
  if (!signed.ok) {
    return NextResponse.json(
      { success: false, error: signed.message, code: signed.code },
      { status: signed.code === "STAFF_BLOCKED" ? 403 : 500 }
    );
  }

  return NextResponse.json({
    success: true,
    agreementVersion: CURRENT_MOD_AGREEMENT_VERSION,
    redirectTo: "/moderation",
  });
}
