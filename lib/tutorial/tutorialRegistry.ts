import type { HelpTier } from "@/lib/helpRole";

/** Mirrors {@link HelpTier}; steps are composed per tier in {@link getTutorialSteps}. */
export type TutorialTier = HelpTier;

export type TutorialSection = {
  id: string;
  label: string;
};

export type TutorialStep = {
  /** Logical section for Help “Jump to” and completion tracking. */
  section: string;
  /** CSS selector for a `data-tutorial` anchor. */
  target: string;
  title: string;
  content: string;
  /** When set, the tour navigates here before this step is shown. */
  route?: string;
  /** Joyride tooltip placement (`auto` lets Floating UI pick). */
  placement?: "auto" | "top" | "bottom" | "left" | "right" | "center";
  /** Extra offset (px) from the top when scrolling the target into view (sticky header). */
  scrollOffset?: number;
};

function sel(id: string): string {
  return `[data-tutorial="${id}"]`;
}

const SECTION_LABELS: Record<string, string> = {
  dashboard: "Home dashboard",
  topNav: "Top bar",
  sidebar: "Navigation",
  watchlist: "Watchlist",
  staffModeration: "Moderation (mods)",
  adminPanel: "Admin (admins)",
};

/** Everyone: home surface first, then chrome, then other routes. */
const DASHBOARD_STEPS: TutorialStep[] = [
  {
    section: "dashboard",
    target: sel("dashboard.performanceChart"),
    route: "/",
    title: "Performance",
    content:
      "Start here on the home dashboard: your call performance and win rate over time. Use W / M / 3M / A to change the range. You can skip or resume this tour anytime under Help → Tutorial mode.",
    placement: "bottom",
    scrollOffset: 120,
  },
  {
    section: "dashboard",
    target: sel("dashboard.personalStats"),
    route: "/",
    title: "Personal stats",
    content:
      "A quick read on how you are doing: average multiple, win rate, streak, totals, and recent highlights—all tied to your verified calls.",
    placement: "top",
    scrollOffset: 130,
  },
  {
    section: "dashboard",
    target: sel("dashboard.quickActions"),
    route: "/",
    title: "Quick actions",
    content:
      "Shortcuts without leaving home: submit a call, open your profile, jump to watchlist actions, referral link, and more.",
    placement: "top",
    scrollOffset: 130,
  },
];

/** Mods and admins only (element exists on home for these roles). */
const DASHBOARD_MOD_STEPS: TutorialStep[] = [
  {
    section: "staffModeration",
    target: sel("dashboard.modQueue"),
    route: "/",
    title: "Queue preview",
    content:
      "A slice of the approval queue also lives on the dashboard so you can spot pending work the moment you land.",
    placement: "top",
    scrollOffset: 140,
  },
];

const TOP_NAV_STEPS: TutorialStep[] = [
  {
    section: "topNav",
    target: sel("nav.tokenSearch"),
    route: "/",
    title: "Token search",
    content:
      "Search by symbol or contract. When focus is not inside a field, press / to open search from anywhere.",
    placement: "bottom",
    scrollOffset: 88,
  },
  {
    section: "topNav",
    target: sel("nav.notifications"),
    route: "/",
    title: "Notifications",
    content: "Bell for staff decisions, bug and feature updates, and other inbox-style messages.",
    placement: "bottom",
    scrollOffset: 88,
  },
  {
    section: "topNav",
    target: sel("nav.userMenu"),
    route: "/",
    title: "Account",
    content: "Profile, settings, subscription status, and sign out.",
    placement: "bottom",
    scrollOffset: 88,
  },
];

/** One pass over the left rail (desktop); mobile menu button is hidden on large screens. */
const SIDEBAR_STEPS: TutorialStep[] = [
  {
    section: "sidebar",
    target: sel("sidebar.logo"),
    route: "/",
    title: "Navigation rail",
    content:
      "Use the left rail to move between dashboard, your call tools, arena pages, and—if you have access—staff areas.",
    placement: "right",
    scrollOffset: 72,
  },
];

const WATCHLIST_STEPS: TutorialStep[] = [
  {
    section: "watchlist",
    target: sel("watchlist.header"),
    route: "/watchlist",
    title: "Watchlist",
    content:
      "Private tokens you track for the dashboard. Open Manage to edit rows, or add a new line below when you have a mint or ticker ready.",
    placement: "bottom",
    scrollOffset: 120,
  },
  {
    section: "watchlist",
    target: sel("watchlist.input"),
    route: "/watchlist",
    title: "Add tokens",
    content: "Paste a contract or symbol, then tap Add to save it to your list.",
    placement: "top",
    scrollOffset: 120,
  },
];

/** Mods and admins: moderation entry + desk (not shown to callers). */
const MODERATION_STEPS: TutorialStep[] = [
  {
    section: "staffModeration",
    target: sel("sidebar.nav.moderation"),
    route: "/",
    title: "Moderation",
    content: "Opens the full staff queue for approvals, Trusted Pro posts, and related review work.",
    placement: "right",
    scrollOffset: 72,
  },
  {
    section: "staffModeration",
    target: sel("moderation.header"),
    route: "/moderation",
    title: "Moderation desk",
    content:
      "Review pending items, refresh the live queue, and read the counters (totals, McGBot calls, other sources, dev submissions).",
    placement: "bottom",
    scrollOffset: 130,
  },
];

/** Admins only. */
const ADMIN_STEPS: TutorialStep[] = [
  {
    section: "adminPanel",
    target: sel("sidebar.nav.admin"),
    route: "/moderation",
    title: "Admin",
    content:
      "Subscription bypass lists, bot controls, site flags, bug inbox, and feature requests—reserved for admins.",
    placement: "right",
    scrollOffset: 72,
  },
  {
    section: "adminPanel",
    target: sel("admin.overview"),
    route: "/admin",
    title: "Admin overview",
    content:
      "Pick a workspace: subscription access, bot health and scanner, site settings, bug reports, and feature requests.",
    placement: "bottom",
    scrollOffset: 120,
  },
];

export function normalizeTutorialTier(tier: HelpTier): TutorialTier {
  return tier;
}

export function getTutorialSteps(tier: TutorialTier): TutorialStep[] {
  const out: TutorialStep[] = [...DASHBOARD_STEPS];
  if (tier === "mod" || tier === "admin") {
    out.push(...DASHBOARD_MOD_STEPS);
  }
  out.push(...TOP_NAV_STEPS, ...SIDEBAR_STEPS, ...WATCHLIST_STEPS);
  if (tier === "mod" || tier === "admin") {
    out.push(...MODERATION_STEPS);
  }
  if (tier === "admin") {
    out.push(...ADMIN_STEPS);
  }
  return out;
}

export function getTutorialSections(tier: TutorialTier): TutorialSection[] {
  const steps = getTutorialSteps(tier);
  const seen = new Set<string>();
  const out: TutorialSection[] = [];
  for (const s of steps) {
    if (seen.has(s.section)) continue;
    seen.add(s.section);
    out.push({ id: s.section, label: SECTION_LABELS[s.section] ?? s.section });
  }
  return out;
}
