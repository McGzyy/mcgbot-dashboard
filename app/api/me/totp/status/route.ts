import { requireAuthenticatedDiscordId } from "@/lib/requireDashboardSession";
import { fetchTotpRow, totpServiceAvailable } from "@/lib/dashboardTotpUser";
import { countUnusedRecoveryCodes } from "@/lib/totpRecoveryCodes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireAuthenticatedDiscordId();
  if (!auth.ok) return auth.response;
  if (!totpServiceAvailable()) {
    return Response.json({
      success: true,
      configured: false,
      enabled: false,
      pendingSetup: false,
    });
  }
  const row = await fetchTotpRow(auth.discordId);
  if (!row) {
    return Response.json({ success: false, error: "User not found." }, { status: 404 });
  }
  const unusedRecoveryCount = row.totp_enabled ? await countUnusedRecoveryCodes(auth.discordId) : 0;
  return Response.json({
    success: true,
    configured: true,
    enabled: row.totp_enabled === true,
    pendingSetup: Boolean(row.totp_pending_enc) && !row.totp_enabled,
    unusedRecoveryCount,
  });
}
