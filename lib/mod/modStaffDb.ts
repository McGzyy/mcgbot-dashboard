import {
  CURRENT_MOD_AGREEMENT_VERSION,
  modHasSignedCurrentAgreement,
} from "@/lib/mod/modAgreement";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export type ModStaffStatus = "invited" | "active" | "suspended" | "terminated";
export type ModStaffRoleTier = "mod" | "head_mod";
export type ModActionAuditAction = "approved" | "denied" | "excluded" | "other";

export type ModStaffRow = {
  discordId: string;
  displayName: string | null;
  status: ModStaffStatus;
  roleTier: ModStaffRoleTier;
  agreementVersion: string | null;
  agreementSignedAt: string | null;
  invitedAt: string;
  activatedAt: string | null;
  stipendCents: number | null;
  payoutNotes: string | null;
  createdAt: string;
  updatedAt: string;
};

const MOD_STAFF_SELECT =
  "discord_id, display_name, status, role_tier, agreement_version, agreement_signed_at, invited_at, activated_at, stipend_cents, payout_notes, created_at, updated_at";

function mapModStaffRow(data: Record<string, unknown>): ModStaffRow | null {
  const discordId = typeof data.discord_id === "string" ? data.discord_id.trim() : "";
  if (!discordId) return null;
  const status = data.status;
  if (status !== "invited" && status !== "active" && status !== "suspended" && status !== "terminated") {
    return null;
  }
  const roleTier = data.role_tier;
  if (roleTier !== "mod" && roleTier !== "head_mod") return null;
  const stipendRaw = data.stipend_cents;
  const stipendCents =
    stipendRaw == null
      ? null
      : Number.isFinite(Number(stipendRaw))
        ? Math.floor(Number(stipendRaw))
        : null;

  return {
    discordId,
    displayName:
      typeof data.display_name === "string" && data.display_name.trim()
        ? data.display_name.trim()
        : null,
    status,
    roleTier,
    agreementVersion:
      typeof data.agreement_version === "string" ? data.agreement_version.trim() : null,
    agreementSignedAt:
      typeof data.agreement_signed_at === "string" ? data.agreement_signed_at : null,
    invitedAt: typeof data.invited_at === "string" ? data.invited_at : "",
    activatedAt: typeof data.activated_at === "string" ? data.activated_at : null,
    stipendCents,
    payoutNotes: typeof data.payout_notes === "string" ? data.payout_notes : null,
    createdAt: typeof data.created_at === "string" ? data.created_at : "",
    updatedAt: typeof data.updated_at === "string" ? data.updated_at : "",
  };
}

export function modStaffNeedsAgreement(row: Pick<ModStaffRow, "agreementVersion" | "agreementSignedAt">): boolean {
  return !modHasSignedCurrentAgreement({
    agreementVersion: row.agreementVersion,
    agreementSignedAt: row.agreementSignedAt,
  });
}

export function modStaffPortalBlockedReason(row: ModStaffRow | null): string | null {
  if (!row) return null;
  if (row.status === "suspended") {
    return "Your staff access is suspended. Contact an admin if you believe this is an error.";
  }
  if (row.status === "terminated") {
    return "Your staff roster access has ended. Contact an admin for questions.";
  }
  return null;
}

export function modStaffCanUsePortal(row: ModStaffRow | null): boolean {
  return isActiveModWithSignedAgreement(row);
}

/** Active mod with current agreement signed (queue APIs). */
export function isActiveModWithSignedAgreement(row: ModStaffRow | null): boolean {
  if (!row || row.status !== "active") return false;
  return !modStaffNeedsAgreement(row);
}

export async function getModStaffByDiscordId(discordId: string): Promise<ModStaffRow | null> {
  const id = discordId.trim();
  if (!id) return null;
  const db = getSupabaseAdmin();
  if (!db) return null;
  const { data, error } = await db.from("mod_staff").select(MOD_STAFF_SELECT).eq("discord_id", id).maybeSingle();
  if (error) {
    console.error("[modStaffDb] get", error);
    return null;
  }
  if (!data || typeof data !== "object") return null;
  return mapModStaffRow(data as Record<string, unknown>);
}

export async function ensureModStaffRecord(input: {
  discordId: string;
  displayName?: string | null;
  roleTier?: ModStaffRoleTier;
}): Promise<ModStaffRow | null> {
  const id = input.discordId.trim();
  if (!id) return null;
  const existing = await getModStaffByDiscordId(id);
  if (existing) {
    if (input.displayName?.trim() && input.displayName.trim() !== existing.displayName) {
      const db = getSupabaseAdmin();
      if (!db) return existing;
      const now = new Date().toISOString();
      await db
        .from("mod_staff")
        .update({ display_name: input.displayName.trim(), updated_at: now })
        .eq("discord_id", id);
      return { ...existing, displayName: input.displayName.trim(), updatedAt: now };
    }
    return existing;
  }

  const db = getSupabaseAdmin();
  if (!db) return null;
  const now = new Date().toISOString();
  const { data, error } = await db
    .from("mod_staff")
    .insert({
      discord_id: id,
      display_name: input.displayName?.trim() || null,
      status: "invited",
      role_tier: input.roleTier ?? "mod",
      invited_at: now,
      created_at: now,
      updated_at: now,
    })
    .select(MOD_STAFF_SELECT)
    .maybeSingle();

  if (error) {
    console.error("[modStaffDb] ensure insert", error);
    return null;
  }
  if (!data || typeof data !== "object") return null;
  return mapModStaffRow(data as Record<string, unknown>);
}

