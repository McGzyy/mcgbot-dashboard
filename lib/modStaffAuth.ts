import { createClient } from "@supabase/supabase-js";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  meetsModerationMinTier,
  moderationStaffForbiddenPayload,
  resolveEffectiveStaffTier,
} from "@/lib/helpRole";

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
  const tier = await resolveEffectiveStaffTier(staffDiscordId, session?.user?.helpTier);
  if (!meetsModerationMinTier(tier)) {
    return {
      ok: false,
      response: Response.json({ success: false, ...moderationStaffForbiddenPayload() }, { status: 403 }),
    };
  }
  return { ok: true, staffDiscordId };
}

/** Staff gate for bot-proxy mod routes (`/api/mod/queue`, call-decision, stats). */
export async function requireModBotProxySession(): Promise<
  | { ok: true; userId: string }
  | { ok: false; response: Response }
> {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id?.trim() ?? "";
  if (!userId) {
    return { ok: false, response: Response.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  const tier = await resolveEffectiveStaffTier(userId, session?.user?.helpTier);
  if (!meetsModerationMinTier(tier)) {
    return {
      ok: false,
      response: Response.json(moderationStaffForbiddenPayload(), { status: 403 }),
    };
  }
  return { ok: true, userId };
}
