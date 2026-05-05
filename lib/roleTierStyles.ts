/**
 * Consistent role colors across the dashboard:
 * - Admin → red
 * - Mod → green (emerald)
 * - User → blue (sky)
 */

export type StaffRoleLabel = "admin" | "mod" | "user";

export function normalizeStaffRole(role: string | undefined | null): StaffRoleLabel {
  if (role === "admin") return "admin";
  if (role === "mod") return "mod";
  return "user";
}

/** Active nav rail / marker */
export function tierNavBarClass(tier: StaffRoleLabel): string {
  if (tier === "admin") return "bg-red-500";
  if (tier === "mod") return "bg-emerald-400";
  return "bg-sky-400";
}

/** Small status dot (e.g. profile avatar) */
export function tierStatusDotClass(tier: StaffRoleLabel): string {
  if (tier === "admin") return "bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.75)]";
  if (tier === "mod") return "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.55)]";
  return "bg-sky-400 shadow-[0_0_6px_rgba(56,189,248,0.55)]";
}

/** Admin chrome (control plane, destructive-ish actions) */
export const adminChrome = {
  kicker: "text-red-300/85",
  borderSoft: "border-red-500/20",
  borderMedium: "border-red-500/35",
  heroFrom: "from-red-950/45",
  heroVia: "via-zinc-950/80",
  heroTo: "to-zinc-950",
  glow: "shadow-[0_0_40px_-12px_rgba(239,68,68,0.35)]",
  blob: "bg-red-500/18",
  code: "text-red-200/90",
  btnGhostHover: "hover:border-red-500/45 hover:text-white",
  btnPrimary:
    "rounded-lg bg-gradient-to-r from-red-600 to-red-500 px-5 py-2 text-xs font-bold text-white shadow-lg shadow-red-950/45 transition hover:from-red-500 hover:to-red-400 disabled:cursor-not-allowed disabled:opacity-40",
  inputFocus: "focus:border-red-500/50 focus:outline-none focus:ring-1 focus:ring-red-500/30",
  checkbox: "text-red-600 focus:ring-red-500/50",
  navActive:
    "border-red-500/35 bg-gradient-to-br from-red-950/50 to-zinc-950/80 text-white shadow-[0_0_24px_-4px_rgba(239,68,68,0.32)]",
  navMarker: "bg-red-400 shadow-[0_0_10px_rgba(248,113,113,0.75)]",
  navIconActive: "text-red-300",
  overviewRing:
    "rounded-2xl bg-gradient-to-br from-red-500/25 via-red-600/10 to-transparent p-[1px] transition group-hover:from-red-400/35 group-hover:shadow-[0_0_32px_-8px_rgba(239,68,68,0.42)]",
  overviewArrow: "text-red-300/85 transition group-hover:translate-x-0.5 group-hover:text-red-200",
} as const;

/** Same horizontal fade as `marketStripBackdrop` — use for 1px rules so borders don’t cut across the whole column. */
const marketStripEdgeMask =
  "[mask-image:linear-gradient(to_right,transparent_0%,transparent_26%,rgba(0,0,0,0.55)_48%,black_72%,black_100%)] [-webkit-mask-image:linear-gradient(to_right,transparent_0%,transparent_26%,rgba(0,0,0,0.55)_48%,black_72%,black_100%)]";

/**
 * Authenticated app shell — shared “McGBot Terminal” depth (sky + subtle grid).
 * Page-specific themes (admin red, mod emerald) sit on top as panels, not second full-page fills.
 */
export const dashboardChrome = {
  /** Main column below TopBar */
  mainStage:
    "relative flex min-h-0 flex-1 flex-col overflow-x-hidden bg-[color:var(--mcg-stage)]",
  mainGlow:
    "pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_110%_70%_at_50%_-25%,rgba(56,189,248,0.11),transparent_52%),radial-gradient(ellipse_55%_45%_at_100%_0%,rgba(16,185,129,0.06),transparent_42%),radial-gradient(ellipse_50%_50%_at_0%_100%,rgba(139,92,246,0.045),transparent_48%)]",
  mainGrid:
    "pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(82,82,91,0.09)_1px,transparent_1px),linear-gradient(90deg,rgba(82,82,91,0.09)_1px,transparent_1px)] bg-[length:44px_44px] opacity-[0.22] [mask-image:linear-gradient(to_bottom,black_0%,black_55%,transparent_100%)]",
  contentWell:
    "relative z-[1] mx-auto w-full max-w-[1680px] px-3 pb-10 pt-1 sm:px-8 sm:pb-14 sm:pt-2 min-[480px]:px-5",
  /** Bottom edge uses `topBarBottomRule` so the line fades left like the market strip (no full-width `border-b`). */
  topBar:
    "relative bg-zinc-950/85 backdrop-blur-xl shadow-[0_1px_0_0_rgba(56,189,248,0.07),0_12px_40px_-20px_rgba(0,0,0,0.65)]",
  topBarBottomRule: `pointer-events-none absolute inset-x-0 bottom-0 z-[2] h-px bg-zinc-800/75 ${marketStripEdgeMask}`,
  /**
   * Second row under TopBar — frosted layer fades out to the left so page titles stay sharp;
   * chips stay on the right (see TopBar).
   */
  marketStripRow: "relative overflow-hidden",
  marketStripTopRule: `pointer-events-none absolute inset-x-0 top-0 z-[1] h-px bg-zinc-800/50 ${marketStripEdgeMask}`,
  marketStripBackdrop: `pointer-events-none absolute inset-0 bg-gradient-to-l from-zinc-950/80 via-zinc-950/28 to-transparent backdrop-blur-[12px] ${marketStripEdgeMask}`,
  sidebar:
    "border-r border-zinc-800/65 bg-gradient-to-b from-[#040508] via-zinc-950 to-black shadow-[inset_-1px_0_0_rgba(56,189,248,0.06)]",
} as const;

