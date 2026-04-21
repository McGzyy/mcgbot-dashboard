import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { meetsModerationMinTier, resolveHelpTierAsync } from "@/lib/helpRole";

type Fail = { ok: false; response: Response };
type Ok = { ok: true; discordId: string; tier: "mod" | "admin" };

export async function requireDashboardStaff(): Promise<Ok | Fail> {
  const session = await getServerSession(authOptions);
  const id = session?.user?.id?.trim();
  if (!id) {
    return { ok: false, response: Response.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  const tier = await resolveHelpTierAsync(id);
  if (!meetsModerationMinTier(tier)) {
    return { ok: false, response: Response.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { ok: true, discordId: id, tier: tier === "admin" ? "admin" : "mod" };
}

