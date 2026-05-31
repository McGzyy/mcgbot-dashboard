import { createClient } from "@supabase/supabase-js";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  meetsModerationMinTier,
  moderationStaffForbiddenPayload,
  resolveEffectiveStaffTier,
} from "@/lib/helpRole";
import {
  ensureModStaffRecord,
  isActiveModWithSignedAgreement,
  modStaffPortalBlockedReason,
} from "@/lib/mod/modStaffDb";

export function createModServiceSupabase() {
  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) return null;
  return createClient(url, key);
}

export type RequireModOrAdminOptions = {
  /** Agreement + active roster not required (e.g. agreement sign/status). */
  skipAgreement?: boolean;
};

async function assertModStaffAgreementGate(
  staffDiscordId: string,
  displayName?: string | null
): Promise<{ ok: true } | { ok: false; response: Response }> {
  const row =
    (await ensureModStaffRecord({
      discordId: staffDiscordId,
      displayName,
    })) ?? null;
  const blocked = modStaffPortalBlockedReason(row);
  if (blocked) {
    return {
      ok: false,
      response: Response.json(
        {
          success: false,
          error: blocked,
          code: "MOD_STAFF_SUSPENDED",
        },
        { status: 403 }
      ),
    };
  }
  if (!isActiveModWithSignedAgreement(row)) {
    return {
      ok: false,
      response: Response.json(
        {
          success: false,
          error: "Sign the current McGBot staff moderator agreement to use moderation tools.",
          code: "MOD_AGREEMENT_REQUIRED",
          redirectTo: "/moderation/agreement",
        },
        { status: 403 }
      ),
    };
  }
  return { ok: true };
}

/** Staff-only (mod or admin). */
export async function requireModOrAdmin(
  options?: RequireModOrAdminOptions
): Promise<{ ok: true; staffDiscordId: string } | { ok: false; response: Response }> {
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
  if (!options?.skipAgreement) {
    const name =
      typeof session?.user?.name === "string" ? session.user.name : null;
    const gate = await assertModStaffAgreementGate(staffDiscordId, name);
    if (!gate.ok) return gate;
  }
  return { ok: true, staffDiscordId };
}

/** Staff gate for bot-proxy mod routes (`/api/mod/queue`, call-decision, stats). */
export async function requireModBotProxySession(): Promise<
  | { ok: true; userId: string }
  | { ok: false; response: Response }
> {
  const auth = await requireModOrAdmin();
  if (!auth.ok) return auth;
  return { ok: true, userId: auth.staffDiscordId };
}
