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
  const roleTier = data.role_tier === "head_mod" ? "head_mod" : "mod";
  const statusRaw = data.status;
  const status: ModStaffStatus =
    statusRaw === "active" ||
    statusRaw === "suspended" ||
    statusRaw === "terminated" ||
    statusRaw === "invited"
      ? statusRaw
      : "invited";
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
  | {
      ok: false;
      code: "DB_NOT_CONFIGURED" | "TABLE_MISSING" | "SCHEMA_CACHE" | "STAFF_BLOCKED" | "WRITE_FAILED";
      message: string;
    };

export type ModStaffDbProbe = {
  configured: boolean;
  reachable: boolean;
  code: string | null;
  message: string | null;
  supabaseHost: string | null;
};

function supabaseHostFromEnv(): string | null {
  const url = process.env.SUPABASE_URL?.trim();
  if (!url) return null;
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

function isPostgrestSchemaCacheError(error: { message?: string; code?: string }): boolean {
  if (error.code === "PGRST205") return true;
  return /could not find the table .* in the schema cache/i.test(error.message ?? "");
}

function classifyModStaffDbError(error: { message?: string; code?: string; details?: string }): {
  code: "TABLE_MISSING" | "SCHEMA_CACHE" | "WRITE_FAILED";
  message: string;
} {
  const msg = (error.message ?? "").toLowerCase();
  const detail = typeof error.details === "string" && error.details.trim() ? error.details.trim() : null;
  const host = supabaseHostFromEnv();

  if (isPostgrestSchemaCacheError(error)) {
    return {
      code: "SCHEMA_CACHE",
      message:
        "Supabase API has not picked up mod_staff yet. In the same project's SQL editor run: NOTIFY pgrst, 'reload schema'; wait 30 seconds, then try again." +
        (host ? ` Dashboard is using ${host}.` : ""),
    };
  }

  if (msg.includes("does not exist") || error.code === "42P01") {
    return {
      code: "TABLE_MISSING",
      message:
        "mod_staff is missing in the Supabase project the dashboard connects to. Run 20260531120000_mod_staff_agreement.sql and 20260531120100_mod_staff_service_grants.sql in that project's SQL editor" +
        (host ? ` (${host}).` : "."),
    };
  }

  if (msg.includes("permission denied") || error.code === "42501") {
    return {
      code: "WRITE_FAILED",
      message:
        "Database permissions blocked mod_staff writes. Re-run 20260531120100_mod_staff_service_grants.sql, then NOTIFY pgrst, 'reload schema';",
    };
  }

  return {
    code: "WRITE_FAILED",
    message: detail
      ? `Could not record signature (${detail}). Try again or contact an admin.`
      : error.message?.trim()
        ? `Could not record signature: ${error.message.trim()}`
        : "Could not record signature. Try again or contact an admin.",
  };
}

function modStaffWriteFailure(error: { message?: string; code?: string; details?: string }): RecordModSignatureResult {
  console.error("[modStaffDb] write", error);
  return { ok: false, ...classifyModStaffDbError(error) };
}

/** Lightweight health check — surfaces PostgREST schema cache vs missing table. */
export async function probeModStaffDb(): Promise<ModStaffDbProbe> {
  const host = supabaseHostFromEnv();
  const db = getSupabaseAdmin();
  if (!db) {
    return {
      configured: false,
      reachable: false,
      code: "DB_NOT_CONFIGURED",
      message: "SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing on the dashboard server.",
      supabaseHost: host,
    };
  }

  const { error } = await db.from("mod_staff").select("discord_id").limit(1);
  if (!error) {
    return { configured: true, reachable: true, code: null, message: null, supabaseHost: host };
  }

  console.error("[modStaffDb] probe", error);
  const classified = classifyModStaffDbError(error);
  return {
    configured: true,
    reachable: false,
    code: classified.code,
    message: classified.message,
    supabaseHost: host,
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

  const upsertRow = {
    discord_id: id,
    display_name: displayName?.trim() || existing?.displayName || null,
    status: "active" as const,
    role_tier: existing?.roleTier ?? ("mod" as const),
    agreement_version: CURRENT_MOD_AGREEMENT_VERSION,
    agreement_signed_at: now,
    invited_at: existing?.invitedAt || now,
    activated_at: existing?.activatedAt || now,
    created_at: existing?.createdAt || now,
    updated_at: now,
  };

  const { error } = await db.from("mod_staff").upsert(upsertRow, { onConflict: "discord_id" });
  if (error) return modStaffWriteFailure(error);

  const verified = await getModStaffByDiscordId(id);
  if (!verified || verified.status !== "active" || modStaffNeedsAgreement(verified)) {
    const probe = await probeModStaffDb();
    if (!probe.reachable && probe.message) {
      return { ok: false, code: probe.code === "SCHEMA_CACHE" ? "SCHEMA_CACHE" : "WRITE_FAILED", message: probe.message };
    }
    return {
      ok: false,
      code: "WRITE_FAILED",
      message:
        "Signature saved but could not be verified. Confirm mod_staff grants migration ran, then refresh and try again.",
    };
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

export type ModActionAuditEntry = {
  id: string;
  discordId: string;
  action: ModActionAuditAction;
  subjectType: string | null;
  subjectId: string | null;
  detail: Record<string, unknown>;
  createdAt: string;
};

export type ModStaffPayoutRow = {
  id: string;
  discordId: string;
  amountCents: number;
  periodLabel: string | null;
  status: "pending" | "paid" | "voided";
  txReference: string | null;
  paidAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

const MOD_AUDIT_SELECT =
  "id, discord_id, action, subject_type, subject_id, detail, created_at";

function mapModActionAuditRow(data: Record<string, unknown>): ModActionAuditEntry | null {
  const id = typeof data.id === "string" ? data.id : "";
  const discordId = typeof data.discord_id === "string" ? data.discord_id.trim() : "";
  const action = data.action;
  if (!id || !discordId) return null;
  if (action !== "approved" && action !== "denied" && action !== "excluded" && action !== "other") {
    return null;
  }
  return {
    id,
    discordId,
    action,
    subjectType: typeof data.subject_type === "string" ? data.subject_type : null,
    subjectId: typeof data.subject_id === "string" ? data.subject_id : null,
    detail:
      data.detail && typeof data.detail === "object" && !Array.isArray(data.detail)
        ? (data.detail as Record<string, unknown>)
        : {},
    createdAt: typeof data.created_at === "string" ? data.created_at : "",
  };
}

function mapModStaffPayoutRow(data: Record<string, unknown>): ModStaffPayoutRow | null {
  const id = typeof data.id === "string" ? data.id : "";
  const discordId = typeof data.discord_id === "string" ? data.discord_id.trim() : "";
  if (!id || !discordId) return null;
  const status = data.status;
  if (status !== "pending" && status !== "paid" && status !== "voided") return null;
  const amountRaw = data.amount_cents;
  const amountCents = Number.isFinite(Number(amountRaw)) ? Math.floor(Number(amountRaw)) : 0;
  return {
    id,
    discordId,
    amountCents,
    periodLabel: typeof data.period_label === "string" ? data.period_label : null,
    status,
    txReference: typeof data.tx_reference === "string" ? data.tx_reference : null,
    paidAt: typeof data.paid_at === "string" ? data.paid_at : null,
    notes: typeof data.notes === "string" ? data.notes : null,
    createdAt: typeof data.created_at === "string" ? data.created_at : "",
    updatedAt: typeof data.updated_at === "string" ? data.updated_at : "",
  };
}

export async function listModActionAudit(input?: {
  discordId?: string | null;
  limit?: number;
  since?: string | null;
}): Promise<ModActionAuditEntry[]> {
  const db = getSupabaseAdmin();
  if (!db) return [];
  const limit = Math.min(200, Math.max(1, input?.limit ?? 80));
  let q = db.from("mod_action_audit").select(MOD_AUDIT_SELECT).order("created_at", { ascending: false }).limit(limit);
  const discordId = input?.discordId?.trim();
  if (discordId) q = q.eq("discord_id", discordId);
  if (input?.since?.trim()) q = q.gte("created_at", input.since.trim());
  const { data, error } = await q;
  if (error) {
    console.error("[modStaffDb] audit list", error);
    return [];
  }
  if (!Array.isArray(data)) return [];
  return data
    .map((row) => (row && typeof row === "object" ? mapModActionAuditRow(row as Record<string, unknown>) : null))
    .filter((r): r is ModActionAuditEntry => r != null);
}

export async function countModActionAudit(input?: {
  discordId?: string | null;
  since?: string | null;
}): Promise<{ approvals: number; denies: number; excludes: number; other: number; total: number }> {
  const rows = await listModActionAudit({ ...input, limit: 2000 });
  const buckets = { approvals: 0, denies: 0, excludes: 0, other: 0, total: 0 };
  for (const row of rows) {
    buckets.total += 1;
    if (row.action === "approved") buckets.approvals += 1;
    else if (row.action === "denied") buckets.denies += 1;
    else if (row.action === "excluded") buckets.excludes += 1;
    else buckets.other += 1;
  }
  return buckets;
}

export async function updateModStaffAdmin(input: {
  discordId: string;
  displayName?: string | null;
  status?: ModStaffStatus;
  roleTier?: ModStaffRoleTier;
  stipendCents?: number | null;
  payoutNotes?: string | null;
}): Promise<ModStaffRow | null> {
  const id = input.discordId.trim();
  if (!id) return null;
  const db = getSupabaseAdmin();
  if (!db) return null;
  const now = new Date().toISOString();
  const patch: Record<string, unknown> = { updated_at: now };
  if (input.displayName !== undefined) {
    patch.display_name = input.displayName?.trim() || null;
  }
  if (input.status) patch.status = input.status;
  if (input.roleTier) patch.role_tier = input.roleTier;
  if (input.stipendCents !== undefined) {
    patch.stipend_cents = input.stipendCents == null ? null : Math.max(0, Math.floor(input.stipendCents));
  }
  if (input.payoutNotes !== undefined) {
    patch.payout_notes = input.payoutNotes?.trim() || null;
  }
  const { data, error } = await db
    .from("mod_staff")
    .update(patch)
    .eq("discord_id", id)
    .select(MOD_STAFF_SELECT)
    .maybeSingle();
  if (error) {
    console.error("[modStaffDb] admin update", error);
    return null;
  }
  if (!data || typeof data !== "object") return null;
  return mapModStaffRow(data as Record<string, unknown>);
}

export async function inviteModStaffAdmin(input: {
  discordId: string;
  displayName?: string | null;
  roleTier?: ModStaffRoleTier;
  stipendCents?: number | null;
  payoutNotes?: string | null;
}): Promise<{ ok: true; row: ModStaffRow } | { ok: false; error: string }> {
  const id = input.discordId.trim();
  if (!/^\d{5,30}$/.test(id)) {
    return { ok: false, error: "Enter a valid numeric Discord user ID." };
  }
  const existing = await getModStaffByDiscordId(id);
  if (existing) {
    return { ok: false, error: "That Discord ID is already on the mod roster." };
  }
  const db = getSupabaseAdmin();
  if (!db) return { ok: false, error: "Supabase is not configured on the server." };
  const now = new Date().toISOString();
  const { data, error } = await db
    .from("mod_staff")
    .insert({
      discord_id: id,
      display_name: input.displayName?.trim() || null,
      status: "invited",
      role_tier: input.roleTier ?? "mod",
      stipend_cents:
        input.stipendCents == null ? null : Math.max(0, Math.floor(input.stipendCents)),
      payout_notes: input.payoutNotes?.trim() || null,
      invited_at: now,
      created_at: now,
      updated_at: now,
    })
    .select(MOD_STAFF_SELECT)
    .maybeSingle();
  if (error) {
    console.error("[modStaffDb] admin invite", error);
    return { ok: false, error: error.message || "Could not invite mod." };
  }
  if (!data || typeof data !== "object") return { ok: false, error: "Invite did not return a row." };
  const row = mapModStaffRow(data as Record<string, unknown>);
  if (!row) return { ok: false, error: "Could not parse invited row." };
  return { ok: true, row };
}

export async function listModStaffPayouts(discordId: string): Promise<ModStaffPayoutRow[]> {
  const id = discordId.trim();
  if (!id) return [];
  const db = getSupabaseAdmin();
  if (!db) return [];
  const { data, error } = await db
    .from("mod_staff_payouts")
    .select(
      "id, discord_id, amount_cents, period_label, status, tx_reference, paid_at, notes, created_at, updated_at"
    )
    .eq("discord_id", id)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) {
    console.error("[modStaffDb] payouts list", error);
    return [];
  }
  if (!Array.isArray(data)) return [];
  return data
    .map((row) => (row && typeof row === "object" ? mapModStaffPayoutRow(row as Record<string, unknown>) : null))
    .filter((r): r is ModStaffPayoutRow => r != null);
}

export function modStaffCanViewTeamAudit(row: ModStaffRow | null, helpTier: "user" | "mod" | "admin"): boolean {
  if (helpTier === "admin") return true;
  return row?.roleTier === "head_mod" && row.status === "active";
}

export async function createModStaffPayout(input: {
  discordId: string;
  amountCents: number;
  periodLabel?: string | null;
  status?: ModStaffPayoutRow["status"];
  txReference?: string | null;
  notes?: string | null;
  paidAt?: string | null;
}): Promise<ModStaffPayoutRow | null> {
  const id = input.discordId.trim();
  if (!id) return null;
  const db = getSupabaseAdmin();
  if (!db) return null;
  const now = new Date().toISOString();
  const status = input.status ?? "pending";
  const paidAt = status === "paid" ? input.paidAt ?? now : input.paidAt ?? null;
  const { data, error } = await db
    .from("mod_staff_payouts")
    .insert({
      discord_id: id,
      amount_cents: Math.max(0, Math.floor(input.amountCents)),
      period_label: input.periodLabel?.trim() || null,
      status,
      tx_reference: input.txReference?.trim() || null,
      notes: input.notes?.trim() || null,
      paid_at: paidAt,
      created_at: now,
      updated_at: now,
    })
    .select(
      "id, discord_id, amount_cents, period_label, status, tx_reference, paid_at, notes, created_at, updated_at"
    )
    .maybeSingle();
  if (error) {
    console.error("[modStaffDb] payout create", error);
    return null;
  }
  if (!data || typeof data !== "object") return null;
  return mapModStaffPayoutRow(data as Record<string, unknown>);
}

export async function updateModStaffPayout(input: {
  id: string;
  status?: ModStaffPayoutRow["status"];
  txReference?: string | null;
  notes?: string | null;
  paidAt?: string | null;
}): Promise<ModStaffPayoutRow | null> {
  const payoutId = input.id.trim();
  if (!payoutId) return null;
  const db = getSupabaseAdmin();
  if (!db) return null;
  const now = new Date().toISOString();
  const patch: Record<string, unknown> = { updated_at: now };
  if (input.status) {
    patch.status = input.status;
    if (input.status === "paid" && input.paidAt === undefined) {
      patch.paid_at = now;
    }
  }
  if (input.txReference !== undefined) patch.tx_reference = input.txReference?.trim() || null;
  if (input.notes !== undefined) patch.notes = input.notes?.trim() || null;
  if (input.paidAt !== undefined) patch.paid_at = input.paidAt;

  const { data, error } = await db
    .from("mod_staff_payouts")
    .update(patch)
    .eq("id", payoutId)
    .select(
      "id, discord_id, amount_cents, period_label, status, tx_reference, paid_at, notes, created_at, updated_at"
    )
    .maybeSingle();
  if (error) {
    console.error("[modStaffDb] payout update", error);
    return null;
  }
  if (!data || typeof data !== "object") return null;
  return mapModStaffPayoutRow(data as Record<string, unknown>);
}

export async function listModStaffPayoutsAdmin(discordId?: string | null): Promise<ModStaffPayoutRow[]> {
  const db = getSupabaseAdmin();
  if (!db) return [];
  let q = db
    .from("mod_staff_payouts")
    .select(
      "id, discord_id, amount_cents, period_label, status, tx_reference, paid_at, notes, created_at, updated_at"
    )
    .order("created_at", { ascending: false })
    .limit(200);
  const id = discordId?.trim();
  if (id) q = q.eq("discord_id", id);
  const { data, error } = await q;
  if (error) {
    console.error("[modStaffDb] payouts admin list", error);
    return [];
  }
  if (!Array.isArray(data)) return [];
  return data
    .map((row) => (row && typeof row === "object" ? mapModStaffPayoutRow(row as Record<string, unknown>) : null))
    .filter((r): r is ModStaffPayoutRow => r != null);
}
