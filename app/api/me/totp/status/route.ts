import { requireAuthenticatedDiscordId } from "@/lib/requireDashboardSession";
import { fetchTotpRow } from "@/lib/dashboardTotpUser";
import { totpServiceAvailable } from "@/lib/dashboardTotpUser";

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
  return Response.json({
    success: true,
    configured: true,
    enabled: row.totp_enabled === true,
    pendingSetup: Boolean(row.totp_pending_enc) && !row.totp_enabled,
  });
}
