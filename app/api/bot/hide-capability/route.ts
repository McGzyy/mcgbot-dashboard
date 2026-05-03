import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { hasAccess } from "@/lib/hasAccess";
import { resolveHelpTierAsync } from "@/lib/helpRole";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Whether the signed-in user may hide bot calls from the dashboard (mods/admins, same gate as bot internal API).
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  const discordId = session?.user?.id?.trim() ?? "";
  if (!discordId) {
    return Response.json({ ok: false, canHide: false }, { status: 401 });
  }
  const tape = await hasAccess(discordId, "view_bot_calls");
  if (!tape) {
    return Response.json({ ok: true, canHide: false });
  }
  const tier = await resolveHelpTierAsync(discordId);
  return Response.json({ ok: true, canHide: tier === "mod" || tier === "admin" });
}
