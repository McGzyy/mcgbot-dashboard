/**
 * McGBot Terminal — global UI rules (keep in sync with `dashboardChrome` / `adminChrome` / `modChrome` in roleTierStyles).
 *
 * Shell: `Sidebar` rail + `MainShell` = `TopBar` + `dashboardChrome.contentWell` (max-w 1680px, responsive px).
 * Surfaces: `--mcg-page` (outer) → `--mcg-stage` (main column) → raised panels (zinc border + zinc-950 fill).
 * Type: kickers ~10px uppercase wide tracking; dense UI copy `text-sm`; page sections use `terminalPage`.
 * Motion: respect `prefers-reduced-motion` (see globals.css); keep hover transitions ≤ ~200ms on chrome.
 */

const raisedSurface = "border-zinc-800/90 bg-zinc-950";

const modalBackdropScroll =
  "flex items-start justify-center overflow-y-auto bg-black/60 px-4 py-10";

const modalPanelXl = `mt-10 w-full max-w-xl rounded-xl ${raisedSurface} p-4 shadow-xl shadow-black/50 backdrop-blur`;

/** Deck surfaces shared by `PanelCard` and similar tiles. */
export const terminalSurface = {
  panelCard: `${raisedSurface} shadow-sm shadow-black/20`,
  panelCardElevated: `${raisedSurface} shadow-md shadow-black/25`,
  rowDivide: "border-zinc-800/90",
} as const;

/** Page-level typography + stat primitives inside `contentWell` (incremental adoption). */
export const terminalPage = {
  sectionTitle: "text-base font-semibold tracking-tight text-zinc-100",
  sectionHint: "mt-0.5 text-xs text-zinc-600",
  statTile:
    "rounded-xl border border-zinc-800/90 bg-gradient-to-b from-zinc-900/55 to-zinc-900/25 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]",
  denseInsetRow:
    "rounded-lg border border-zinc-800/90 bg-zinc-900/20 px-3 py-2 transition-colors hover:bg-zinc-900/35",
  denseInsetRowButton:
    "group flex w-full items-center justify-between gap-3 rounded-lg border border-zinc-800/90 bg-zinc-900/20 px-3 py-2 text-left transition-colors hover:bg-zinc-900/35 focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]/25",
} as const;

/** Flyouts, menus, modals, and form controls that should match TopBar / PanelCard chrome. */
export const terminalUi = {
  notificationsPanel:
    `absolute right-0 z-50 mt-2 max-h-[min(24rem,70dvh)] w-[min(20rem,calc(100vw-1.25rem))] overflow-y-auto rounded-xl ${raisedSurface} shadow-xl sm:w-80`,
  notificationsList: "divide-y divide-zinc-800/90",
  accountMenu: `absolute right-0 top-full z-50 mt-2 min-w-[220px] rounded-lg ${raisedSurface} py-1 shadow-lg`,
  menuSectionRule: "my-1 border-t border-zinc-800/90",
  modalPanelXl,
  /** Alias — same shell as token search dialog. */
  tokenSearchModalPanel: modalPanelXl,
  modalPanelLg2xl: `mt-10 w-full max-w-lg rounded-2xl ${raisedSurface} p-4 shadow-xl shadow-black/50 backdrop-blur`,
  modalPanel2xlWide: `mt-10 w-full max-w-2xl rounded-2xl ${raisedSurface} p-4 shadow-xl shadow-black/50 backdrop-blur`,
  modalPanelLgXl: `mt-10 w-full max-w-lg rounded-xl ${raisedSurface} p-4 shadow-xl shadow-black/50 backdrop-blur`,
  modalPanel3xlWide: `mt-10 w-full max-w-3xl rounded-2xl border border-zinc-800/70 bg-zinc-950/75 p-5 shadow-2xl shadow-black/60 backdrop-blur sm:p-6`,
  modalPanelWideGlass:
    "w-full max-w-2xl rounded-2xl border border-zinc-800/70 bg-zinc-950/70 p-5 shadow-2xl shadow-black/60 backdrop-blur sm:p-6",
  modalBackdropZ50: `fixed inset-0 z-50 ${modalBackdropScroll}`,
  modalBackdropZ100: `fixed inset-0 z-[100] ${modalBackdropScroll}`,
  modalBackdropZ120: `fixed inset-0 z-[120] ${modalBackdropScroll}`,
  /** Centered modal (e.g. quick submit) — shorter vertical padding than scroll modals. */
  modalBackdropCenterZ50: "fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-6",
  modalCloseIconBtn:
    "flex h-8 w-8 items-center justify-center rounded-md border border-zinc-800/90 bg-zinc-950 text-zinc-300 transition hover:bg-zinc-900/40 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]/25",
  formInput:
    "w-full rounded-lg border border-zinc-800/90 bg-[color:var(--mcg-page)] px-3 py-2 text-sm text-zinc-200 outline-none ring-[color:var(--accent)]/20 focus:ring-2 disabled:opacity-60",
  secondaryButtonSm:
    "rounded-md border border-zinc-800/90 bg-zinc-950 px-3 py-1.5 text-xs font-medium text-zinc-300 transition hover:bg-zinc-900/40 disabled:opacity-60",
  choiceRow:
    "flex cursor-pointer items-center gap-2 rounded-lg border border-zinc-800/90 bg-zinc-950/50 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-900/40",
  dialogPanelCompact: `my-auto w-full max-w-md rounded-xl ${raisedSurface} p-4 shadow-xl shadow-black/50 backdrop-blur`,
  inlineFooterRule: "border-t border-zinc-800/90",
  activityBackdrop:
    "activity-popup-backdrop fixed inset-0 z-[200] flex items-center justify-center bg-black/75 p-4 backdrop-blur-[3px]",
  activityPanel: `activity-popup-panel relative w-full max-w-md rounded-xl ${raisedSurface} p-4 shadow-xl`,
  /** Dim layer + frame for portaled overlays below notifications (`z-[60]`). */
  portalBackdropDim: "absolute inset-0 bg-black/70 backdrop-blur-sm",
  portalFrameScroll: "absolute inset-0 flex items-start justify-center overflow-y-auto p-4 sm:p-8",
  /** Wide in-page modal (e.g. Social Feed expand). */
  modalPanel5xl: `w-full max-w-5xl overflow-hidden rounded-2xl ${raisedSurface} shadow-2xl`,
  modalSubHeaderBar: "flex items-center justify-between border-b border-zinc-800/70 px-4 py-3",
} as const;

/** Shared page chrome inside `contentWell` (route headers, etc.). */
export const terminalChrome = {
  headerRule: "border-b border-zinc-800/60",
} as const;
