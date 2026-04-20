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