export type RecordModSignatureResult =
  | { ok: true }
  | { ok: false; code: "DB_NOT_CONFIGURED" | "TABLE_MISSING" | "STAFF_BLOCKED" | "WRITE_FAILED"; message: string };

function modStaffWriteFailure(error: { message?: string; code?: string }): RecordModSignatureResult {
  const msg = (error.message ?? "").toLowerCase();
  console.error("[modStaffDb] write", error);
  if (msg.includes("does not exist") || error.code === "42P01") {
    return {
      ok: false,
      code: "TABLE_MISSING",
      message:
        "The mod staff database table is not set up yet. Ask an admin to run supabase/migrations/20260531120000_mod_staff_agreement.sql in the Supabase SQL editor, then try again.",
    };
  }
  if (msg.includes("permission denied") || error.code === "42501") {
    return {
      ok: false,
      code: "WRITE_FAILED",
      message:
        "Database permissions blocked saving your signature. Ask an admin to re-run the mod_staff migration grants.",
    };
  }
  return {
    ok: false,
    code: "WRITE_FAILED",
    message: "Could not record signature. Try again or contact an admin.",
  };
}

export async function recordModAgreementSignature(
  discordId: string,
  displayName?: string | null
): Promise<RecordModSignatureResult> {
  const id = discordId.trim();
  if (!id) {
    return { ok: false, code: "WRITE_FAILED", message: "Invalid staff account." };
  }
  const db = getSupabaseAdmin();
  if (!db) {
    return {
      ok: false,
      code: "DB_NOT_CONFIGURED",
      message: "Server database is not configured (Supabase env missing). Contact an admin.",
    };
  }

  const now = new Date().toISOString();
  const existing = await getModStaffByDiscordId(id);
  if (existing?.status === "suspended" || existing?.status === "terminated") {
    return {
      ok: false,
      code: "STAFF_BLOCKED",
      message: modStaffPortalBlockedReason(existing) ?? "Your staff access is not active.",
    };
  }

  const signaturePatch = {
    agreement_version: CURRENT_MOD_AGREEMENT_VERSION,
    agreement_signed_at: now,
    status: "active" as const,
    activated_at: existing?.activatedAt ?? now,
    updated_at: now,
    ...(displayName?.trim() ? { display_name: displayName.trim() } : {}),
  };

  if (existing) {
    const { data, error } = await db
      .from("mod_staff")
      .update(signaturePatch)
      .eq("discord_id", id)
      .select("discord_id")
      .maybeSingle();
    if (error) return modStaffWriteFailure(error);
    if (!data) {
      return { ok: false, code: "WRITE_FAILED", message: "Could not update your staff roster row." };
    }
    return { ok: true };
  }

  const { data, error } = await db
    .from("mod_staff")
    .insert({
      discord_id: id,
      display_name: displayName?.trim() || null,
      status: "active",
      role_tier: "mod",
      invited_at: now,
      created_at: now,
      ...signaturePatch,
    })
    .select("discord_id")
    .maybeSingle();

  if (error) {
    if (error.code === "23505") {
      const retry = await db
        .from("mod_staff")
        .update(signaturePatch)
        .eq("discord_id", id)
        .select("discord_id")
        .maybeSingle();
      if (retry.error) return modStaffWriteFailure(retry.error);
      if (!retry.data) {
        return { ok: false, code: "WRITE_FAILED", message: "Could not update your staff roster row." };
      }
      return { ok: true };
    }
    return modStaffWriteFailure(error);
  }
  if (!data) {
    return { ok: false, code: "WRITE_FAILED", message: "Could not create your staff roster row." };
  }
  return { ok: true };
}

export async function listModStaffRoster(): Promise<ModStaffRow[]> {
  const db = getSupabaseAdmin();
  if (!db) return [];
  const { data, error } = await db
    .from("mod_staff")
    .select(MOD_STAFF_SELECT)
    .order("updated_at", { ascending: false })
    .limit(500);
  if (error) {
    console.error("[modStaffDb] list", error);
    return [];
  }
  if (!Array.isArray(data)) return [];
  return data
    .map((row) =>
      row && typeof row === "object" ? mapModStaffRow(row as Record<string, unknown>) : null
    )
    .filter((r): r is ModStaffRow => r != null);
}

export async function insertModActionAudit(input: {
  discordId: string;
  action: ModActionAuditAction;
  subjectType?: string | null;
  subjectId?: string | null;
  detail?: Record<string, unknown>;
}): Promise<void> {
  const id = input.discordId.trim();
  if (!id) return;
  const db = getSupabaseAdmin();
  if (!db) return;
  const { error } = await db.from("mod_action_audit").insert({
    discord_id: id,
    action: input.action,
    subject_type: input.subjectType?.trim() || null,
    subject_id: input.subjectId?.trim() || null,
    detail: input.detail ?? {},
  });
  if (error) {
    console.error("[modStaffDb] audit insert", error);
  }
}

export function callDecisionToAuditAction(
  decision: string
): ModActionAuditAction | null {
  const d = decision.toLowerCase().trim();
  if (d === "approve") return "approved";
  if (d === "deny") return "denied";
  if (d === "exclude") return "excluded";
  return null;
}
