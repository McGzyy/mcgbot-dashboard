import type { SupabaseClient } from "@supabase/supabase-js";

/** Server-side inbox kinds (system → user only; no user-to-user DMs). */
export type UserInboxKind =
  | "info"
  | "announcement"
  | "bug_closed"
  | "feature_closed"
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

function parseInboxLinkLine(body?: string): string | null {
  const linkLine = (body ?? "")
    .split("\n")
    .map((l) => l.trim())
    .find((l) => l.startsWith("Link:"));
  if (!linkLine) return null;
  const href = linkLine.slice("Link:".length).trim();
  return href.startsWith("/") || href.startsWith("http") ? href : null;
}

/** Parse optional `Link: /path` or `Chart: https://…` line embedded in notification body. */
function parseInboxActionHref(body?: string): string | null {
  const linkFromBody = parseInboxLinkLine(body);
  if (linkFromBody) return linkFromBody;

  const chartLine = (body ?? "")
    .split("\n")
    .map((l) => l.trim())
    .find((l) => l.startsWith("Chart:"));
  if (!chartLine) return null;
  const href = chartLine.slice("Chart:".length).trim();
  return href.startsWith("http") ? href : null;
}

/** Client-safe href for bell inbox rows when the kind maps to a dashboard route. */
export function inboxNotificationHref(input: { kind: string; body?: string }): string | null {
  const actionHref = parseInboxActionHref(input.body);
  if (actionHref) return actionHref;

  const kind = input.kind.trim().toLowerCase();
  if (kind === "mod_escalation") return "/admin/mod-escalations";
  if (
    kind === "bug_closed" ||
    kind === "feature_closed" ||
    kind === "profile_report_resolved" ||
    kind === "profile_report_rejected" ||
    kind === "call_report_resolved" ||
    kind === "call_report_rejected"
  ) {
    return "/help";
  }
  return null;
}

/** Short CTA label for linked inbox rows in the bell dropdown. */
export function inboxNotificationCtaLabel(kind: string): string {
  const k = kind.trim().toLowerCase();
  if (k === "mod_escalation") return "Open escalation inbox →";
  if (k === "alert") return "Open chart →";
  if (k === "bug_closed") return "Open Help →";
  if (k === "feature_closed") return "Open Help →";
  if (k === "profile_report_resolved" || k === "profile_report_rejected") return "View in Help →";
  if (k === "call_report_resolved" || k === "call_report_rejected") return "View in Help →";
  return "Open →";
}

/** Hide machine-readable link lines from inbox body copy. */
export function inboxBodyForDisplay(body: string): string {
  return body
    .split("\n")
    .filter((line) => !line.trim().startsWith("Link:"))
    .join("\n")
    .trim();
}
