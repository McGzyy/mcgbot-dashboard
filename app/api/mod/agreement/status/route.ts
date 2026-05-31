import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { CURRENT_MOD_AGREEMENT_VERSION, modHasSignedCurrentAgreement } from "@/lib/mod/modAgreement";
import {
  ensureModStaffRecord,
  modStaffNeedsAgreement,
  modStaffPortalBlockedReason,
} from "@/lib/mod/modStaffDb";
import { requireModOrAdmin } from "@/lib/modStaffAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { meetsModerationMinTier, resolveEffectiveStaffTier } from "@/lib/helpRole";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  const discordId = session?.user?.id?.trim() ?? "";
  if (!discordId) {
    return Response.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const tier = await resolveEffectiveStaffTier(discordId, session?.user?.helpTier);
  const canModerate = meetsModerationMinTier(tier);
  if (!canModerate) {
    return Response.json({
      success: true,
      canModerate: false,
      needsAgreement: false,
      signedCurrent: false,
      agreementVersion: null,
      currentAgreementVersion: CURRENT_MOD_AGREEMENT_VERSION,
      staffStatus: null,
      portalReady: false,
      blockedReason: null,
    });
  }

  const auth = await requireModOrAdmin({ skipAgreement: true });
  if (!auth.ok) return auth.response;

  const displayName = typeof session?.user?.name === "string" ? session.user.name : null;
  const row = await ensureModStaffRecord({ discordId: auth.staffDiscordId, displayName });
  const blockedReason = modStaffPortalBlockedReason(row);
  const signedCurrent = row
    ? modHasSignedCurrentAgreement({
        agreementVersion: row.agreementVersion,
        agreementSignedAt: row.agreementSignedAt,
      })
    : false;

  return Response.json({
    success: true,
    canModerate: true,
    dbConfigured: !!getSupabaseAdmin(),
    needsAgreement: row ? modStaffNeedsAgreement(row) : true,
    signedCurrent,
    agreementVersion: row?.agreementVersion ?? null,
    agreementSignedAt: row?.agreementSignedAt ?? null,
    currentAgreementVersion: CURRENT_MOD_AGREEMENT_VERSION,
    staffStatus: row?.status ?? null,
    roleTier: row?.roleTier ?? null,
    portalReady: Boolean(row && row.status === "active" && signedCurrent && !blockedReason),
    blockedReason,
  });
}