/** Staff / mod queue pages — emerald, same family as `tierNavBarClass("mod")` */
export const modChrome = {
  kicker: "text-emerald-300/80",
  borderSoft: "border-emerald-500/18",
  borderMedium: "border-emerald-500/32",
  /** Sticky queue summary — depth aligned with admin control-plane panels */
  headerBg:
    "border border-emerald-500/22 bg-gradient-to-br from-emerald-950/50 via-[#060806]/96 to-[#030403]/98 shadow-[inset_0_1px_0_0_rgba(63,63,70,0.3),0_0_48px_-20px_rgba(16,185,129,0.28)]",
  h2: "text-[13px] font-semibold tracking-tight text-emerald-100/90",
  statTile:
    "rounded-xl border border-emerald-900/35 bg-gradient-to-b from-emerald-950/25 to-black/40 px-3 py-2.5 text-center shadow-[inset_0_1px_0_0_rgba(63,63,70,0.26)]",
  card:
    "rounded-xl border border-emerald-500/16 bg-gradient-to-br from-emerald-950/28 via-zinc-950/70 to-black/55 p-3.5 shadow-[0_12px_40px_-24px_rgba(0,0,0,0.75),inset_0_1px_0_0_rgba(63,63,70,0.24)] transition hover:border-emerald-400/30 hover:from-emerald-950/36 hover:via-zinc-900/75 hover:to-black/60",
  emptyState:
    "border border-dashed border-emerald-600/28 bg-gradient-to-b from-emerald-950/15 to-zinc-950/40",
  refreshBtn:
    "border-emerald-700/45 bg-emerald-950/35 hover:border-emerald-400/55 hover:bg-emerald-900/40 focus-visible:ring-emerald-500/35",
  /** Moderation page root (global shell provides bg — keep layout only here) */
  pageShell: "relative min-h-[calc(100vh-5rem)] overflow-x-hidden",
  pageInner: "relative z-[1]",
  /** Full-bleed layer: same grid math as `app/admin/layout.tsx` (32px, 0.04 / 0.35 opacity). */
  layoutGrid:
    "pointer-events-none -z-10 opacity-[0.35] [background-image:linear-gradient(rgba(82,82,91,0.14)_1px,transparent_1px),linear-gradient(90deg,rgba(82,82,91,0.14)_1px,transparent_1px)] [background-size:32px_32px]",
  /** Admin layout uses `bg-red-600/15`; staff queue uses emerald. */
  layoutGlow: "pointer-events-none absolute -left-6 -top-6 h-48 w-48 rounded-full bg-emerald-500/14 blur-3xl",
  /** Admin-style headline, emerald accent on the end */
  heroTitle:
    "bg-gradient-to-r from-white via-zinc-100 to-emerald-300/85 bg-clip-text text-transparent drop-shadow-[0_0_24px_rgba(16,185,129,0.12)]",
  heroUnderline: "h-px w-20 rounded-full bg-gradient-to-r from-emerald-400/90 via-teal-500/50 to-transparent shadow-[0_0_14px_rgba(52,211,153,0.35)]",
  sectionAccent: "mt-0.5 h-4 w-0.5 shrink-0 rounded-full bg-gradient-to-b from-emerald-400 to-teal-600 shadow-[0_0_10px_rgba(52,211,153,0.4)]",
  railPanel:
    "rounded-2xl border border-emerald-500/22 bg-gradient-to-b from-emerald-950/40 via-zinc-950/85 to-black/90 p-4 shadow-[inset_0_1px_0_0_rgba(63,63,70,0.3),0_24px_48px_-24px_rgba(0,0,0,0.88)] backdrop-blur-sm",
  railKicker: "text-[10px] font-bold uppercase tracking-[0.22em] text-emerald-400/75",
  railMetric:
    "rounded-xl border border-emerald-900/32 bg-black/40 px-3 py-2.5 shadow-[inset_0_1px_0_0_rgba(63,63,70,0.26)]",
  /** In-page section nav (mirrors `adminChrome` — emerald accent) */
  navActive:
    "border-emerald-500/35 bg-gradient-to-br from-emerald-950/50 to-zinc-950/80 text-white shadow-[0_0_24px_-4px_rgba(16,185,129,0.28)]",
  navMarker: "bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.75)]",
  navIconActive: "text-emerald-300",
} as const;
