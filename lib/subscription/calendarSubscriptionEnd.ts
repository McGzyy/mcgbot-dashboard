const DAY_MS = 86_400_000;

/**
 * Whole months inferred from `duration_days` (same idea as 30 / 90 / 365 → 1 / 3 / 12).
 * Used when extending access in calendar-month mode (Stripe-like).
 */
export function planDurationDaysToBillingMonths(durationDays: number): number {
  const d = Math.max(1, Math.floor(Number(durationDays) || 0));
  return Math.max(1, Math.round(d / 30));
}

/**
 * Add whole calendar months in UTC (handles month length; e.g. Jan 31 + 1 → Feb 28/29).
 */
export function addCalendarMonthsUtc(base: Date, months: number): Date {
  const add = Math.max(0, Math.floor(months));
  if (add <= 0) return new Date(base.getTime());

  const y = base.getUTCFullYear();
  const mo = base.getUTCMonth();
  const day = base.getUTCDate();

  const totalMonths = y * 12 + mo + add;
  const ny = Math.floor(totalMonths / 12);
  const nm = totalMonths - ny * 12;

  const lastDay = new Date(Date.UTC(ny, nm + 1, 0)).getUTCDate();
  const nd = Math.min(day, lastDay);

  return new Date(
    Date.UTC(
      ny,
      nm,
      nd,
      base.getUTCHours(),
      base.getUTCMinutes(),
      base.getUTCSeconds(),
      base.getUTCMilliseconds()
    )
  );
}

/**
 * Stripe-like: short grants (under 28 days) extend by literal days. Otherwise extend by **calendar months**
 * (`billingMonths` when set, else {@link planDurationDaysToBillingMonths} from `duration_days`).
 */
export function computeSubscriptionPeriodEnd(
  base: Date,
  durationDays: number,
  billingMonths?: number | null
): Date {
  const d = Math.max(1, Math.floor(Number(durationDays) || 0));
  if (d < 28) {
    return new Date(base.getTime() + d * DAY_MS);
  }
  const bmRaw = billingMonths != null && Number.isFinite(Number(billingMonths)) ? Number(billingMonths) : null;
  const months =
    bmRaw != null && bmRaw >= 1 ? Math.floor(bmRaw) : planDurationDaysToBillingMonths(d);
  return addCalendarMonthsUtc(base, months);
}
