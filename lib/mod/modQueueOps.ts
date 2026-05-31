import type { ModActionAuditAction } from "@/lib/mod/modStaffDb";
import { insertModActionAudit } from "@/lib/mod/modStaffDb";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export type ModItemNoteRow = {
  id: string;
  subjectType: string;
  subjectId: string;
  authorDiscordId: string;
  note: string;
  createdAt: string;
  updatedAt: string;
};

export type ModEscalationRow = {
  id: string;
  subjectType: string;
  subjectId: string;
  raisedByDiscordId: string;
  status: "open" | "resolved" | "dismissed";
  reason: string;
  detail: Record<string, unknown>;
  adminNotes: string | null;
  resolvedAt: string | null;
  resolvedByDiscordId: string | null;
  createdAt: string;
  updatedAt: string;
};

export async function recordModStaffAudit(input: {
  discordId: string;
  action: ModActionAuditAction;
  subjectType: string;
  subjectId: string;
  detail?: Record<string, unknown>;
}): Promise<void> {
  await insertModActionAudit({
    discordId: input.discordId,
    action: input.action,
    subjectType: input.subjectType,
    subjectId: input.subjectId,
    detail: input.detail,
  });
}

export function reportStatusToAuditAction(
  status: string
): ModActionAuditAction {
  if (status === "resolved") return "approved";
  if (status === "rejected") return "denied";
  return "other";
}

export async function listModItemNotes(subjectType: string, subjectId: string): Promise<ModItemNoteRow[]> {
  const type = subjectType.trim();
  const id = subjectId.trim();
  if (!type || !id) return [];
  const db = getSupabaseAdmin();
  if (!db) return [];
  const { data, error } = await db
    .from("mod_item_notes")
    .select("id, subject_type, subject_id, author_discord_id, note, created_at, updated_at")
    .eq("subject_type", type)
    .eq("subject_id", id)
    .order("created_at", { ascending: false })
    .limit(40);
  if (error) {
    console.error("[modQueueOps] notes list", error);
    return [];
  }
  if (!Array.isArray(data)) return [];
  return data
    .map((row) => {
      if (!row || typeof row !== "object") return null;
      const r = row as Record<string, unknown>;
      const noteId = typeof r.id === "string" ? r.id : "";
      if (!noteId) return null;
      return {
        id: noteId,
        subjectType: type,
        subjectId: id,
        authorDiscordId: typeof r.author_discord_id === "string" ? r.author_discord_id : "",
        note: typeof r.note === "string" ? r.note : "",
        createdAt: typeof r.created_at === "string" ? r.created_at : "",
        updatedAt: typeof r.updated_at === "string" ? r.updated_at : "",
      };
    })
    .filter((r): r is ModItemNoteRow => r != null);
}

export async function addModItemNote(input: {
  subjectType: string;
  subjectId: string;
  authorDiscordId: string;
  note: string;
}): Promise<ModItemNoteRow | null> {
  const type = input.subjectType.trim();
  const id = input.subjectId.trim();
  const note = input.note.trim().slice(0, 4000);
  const author = input.authorDiscordId.trim();
  if (!type || !id || !note || !author) return null;
  const db = getSupabaseAdmin();
  if (!db) return null;
  const now = new Date().toISOString();
  const { data, error } = await db
    .from("mod_item_notes")
    .insert({
      subject_type: type,
      subject_id: id,
      author_discord_id: author,
      note,
      created_at: now,
      updated_at: now,
    })
    .select("id, subject_type, subject_id, author_discord_id, note, created_at, updated_at")
    .maybeSingle();
  if (error) {
    console.error("[modQueueOps] note insert", error);
    return null;
  }
  if (!data || typeof data !== "object") return null;
  const r = data as Record<string, unknown>;
  return {
    id: String(r.id),
    subjectType: type,
    subjectId: id,
    authorDiscordId: author,
    note,
    createdAt: now,
    updatedAt: now,
  };
}

