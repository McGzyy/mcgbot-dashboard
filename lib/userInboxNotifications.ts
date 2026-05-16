import type { SupabaseClient } from "@supabase/supabase-js";

/** Server-side inbox kinds (system → user only; no user-to-user DMs). */
export type UserInboxKind =
  | "info"
  | "bug_closed"
  | "profile_report_resolved"
  | "profile_report_rejected"
  | "call_report_resolved"
  | "call_report_rejected"
  | "subscription"
  | "alert";

export type InsertUserInboxInput = {
  userId: string;
  title: string;
  body: string;
  kind?: UserInboxKind | string;
};

export async function insertUserInboxNotification(
  db: SupabaseClient,
  input: InsertUserInboxInput
): Promise<{ ok: boolean; error?: string }> {
  const userId = input.userId.trim();
  const title = input.title.trim().slice(0, 200);
  const body = input.body.trim().slice(0, 4000);
  if (!userId || !title || !body) {
    return { ok: false, error: "Missing userId, title, or body" };
  }

  const { error } = await db.from("user_inbox_notifications").insert({
    user_id: userId,
    title,
    body,
    kind: (input.kind ?? "info").toString().slice(0, 64) || "info",
  });

  if (error) {
    console.error("[userInbox] insert:", error);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}
