import {
  computeAnnouncementContentVersion,
  type AnnouncementVersionSource,
} from "@/lib/announcementContentVersion";
import { isAnnouncementWithinSchedule } from "@/lib/announcementSchedule";
import type { DashboardAdminSettingsRow } from "@/lib/dashboardAdminSettingsDb";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

const INSERT_CHUNK = 200;

function versionSourceFromRow(row: DashboardAdminSettingsRow): AnnouncementVersionSource {
  return {
    announcement_enabled: row.announcement_enabled === true,
    announcement_global: row.announcement_global === true,
    announcement_message: row.announcement_message,
    announcement_message_mobile: row.announcement_message_mobile,
    announcement_hide_on_mobile: row.announcement_hide_on_mobile === true,
    announcement_allow_user_dismiss: row.announcement_allow_user_dismiss === true,
    announcement_cta_label: row.announcement_cta_label,
    announcement_cta_url: row.announcement_cta_url,
    announcement_visible_from: row.announcement_visible_from,
    announcement_visible_until: row.announcement_visible_until,
  };
}

export function isAnnouncementLiveForInbox(
  row: DashboardAdminSettingsRow,
  nowMs: number = Date.now()
): boolean {
  const msg = typeof row.announcement_message === "string" && row.announcement_message.trim().length > 0;
  return (
    row.announcement_enabled === true &&
    msg &&
    isAnnouncementWithinSchedule(row.announcement_visible_from, row.announcement_visible_until, nowMs)
  );
}

async function listDiscordUserIds(): Promise<string[]> {
  const db = getSupabaseAdmin();
  if (!db) return [];

  const ids: string[] = [];
  const pageSize = 500;
  for (let offset = 0; offset < 50_000; offset += pageSize) {
    const { data, error } = await db
      .from("users")
      .select("discord_id")
      .not("discord_id", "is", null)
      .range(offset, offset + pageSize - 1);

    if (error) {
      console.error("[announcementInbox] list users:", error);
      break;
    }
    if (!data?.length) break;
    for (const row of data) {
      const id =
        row && typeof row === "object" && typeof (row as { discord_id?: unknown }).discord_id === "string"
          ? (row as { discord_id: string }).discord_id.trim()
          : "";
      if (id) ids.push(id);
    }
    if (data.length < pageSize) break;
  }
  return [...new Set(ids)];
}

/**
 * When a new announcement goes live, fan-out one inbox row per user (bell notifications).
 * Skips if content version was already broadcast or the bar is not currently live.
 */
export async function broadcastAnnouncementToUserInboxes(
  after: DashboardAdminSettingsRow
): Promise<{ sent: number; skipped: boolean }> {
  const db = getSupabaseAdmin();
  if (!db) return { sent: 0, skipped: true };

  if (!isAnnouncementLiveForInbox(after)) {
    return { sent: 0, skipped: true };
  }

  const contentVersion = await computeAnnouncementContentVersion(versionSourceFromRow(after));
  const lastBroadcast =
    typeof after.announcement_inbox_broadcast_version === "string"
      ? after.announcement_inbox_broadcast_version.trim()
      : "";
  if (lastBroadcast && lastBroadcast === contentVersion) {
    return { sent: 0, skipped: true };
  }

  const message = after.announcement_message?.trim() ?? "";
  if (!message) return { sent: 0, skipped: true };

  const title = "New announcement";
  const body = message.slice(0, 4000);
  const userIds = await listDiscordUserIds();
  if (userIds.length === 0) {
    return { sent: 0, skipped: true };
  }

  let sent = 0;
  for (let i = 0; i < userIds.length; i += INSERT_CHUNK) {
    const chunk = userIds.slice(i, i + INSERT_CHUNK);
    const rows = chunk.map((user_id) => ({
      user_id,
      title,
      body,
      kind: "announcement",
    }));
    const { error } = await db.from("user_inbox_notifications").insert(rows);
    if (error) {
      console.error("[announcementInbox] insert chunk:", error);
      return { sent, skipped: false };
    }
    sent += chunk.length;
  }

  const { error: markError } = await db
    .from("dashboard_admin_settings")
    .update({
      announcement_inbox_broadcast_version: contentVersion,
      updated_at: new Date().toISOString(),
    })
    .eq("id", 1);

  if (markError) {
    console.warn("[announcementInbox] mark broadcast version:", markError);
  }

  console.info(`[announcementInbox] broadcast v=${contentVersion} to ${sent} users`);
  return { sent, skipped: false };
}

export const ANNOUNCEMENT_SETTINGS_PATCH_KEYS = new Set([
  "announcement_enabled",
  "announcement_global",
  "announcement_message",
  "announcement_message_mobile",
  "announcement_hide_on_mobile",
  "announcement_allow_user_dismiss",
  "announcement_visible_from",
  "announcement_visible_until",
  "announcement_cta_label",
  "announcement_cta_url",
]);

export function patchTouchesAnnouncement(
  patch: Record<string, unknown>
): boolean {
  return Object.keys(patch).some((k) => ANNOUNCEMENT_SETTINGS_PATCH_KEYS.has(k));
}
