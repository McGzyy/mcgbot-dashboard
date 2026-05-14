import { requireDashboardSession } from "@/lib/requireDashboardSession";
import { fetchTotpRow, totpServiceAvailable } from "@/lib/dashboardTotpUser";
import { regenerateRecoveryCodes } from "@/lib/totpRecoveryCodes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Generate a fresh set of one-time recovery codes (invalidates unused previous codes). */
export async function POST() {
  const auth = await requireDashboardSession();
  if (!auth.ok) return auth.response;
  if (!totpServiceAvailable()) {
    return Response.json({ success: false, error: "TOTP is not configured on this server." }, { status: 503 });
  }
  const row = await fetchTotpRow(auth.discordId);
  if (!row?.totp_enabled) {
    return Response.json({ success: false, error: "Enable authenticator 2FA before generating recovery codes." }, { status: 400 });
  }
  const codes = await regenerateRecoveryCodes(auth.discordId);
  if (!codes) {
    return Response.json({ success: false, error: "Could not generate recovery codes." }, { status: 500 });
  }
  return Response.json({ success: true, codes });
}
