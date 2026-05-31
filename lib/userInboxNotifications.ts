import type { SupabaseClient } from "@supabase/supabase-js";

/** Server-side inbox kinds (system → user only; no user-to-user DMs). */
export type UserInboxKind =
  | "info"
  | "announcement"
  | "bug_closed"
  | "profile_report_resolved"
  | "profile_report_rejected"
  | "call_report_resolved"
  | "call_report_rejected"
  | "mod_escalation"
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

/** Client-safe href for bell inbox rows when the kind maps to a dashboard route. */
export function inboxNotificationHref(input: { kind: string; body?: string }): string | null {
  const kind = input.kind.trim().toLowerCase();
  if (kind === "mod_escalation") {
    const linkLine = (input.body ?? "")
      .split("\n")
      .map((l) => l.trim())
      .find((l) => l.startsWith("Link:"));
    if (linkLine) return linkLine.slice("Link:".length).trim();
    return "/admin/mod-escalations";
  }
  return null;
}

/** Hide machine-readable link lines from inbox body copy. */
export function inboxBodyForDisplay(body: string): string {
  return body
    .split("\n")
    .filter((line) => !line.trim().startsWith("Link:"))
    .join("\n")
    .trim();
}
