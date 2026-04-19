import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { resolveHelpTierAsync } from "@/lib/helpRole";

type Fail = { ok: false; response: Response };
type Ok = { ok: true; discordId: string };

export async function requireDashboardAdmin(): Promise<Ok | Fail> {
  const session = await getServerSession(authOptions);
  const id = session?.user?.id?.trim();
  if (!id) {
    return { ok: false, response: Response.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  const tier = await resolveHelpTierAsync(id);
  if (tier !== "admin") {
    return { ok: false, response: Response.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { ok: true, discordId: id };
}
