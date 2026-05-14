import { getServerSession } from "next-auth";
import type { Session } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function requireAuthenticatedDiscordId(): Promise<
  | { ok: true; discordId: string; session: Session }
  | { ok: false; response: Response }
> {
  const session = await getServerSession(authOptions);
  const discordId = session?.user?.id?.trim() ?? "";
  if (!session || !discordId) {
    return { ok: false, response: Response.json({ success: false, error: "Unauthorized" }, { status: 401 }) };
  }
  return { ok: true, discordId, session };
}

export async function requireDashboardSession(): Promise<
  | { ok: true; discordId: string; session: NonNullable<Awaited<ReturnType<typeof getServerSession>>> }
  | { ok: false; response: Response }
> {
  const r = await requireAuthenticatedDiscordId();
  if (!r.ok) return r;
  const s = r.session;
  if (!s?.user || s.user.hasDashboardAccess !== true) {
    return {
      ok: false,
      response: Response.json({ success: false, error: "Dashboard access required." }, { status: 403 }),
    };
  }
  return { ok: true, discordId: r.discordId, session: s };
}
