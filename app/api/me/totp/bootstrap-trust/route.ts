import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { requireAuthenticatedDiscordId } from "@/lib/requireDashboardSession";
import { createTotpSessionProof } from "@/lib/totpSessionProof";
import { parseTotpDeviceTrustCookieValue, TOTP_DEVICE_TRUST_COOKIE } from "@/lib/totpDeviceTrustCookie";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * After a new Discord OAuth login the JWT drops `totpTrustExpiresAt`. A signed httpOnly cookie
 * (set when the user chose “remember this browser”) restores trust by issuing a one-time proof.
 */
export async function POST() {
  const auth = await requireAuthenticatedDiscordId();
  if (!auth.ok) return auth.response;

  const pending =
    (auth.session?.user as { pendingTotpVerification?: boolean } | undefined)?.pendingTotpVerification === true;
  if (!pending) {
    return NextResponse.json({ success: false, error: "TOTP verification is not pending." }, { status: 400 });
  }

  const jar = await cookies();
  const raw = jar.get(TOTP_DEVICE_TRUST_COOKIE)?.value;
  const parsed = parseTotpDeviceTrustCookieValue(raw);
  if (!parsed || parsed.discordId !== auth.discordId || parsed.expMs <= Date.now()) {
    return NextResponse.json({ success: false }, { status: 404 });
  }

  const proofId = await createTotpSessionProof(auth.discordId, { trustExpiresAtMs: parsed.expMs });
  if (!proofId) {
    return NextResponse.json({ success: false, error: "Could not issue session proof." }, { status: 500 });
  }

  return NextResponse.json({ success: true, proofId });
}
