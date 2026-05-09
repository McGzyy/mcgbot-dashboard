/**
 * Announcement schedule: both bounds optional. Times are UTC instants (ISO from DB).
 * - `from`: first moment the bar may show (inclusive).
 * - `until`: first moment the bar is hidden (`now >= until`, exclusive end of visibility).
 */

function parseIsoMs(raw: string | null | undefined): number | null {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s) return null;
  const t = Date.parse(s);
  return Number.isFinite(t) ? t : null;
}

/** True when the schedule allows the bar (ignores master toggle and message). */
export function isAnnouncementWithinSchedule(
  visibleFromIso: string | null | undefined,
  visibleUntilIso: string | null | undefined,
  nowMs: number = Date.now()
): boolean {
  const fromMs = parseIsoMs(visibleFromIso);
  const untilMs = parseIsoMs(visibleUntilIso);

  if (fromMs != null && nowMs < fromMs) return false;
  if (untilMs != null && nowMs >= untilMs) return false;
  return true;
}

export function assertAnnouncementScheduleOrder(
  visibleFromIso: string | null | undefined,
  visibleUntilIso: string | null | undefined
): { ok: true } | { ok: false; error: string } {
  const fromMs = parseIsoMs(visibleFromIso);
  const untilMs = parseIsoMs(visibleUntilIso);
  if (fromMs != null && untilMs != null && untilMs <= fromMs) {
    return { ok: false, error: "Announcement end time must be after start time." };
  }
  return { ok: true };
}
