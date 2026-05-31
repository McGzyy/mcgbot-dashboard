import { appendHighlightQuery } from "@/lib/mod/modQueueHighlight";

/**
 * Maps mod escalation / audit subject types to moderation queue anchors.
 * Section ids must stay in sync with ModerationStaffQueues + moderation/page.tsx.
 */
export type ModQueueDeepLink = {
  href: string;
  label: string;
};

const SUBJECT_QUEUE_LINKS: Record<string, ModQueueDeepLink> = {
  call_report: { href: "/moderation#mod-reports", label: "Open in queue" },
  profile_report: { href: "/moderation#mod-reports-profiles", label: "Open in queue" },
  trusted_pro_application: { href: "/moderation#mod-tp-apps", label: "Open in queue" },
  trusted_pro_call: { href: "/moderation#mod-tp-submissions", label: "Open in queue" },
  outside_x_submission: { href: "/moderation#mod-outside-x-sources", label: "Open in queue" },
  call: { href: "/moderation#mod-calls", label: "Open in queue" },
  dev_submission: { href: "/moderation#mod-calls", label: "Open in queue" },
  user_call_suspension: { href: "/moderation#mod-call-suspensions", label: "Open in queue" },
  escalation: { href: "/admin/mod-escalations", label: "Admin inbox" },
};

/** Deep link to the moderation desk for a queue subject, when known. */
export function modQueueLinkForSubjectType(subjectType: string): ModQueueDeepLink | null {
  const key = subjectType.trim().toLowerCase();
  if (!key) return null;
  return SUBJECT_QUEUE_LINKS[key] ?? null;
}

/** Queue deep link with optional `?highlight=` for scrolling to a specific row. */
export function modQueueLinkForSubject(
  subjectType: string,
  subjectId?: string | null
): ModQueueDeepLink | null {
  const base = modQueueLinkForSubjectType(subjectType);
  if (!base) return null;
  const id = subjectId?.trim();
  if (!id) return base;
  return { ...base, href: appendHighlightQuery(base.href, id) };
}

/** Admin escalations inbox with optional row highlight (escalation uuid). */
export function modEscalationAdminInboxHref(escalationId?: string | null): string {
  const base = "/admin/mod-escalations";
  const id = escalationId?.trim();
  return id ? appendHighlightQuery(base, id) : base;
}

/** Optional profile shortcut when subject id is a dashboard user id (not report row ids). */
export function modProfileLinkForSubject(
  subjectType: string,
  subjectId: string
): ModQueueDeepLink | null {
  const type = subjectType.trim().toLowerCase();
  const id = subjectId.trim();
  if (!id) return null;
  if (type === "user_call_suspension") {
    return { href: `/user/${encodeURIComponent(id)}`, label: "Open profile" };
  }
  return null;
}
