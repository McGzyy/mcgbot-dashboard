import { modEscalationAdminInboxHref, modQueueLinkForSubject } from "@/lib/mod/modEscalationSubjectLinks";
import type { ModEscalationRow } from "@/lib/mod/modQueueOps";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { insertUserInboxNotification } from "@/lib/userInboxNotifications";

function adminDiscordIdSet(): Set<string> {
  const raw = (process.env.DISCORD_ADMIN_IDS ?? "").trim();
  if (!raw) return new Set();
  return new Set(
    raw
      .split(/[\s,]+/)
      .map((s) => s.trim())
      .filter(Boolean)
  );
}

async function resolveAdminDashboardUserIds(): Promise<string[]> {
  const discordIds = [...adminDiscordIdSet()];
  if (discordIds.length === 0) return [];

  const db = getSupabaseAdmin();
  if (!db) return [];

  const { data, error } = await db.from("users").select("id").in("discord_id", discordIds);
  if (error) {
    console.error("[modEscalationAdminInbox] users lookup:", error);
    return [];
  }

  const ids = new Set<string>();
  for (const row of data ?? []) {
    if (!row || typeof row !== "object") continue;
    const id = typeof (row as { id?: unknown }).id === "string" ? (row as { id: string }).id.trim() : "";
    if (id) ids.add(id);
  }
  return [...ids];
}

function buildInboxCopy(row: ModEscalationRow): { title: string; body: string } {
  const queue = modQueueLinkForSubject(row.subjectType, row.subjectId);
  const subject = `${row.subjectType} · ${row.subjectId}`.slice(0, 160);
  const reason = row.reason.trim().slice(0, 280);
  const lines = [
    `A moderator escalated a queue item for admin review.`,
    subject,
    reason ? `Reason: ${reason}` : null,
    queue ? `Queue: ${queue.href}` : null,
  ].filter(Boolean) as string[];
  return {
    title: "Mod escalation — admin review",
    body: lines.join("\n"),
  };
}

async function sendModEscalationAdminInbox(row: ModEscalationRow): Promise<void> {
  const userIds = await resolveAdminDashboardUserIds();
  if (userIds.length === 0) return;

  const db = getSupabaseAdmin();
  if (!db) return;

  const { title, body } = buildInboxCopy(row);
  const actionHref = modEscalationAdminInboxHref(row.id);
  await Promise.all(
    userIds.map((userId) =>
      insertUserInboxNotification(db, {
        userId,
        title,
        body,
        kind: "mod_escalation",
        actionHref,
      })
    )
  );
}

/**
 * Fire-and-forget dashboard bell notifications for DISCORD_ADMIN_IDS users.
 * Requires each admin Discord id to exist in `users` (matched by discord_id) or no bell is sent.
 * Never throws; logs failures to console only.
 */
export function notifyModEscalationAdminsInbox(row: ModEscalationRow): void {
  void sendModEscalationAdminInbox(row).catch((err) => {
    console.error("[modEscalationAdminInbox] notify failed:", err);
  });
}
