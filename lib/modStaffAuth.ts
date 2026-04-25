import { createClient } from "@supabase/supabase-js";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { resolveHelpTierAsync } from "@/lib/helpRole";

export function createModServiceSupabase() {
  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) return null;
  return createClient(url, key);
}

/** Staff-only (mod or admin). */
export async function requireModOrAdmin(): Promise<
  | { ok: true; staffDiscordId: string }
  | { ok: false; response: Response }
> {
  const session = await getServerSession(authOptions);
  const staffDiscordId = session?.user?.id?.trim() ?? "";
  if (!staffDiscordId) {
    return {
      ok: false,
      response: Response.json({ success: false, error: "Unauthorized" }, { status: 401 }),
    };
  }
  const tier = await resolveHelpTierAsync(staffDiscordId);
  if (tier !== "mod" && tier !== "admin") {
    return {
      ok: false,
      response: Response.json({ success: false, error: "Forbidden" }, { status: 403 }),
    };
  }
  return { ok: true, staffDiscordId };
}
