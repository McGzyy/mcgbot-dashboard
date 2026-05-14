import { requireDashboardSession } from "@/lib/requireDashboardSession";
import { fetchTotpRow, startTotpEnrollment, totpServiceAvailable } from "@/lib/dashboardTotpUser";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const auth = await requireDashboardSession();
  if (!auth.ok) return auth.response;
  if (!totpServiceAvailable()) {
    return Response.json(
      { success: false, error: "Authenticator 2FA is not configured on this server (missing TOTP_ENCRYPTION_KEY)." },
      { status: 503 }
    );
  }
  const row = await fetchTotpRow(auth.discordId);
  if (!row) return Response.json({ success: false, error: "User not found." }, { status: 404 });
  if (row.totp_enabled) {
    return Response.json({ success: false, error: "TOTP is already enabled. Disable it first to re-enroll." }, { status: 400 });
  }
  const started = await startTotpEnrollment(auth.discordId);
  if (!started) {
    return Response.json({ success: false, error: "Could not start enrollment." }, { status: 500 });
  }
  return Response.json({
    success: true,
    secret: started.secret,
    otpauthUrl: started.otpauthUrl,
  });
}
