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

/** Staff / mod queue pages — emerald, same family as `tierNavBarClass("mod")` */
export const modChrome = {
  kicker: "text-emerald-300/90",
  borderSoft: "border-emerald-500/18",
  borderMedium: "border-emerald-500/32",
  headerBg:
    "border-emerald-500/25 bg-gradient-to-br from-emerald-950/45 via-[#060806]/95 to-[#050505]/98 shadow-[0_0_40px_-12px_rgba(16,185,129,0.22)]",
  h2: "text-emerald-400/88",
  statTile: "border-emerald-900/35 bg-emerald-950/18",
  card:
    "border-emerald-500/15 bg-gradient-to-br from-emerald-950/22 to-zinc-950/55 shadow-sm shadow-black/25 transition hover:border-emerald-400/28 hover:from-emerald-950/30 hover:to-zinc-900/40",
  emptyState: "border border-dashed border-emerald-700/35 bg-emerald-950/10",
  refreshBtn:
    "border-emerald-800/40 bg-emerald-950/25 hover:border-emerald-500/45 hover:bg-emerald-900/35 focus-visible:ring-emerald-500/30",
  /** Full-page moderation shell */
  pageShell:
    "relative min-h-[calc(100vh-5rem)] overflow-x-hidden bg-[#030806] before:pointer-events-none before:absolute before:inset-0 before:bg-[radial-gradient(ellipse_85%_50%_at_50%_-20%,rgba(16,185,129,0.14),transparent_55%)] after:pointer-events-none after:absolute after:inset-0 after:bg-[linear-gradient(to_bottom,transparent_0%,rgba(0,0,0,0.4)_100%)]",
  pageInner: "relative z-[1]",
  heroTitle:
    "bg-gradient-to-br from-white via-emerald-50/95 to-emerald-400/80 bg-clip-text text-transparent drop-shadow-[0_0_28px_rgba(16,185,129,0.15)]",
  heroUnderline: "h-1 w-14 rounded-full bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-500 shadow-[0_0_12px_rgba(52,211,153,0.45)]",
  railPanel:
    "rounded-2xl border border-emerald-500/20 bg-gradient-to-b from-emerald-950/35 via-zinc-950/80 to-black/90 p-4 shadow-[0_0_0_1px_rgba(16,185,129,0.06),0_24px_48px_-24px_rgba(0,0,0,0.85)] backdrop-blur-sm",
  railKicker: "text-[10px] font-bold uppercase tracking-[0.22em] text-emerald-400/75",
  railMetric: "rounded-xl border border-emerald-900/30 bg-black/35 px-3 py-2.5",
} as const;
