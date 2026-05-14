import { requireAuthenticatedDiscordId } from "@/lib/requireDashboardSession";
import { verifyTotpOrRecoveryForSignIn } from "@/lib/totpRecoveryCodes";
import { createTotpSessionProof } from "@/lib/totpSessionProof";
import {
  assertTotpVerifyAllowed,
  clearTotpVerifyThrottle,
  recordTotpVerifyFailure,
} from "@/lib/totpVerifyThrottle";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const REMEMBER_MS = 30 * 24 * 60 * 60 * 1000;

export async function POST(request: Request) {
  const auth = await requireAuthenticatedDiscordId();
  if (!auth.ok) return auth.response;
  const pending =
    (auth.session?.user as { pendingTotpVerification?: boolean } | undefined)?.pendingTotpVerification === true;
  if (!pending) {
    return Response.json(
      { success: false, error: "TOTP verification is not required for this session." },
      { status: 400 }
    );
  }

  const throttle = await assertTotpVerifyAllowed(auth.discordId);
  if (!throttle.ok) {
    return Response.json(
      { success: false, error: `Too many attempts. Try again in ${throttle.retryAfterSec} seconds.` },
      { status: 429 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ success: false, error: "Invalid JSON." }, { status: 400 });
  }
  const o = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const code = typeof o.code === "string" ? o.code : "";
  const rememberDevice = o.rememberDevice === true || o.rememberDevice === "true" || o.rememberDevice === 1;

  const v = await verifyTotpOrRecoveryForSignIn(auth.discordId, code);
  if (!v.ok) {
    await recordTotpVerifyFailure(auth.discordId);
    return Response.json({ success: false, error: v.error }, { status: 400 });
  }

  await clearTotpVerifyThrottle(auth.discordId);

  const trustExpiresAtMs = rememberDevice ? Date.now() + REMEMBER_MS : null;
  const proofId = await createTotpSessionProof(auth.discordId, { trustExpiresAtMs });
  if (!proofId) {
    return Response.json({ success: false, error: "Could not issue session proof." }, { status: 500 });
  }
  return Response.json({ success: true, proofId });
}
