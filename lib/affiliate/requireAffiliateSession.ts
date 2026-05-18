import {
  affiliateSessionFullyVerified,
  getAffiliateSessionFromCookies,
  type AffiliateSessionClaims,
} from "@/lib/affiliate/affiliateSession";

type Fail = { ok: false; response: Response };
type Ok = { ok: true; session: AffiliateSessionClaims };

export async function requireAffiliateSession(options?: {
  requireVerified?: boolean;
}): Promise<Ok | Fail> {
  const session = await getAffiliateSessionFromCookies();
  if (!session) {
    return { ok: false, response: Response.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  if (session.status === "suspended") {
    return { ok: false, response: Response.json({ error: "Account suspended" }, { status: 403 }) };
  }
  if (options?.requireVerified && !affiliateSessionFullyVerified(session)) {
    return { ok: false, response: Response.json({ error: "2FA required" }, { status: 403 }) };
  }
  return { ok: true, session };
}
