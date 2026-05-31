import type { ModActionAuditAction } from "@/lib/mod/modStaffDb";

export type ModActionAuditEntry = {
  id: string;
  discordId: string;
  action: ModActionAuditAction;
  subjectType: string | null;
  subjectId: string | null;
  detail: Record<string, unknown>;
  createdAt: string;
};

export type ModAuditStatBuckets = {
  approvals: number;
  denies: number;
  excludes: number;
  other: number;
  total: number;
};

export function emptyModAuditBuckets(): ModAuditStatBuckets {
  return { approvals: 0, denies: 0, excludes: 0, other: 0, total: 0 };
}

export function bucketModAuditAction(
  buckets: ModAuditStatBuckets,
  action: ModActionAuditAction
): ModAuditStatBuckets {
  const next = { ...buckets, total: buckets.total + 1 };
  if (action === "approved") next.approvals += 1;
  else if (action === "denied") next.denies += 1;
  else if (action === "excluded") next.excludes += 1;
  else next.other += 1;
  return next;
}

export function actionLabel(action: ModActionAuditAction): string {
  if (action === "approved") return "Approved";
  if (action === "denied") return "Denied";
  if (action === "excluded") return "Excluded";
  return "Other";
}

export function actionTone(action: ModActionAuditAction): string {
  if (action === "approved") return "text-emerald-300/90";
  if (action === "denied") return "text-zinc-400";
  if (action === "excluded") return "text-amber-200/85";
  return "text-violet-300/85";
}
