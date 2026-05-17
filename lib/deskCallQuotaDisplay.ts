import type { DeskCallQuota } from "@/lib/subscription/deskCallLimits";

/** Client-safe quota snapshot (subset of API). */
export type DeskCallQuotaUi = {
  unlimited: boolean;
  usedToday: number;
  remaining: number | null;
  dailyLimit: number | null;
};

export function deskCallQuotaFromApi(
  q: Record<string, unknown> | null | undefined
): DeskCallQuotaUi | null {
  if (!q || typeof q !== "object") return null;
  return {
    unlimited: q.unlimited === true,
    usedToday: typeof q.usedToday === "number" ? q.usedToday : 0,
    remaining: typeof q.remaining === "number" ? q.remaining : null,
    dailyLimit: typeof q.dailyLimit === "number" ? q.dailyLimit : null,
  };
}

export function deskCallQuotaFromServer(q: DeskCallQuota): DeskCallQuotaUi {
  return {
    unlimited: q.unlimited,
    usedToday: q.usedToday,
    remaining: q.remaining,
    dailyLimit: q.dailyLimit,
  };
}

export function deskCallsRemainingLabel(quota: DeskCallQuotaUi): string {
  if (quota.unlimited) return "Unlimited calls today";
  if (quota.dailyLimit == null) return "Calls";
  const left = quota.remaining ?? Math.max(0, quota.dailyLimit - quota.usedToday);
  return `${left} of ${quota.dailyLimit} calls left today`;
}

export function deskCallsAtLimit(quota: DeskCallQuotaUi | null): boolean {
  if (!quota || quota.unlimited) return false;
  return quota.remaining != null && quota.remaining <= 0;
}
