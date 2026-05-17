/** Measured top offset for in-page `position: sticky` (TopBar + optional announcement). */

export function readDashboardTopbarHeightPx(): number {
  const root = document.documentElement;
  const fromInline = root.style.getPropertyValue("--dashboard-topbar-height");
  const parsedInline = parseFloat(fromInline);
  if (Number.isFinite(parsedInline) && parsedInline > 0) return parsedInline;
  const computed = parseFloat(getComputedStyle(root).getPropertyValue("--dashboard-topbar-height"));
  if (Number.isFinite(computed) && computed > 0) return computed;
  return 96;
}

export function publishDashboardStickyBelowChrome(announcementHeightPx: number): void {
  if (typeof document === "undefined") return;
  const ann = Number.isFinite(announcementHeightPx) ? Math.max(0, announcementHeightPx) : 0;
  const total = Math.round(readDashboardTopbarHeightPx() + ann);
  document.documentElement.style.setProperty("--dashboard-sticky-below-chrome", `${total}px`);
}

export function clearDashboardStickyBelowChrome(): void {
  if (typeof document === "undefined") return;
  document.documentElement.style.removeProperty("--dashboard-sticky-below-chrome");
}
