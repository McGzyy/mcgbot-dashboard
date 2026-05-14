import { requireDashboardSession } from "@/lib/requireDashboardSession";
import { finishTotpEnrollment, totpServiceAvailable } from "@/lib/dashboardTotpUser";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const auth = await requireDashboardSession();
  if (!auth.ok) return auth.response;
  if (!totpServiceAvailable()) {
    return Response.json({ success: false, error: "TOTP is not configured on this server." }, { status: 503 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ success: false, error: "Invalid JSON." }, { status: 400 });
  }
  const code = typeof (body as { code?: unknown })?.code === "string" ? (body as { code: string }).code : "";
  const res = await finishTotpEnrollment(auth.discordId, code);
  if (!res.ok) {
    return Response.json({ success: false, error: res.error }, { status: 400 });
  }
  return Response.json({ success: true, recoveryCodes: res.recoveryCodes });
}
