/**
 * Shared list-row density for home dashboard feeds (recent calls, trending, social).
 * Pair with `terminalSurface.dashboardListWell` + `TerminalPanelRefresh`.
 */

/** Unified border language (Elite / dashboard audit). */
export const terminalListRowBorder =
  "border border-zinc-800/50 ring-1 ring-white/[0.03]";

/** Section kickers inside dashboard list wells (Tier, Billing, etc.). */
export const terminalSectionLabel =
  "text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500";

/** Opacity transition when a panel refetches with existing rows visible. */
export function terminalListRefreshOpacity(active: boolean): string {
  return `transition-opacity duration-200 ${active ? "opacity-[0.86]" : "opacity-100"}`;
}

export const terminalListRow = {
  /** Clickable inset row (trending, opportunities, watchlist links). */
  interactive: `group flex min-w-0 w-full items-center justify-between gap-2 rounded-lg ${terminalListRowBorder} bg-zinc-900/20 px-2 py-2 text-left transition-colors hover:bg-zinc-900/35 focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]/25 sm:gap-3 sm:px-3`,
  /** Dense static row inside a divided list (recent calls). */
  static:
    "flex min-w-0 w-full items-center gap-2 py-2 pl-1 pr-1 sm:gap-2.5 sm:py-2 sm:pl-1.5 sm:pr-2",
  /** Outer list spacing for bordered card rows. */
  cardList: "space-y-1",
  /** Outer list spacing for divided rows. */
  dividedList: "divide-y divide-zinc-800/45",
} as const;