export async function createModEscalation(input: {
  subjectType: string;
  subjectId: string;
  raisedByDiscordId: string;
  reason: string;
  detail?: Record<string, unknown>;
}): Promise<ModEscalationRow | null> {
  const type = input.subjectType.trim();
  const id = input.subjectId.trim();
  const reason = input.reason.trim().slice(0, 2000);
  const raisedBy = input.raisedByDiscordId.trim();
  if (!type || !id || !reason || !raisedBy) return null;
  const db = getSupabaseAdmin();
  if (!db) return null;
  const now = new Date().toISOString();
  const { data, error } = await db
    .from("mod_escalations")
    .insert({
      subject_type: type,
      subject_id: id,
      raised_by_discord_id: raisedBy,
      status: "open",
      reason,
      detail: input.detail ?? {},
      created_at: now,
      updated_at: now,
    })
    .select(
      "id, subject_type, subject_id, raised_by_discord_id, status, reason, detail, admin_notes, resolved_at, resolved_by_discord_id, created_at, updated_at"
    )
    .maybeSingle();
  if (error) {
    console.error("[modQueueOps] escalation insert", error);
    return null;
  }
  if (!data || typeof data !== "object") return null;
  return mapEscalationRow(data as Record<string, unknown>);
}

function mapEscalationRow(r: Record<string, unknown>): ModEscalationRow | null {
  const id = typeof r.id === "string" ? r.id : "";
  if (!id) return null;
  const status = r.status;
  if (status !== "open" && status !== "resolved" && status !== "dismissed") return null;
  return {
    id,
    subjectType: typeof r.subject_type === "string" ? r.subject_type : "",
    subjectId: typeof r.subject_id === "string" ? r.subject_id : "",
    raisedByDiscordId: typeof r.raised_by_discord_id === "string" ? r.raised_by_discord_id : "",
    status,
    reason: typeof r.reason === "string" ? r.reason : "",
    detail:
      r.detail && typeof r.detail === "object" && !Array.isArray(r.detail)
        ? (r.detail as Record<string, unknown>)
        : {},
    adminNotes: typeof r.admin_notes === "string" ? r.admin_notes : null,
    resolvedAt: typeof r.resolved_at === "string" ? r.resolved_at : null,
    resolvedByDiscordId: typeof r.resolved_by_discord_id === "string" ? r.resolved_by_discord_id : null,
    createdAt: typeof r.created_at === "string" ? r.created_at : "",
    updatedAt: typeof r.updated_at === "string" ? r.updated_at : "",
  };
}

export async function listModEscalations(input?: {
  status?: "open" | "resolved" | "dismissed" | null;
  limit?: number;
}): Promise<ModEscalationRow[]> {
  const db = getSupabaseAdmin();
  if (!db) return [];
  const limit = Math.min(200, Math.max(1, input?.limit ?? 80));
  let q = db
    .from("mod_escalations")
    .select(
      "id, subject_type, subject_id, raised_by_discord_id, status, reason, detail, admin_notes, resolved_at, resolved_by_discord_id, created_at, updated_at"
    )
    .order("created_at", { ascending: false })
    .limit(limit);
  if (input?.status) q = q.eq("status", input.status);
  const { data, error } = await q;
  if (error) {
    console.error("[modQueueOps] escalations list", error);
    return [];
  }
  if (!Array.isArray(data)) return [];
  return data
    .map((row) => (row && typeof row === "object" ? mapEscalationRow(row as Record<string, unknown>) : null))
    .filter((r): r is ModEscalationRow => r != null);
}

export async function resolveModEscalation(input: {
  id: string;
  status: "resolved" | "dismissed";
  resolvedByDiscordId: string;
  adminNotes?: string | null;
}): Promise<ModEscalationRow | null> {
  const id = input.id.trim();
  if (!id) return null;
  const db = getSupabaseAdmin();
  if (!db) return null;
  const now = new Date().toISOString();
  const { data, error } = await db
    .from("mod_escalations")
    .update({
      status: input.status,
      admin_notes: input.adminNotes?.trim().slice(0, 4000) || null,
      resolved_at: now,
      resolved_by_discord_id: input.resolvedByDiscordId.trim(),
      updated_at: now,
    })
    .eq("id", id)
    .eq("status", "open")
    .select(
      "id, subject_type, subject_id, raised_by_discord_id, status, reason, detail, admin_notes, resolved_at, resolved_by_discord_id, created_at, updated_at"
    )
    .maybeSingle();
  if (error) {
    console.error("[modQueueOps] escalation resolve", error);
    return null;
  }
  if (!data || typeof data !== "object") return null;
  return mapEscalationRow(data as Record<string, unknown>);
}
