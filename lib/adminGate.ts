import type { Session } from "next-auth";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { resolveHelpTierAsync } from "@/lib/helpRole";

type Fail = { ok: false; response: Response };
type Ok = { ok: true; discordId: string };

function sessionHelpTier(session: Session | null): string | undefined {
  const u = session?.user as { helpTier?: string } | undefined;
  const t = typeof u?.helpTier === "string" ? u.helpTier.trim().toLowerCase() : "";
  return t === "admin" || t === "mod" || t === "user" ? t : undefined;
}

/**
 * Admin shell + APIs: allow if the JWT already says `admin` (matches sidebar / layout UX) **or**
 * a fresh `resolveHelpTierAsync` says admin. This avoids 403s when the in-memory tier cache or refresh
 * timing disagrees with the session the user just used to open `/admin/*`.
 */
export async function isDashboardAdminUser(session: Session | null, discordId: string): Promise<boolean> {
  if (sessionHelpTier(session) === "admin") return true;
  const live = await resolveHelpTierAsync(discordId.trim());
  return live === "admin";
}

export async function requireDashboardAdmin(): Promise<Ok | Fail> {
  const session = await getServerSession(authOptions);
  const id = session?.user?.id?.trim();
  if (!id) {
    return { ok: false, response: Response.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  if (!(await isDashboardAdminUser(session, id))) {
    return { ok: false, response: Response.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { ok: true, discordId: id };
}
