import { requireAuthenticatedDiscordId } from "@/lib/requireDashboardSession";
import { verifyActiveTotpForSignIn } from "@/lib/dashboardTotpUser";
import { createTotpSessionProof } from "@/lib/totpSessionProof";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const auth = await requireAuthenticatedDiscordId();
  if (!auth.ok) return auth.response;
  const pending = (auth.session?.user as { pendingTotpVerification?: boolean } | undefined)?.pendingTotpVerification === true;
  if (!pending) {
    return Response.json({ success: false, error: "TOTP verification is not required for this session." }, { status: 400 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ success: false, error: "Invalid JSON." }, { status: 400 });
  }
  const code = typeof (body as { code?: unknown })?.code === "string" ? (body as { code: string }).code : "";
  const v = await verifyActiveTotpForSignIn(auth.discordId, code);
  if (!v.ok) {
    return Response.json({ success: false, error: v.error }, { status: 400 });
  }
  const proofId = await createTotpSessionProof(auth.discordId);
  if (!proofId) {
    return Response.json({ success: false, error: "Could not issue session proof." }, { status: 500 });
  }
  return Response.json({ success: true, proofId });
}
