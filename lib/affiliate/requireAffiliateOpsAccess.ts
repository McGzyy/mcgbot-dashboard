import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isDashboardAdminUser } from "@/lib/adminGate";
import { getAffiliateOpsSessionFromCookies } from "@/lib/affiliate/affiliateOpsSession";

type Fail = { ok: false; response: Response };
type Ok = { ok: true; discordId: string };

/**
 * Affiliate ops APIs/pages: McGBot dashboard admin session + separate ops 2FA cookie.
 * Partners and regular members never pass this gate.
 */
export async function requireAffiliateOpsAdmin(): Promise<Ok | Fail> {
  const session = await getServerSession(authOptions);
  const discordId = session?.user?.id?.trim() ?? "";
  if (!discordId) {
    return { ok: false, response: Response.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  if (!(await isDashboardAdminUser(session, discordId))) {
    return { ok: false, response: Response.json({ error: "Forbidden" }, { status: 403 }) };
  }

  const ops = await getAffiliateOpsSessionFromCookies();
  if (!ops || ops.discordId !== discordId) {
    return {
      ok: false,
      response: Response.json(
        { error: "Affiliate ops 2FA required", code: "affiliate_ops_2fa_required" },
        { status: 403 }
      ),
    };
  }

  return { ok: true, discordId };
}
