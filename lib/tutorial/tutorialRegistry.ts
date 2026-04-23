import type { HelpTier } from "@/lib/helpRole";

/** Mirrors {@link HelpTier}; tutorial content is filtered by dashboard capabilities. */
export type TutorialTier = HelpTier;

export type TutorialSection = {
  id: string;
  label: string;
};

export type TutorialStep = {
  /** Logical section id for progress + Help page “Jump to”. */
  section: string;
  /** CSS selector for a `data-tutorial` anchor. */
  target: string;
  title: string;
  content: string;
  /** When set, the tour navigates here before this step is shown (first paint on that route). */
  route?: string;
};

function sel(id: string): string {
  return `[data-tutorial="${id}"]`;
}

const SECTION_LABELS: Record<string, string> = {
  intro: "Intro",
  sidebar: "Sidebar",
  topNav: "Top bar",
  dashboard: "Home dashboard",
  watchlist: "Watchlist",
  staffModeration: "Moderation (staff)",
  adminPanel: "Admin",
};

const USER_STEPS: TutorialStep[] = [
  {
    section: "intro",
    target: sel("sidebar.logo"),
    route: "/",
    title: "Welcome to McGBot",
    content:
      "This short tour highlights the main areas of the terminal. You can skip anytime, or pick a section later from Help → Tutorial mode.",
  },
  {
    section: "sidebar",
    target: sel("sidebar.nav.dashboard"),
    route: "/",
    title: "Dashboard",
    content: "Your live hub for performance, quick actions, and activity. You can return here from the logo or this link.",
  },
  {
    section: "sidebar",
    target: sel("sidebar.nav.calls"),
    route: "/",
    title: "Call log",
    content: "Browse verified calls, filters, and history across the arena.",
  },
  {
    section: "sidebar",
    target: sel("sidebar.nav.performance"),
    route: "/",
    title: "Performance lab",
    content: "Dig into stats, streaks, and how your calls behave over time.",
  },
  {
    section: "sidebar",
    target: sel("sidebar.nav.watchlist"),
    route: "/",
    title: "Watchlist",
    content: "Track tokens you care about; we’ll open the watchlist page in a moment.",
  },
  {
    section: "sidebar",
    target: sel("sidebar.nav.botCalls"),
    route: "/",
    title: "Bot calls",
    content: "Pro-tier bot signals and automation-facing calls live here.",
  },
  {
    section: "sidebar",
    target: sel("sidebar.nav.trustedPro"),
    route: "/",
    title: "Trusted Pro",
    content: "Curated deep-dive calls from vetted pros (read-only for most users).",
  },
  {
    section: "sidebar",
    target: sel("sidebar.nav.leaderboard"),
    route: "/",
    title: "Leaderboards",
    content: "Daily and arena rankings so you can see who’s printing.",
  },
  {
    section: "sidebar",
    target: sel("sidebar.nav.pnlShowcase"),
    route: "/",
    title: "PnL showcase",
    content: "Community PnL highlights and flex boards.",
  },
  {
    section: "topNav",
    target: sel("nav.openSidebar"),
    route: "/",
    title: "Mobile sidebar",
    content: "On smaller screens, open the full nav from here.",
  },
  {
    section: "topNav",
    target: sel("nav.tokenSearch"),
    route: "/",
    title: "Token search",
    content: "Jump to a mint or symbol quickly (same idea as the / shortcut when focus isn’t in a field).",
  },
  {
    section: "topNav",
    target: sel("nav.notifications"),
    route: "/",
    title: "Notifications",
    content: "Bell for approvals, bugs, features, and system pings.",
  },
  {
    section: "topNav",
    target: sel("nav.userMenu"),
    route: "/",
    title: "Account menu",
    content: "Profile, settings, billing, and sign-out live here.",
  },
  {
    section: "dashboard",
    target: sel("dashboard.performanceChart"),
    route: "/",
    title: "Performance chart",
    content: "Rolling view of how recent calls are behaving — zooms with your data.",
  },
  {
    section: "dashboard",
    target: sel("dashboard.personalStats"),
    route: "/",
    title: "Personal stats",
    content: "Your averages, streaks, and key KPIs at a glance.",
  },
  {
    section: "dashboard",
    target: sel("dashboard.quickActions"),
    route: "/",
    title: "Quick actions",
    content: "Fast paths: submit a call, profile, watchlist shortcuts, and more.",
  },
  {
    section: "dashboard",
    target: sel("dashboard.quickActions.submitCall"),
    route: "/",
    title: "Submit call",
    content: "Post a verified call into the pipeline when you’re ready.",
  },
  {
    section: "watchlist",
    target: sel("watchlist.header"),
    route: "/watchlist",
    title: "Watchlist",
    content: "Track tickers and mints you want on your radar.",
  },
  {
    section: "watchlist",
    target: sel("watchlist.manage"),
    route: "/watchlist",
    title: "Manage entries",
    content: "Edit or remove rows you no longer need.",
  },
  {
    section: "watchlist",
    target: sel("watchlist.input"),
    route: "/watchlist",
    title: "Add a token",
    content: "Paste a contract or symbol, then add it to the list.",
  },
  {
    section: "watchlist",
    target: sel("watchlist.addButton"),
    route: "/watchlist",
    title: "Confirm add",
    content: "Commit the row once the input looks good.",
  },
];

const MOD_EXTRA_STEPS: TutorialStep[] = [
  {
    section: "staffModeration",
    target: sel("dashboard.modQueue"),
    route: "/",
    title: "Mod queue (home)",
    content: "A compact slice of pending items also lives on the dashboard for fast triage.",
  },
  {
    section: "staffModeration",
    target: sel("sidebar.nav.moderation"),
    route: "/",
    title: "Moderation",
    content: "Open the full staff queue for calls, Trusted Pro posts, and related review.",
  },
  {
    section: "staffModeration",
    target: sel("moderation.header"),
    route: "/moderation",
    title: "Staff command center",
    content: "Review pending bot calls, parity items, and queue health before they hit X or Discord surfaces.",
  },
  {
    section: "staffModeration",
    target: sel("moderation.queueStats"),
    route: "/moderation",
    title: "Queue stats",
    content: "Live counts for totals, McGBot items, other calls, and dev submissions.",
  },
];

const ADMIN_EXTRA_STEPS: TutorialStep[] = [
  {
    section: "adminPanel",
    target: sel("sidebar.nav.admin"),
    route: "/moderation",
    title: "Admin",
    content: "Configuration, subscriptions, site flags, and inbox tools — staff-only.",
  },
  {
    section: "adminPanel",
    target: sel("admin.overview"),
    route: "/admin",
    title: "Admin overview",
    content: "Jump into subscription bypass, bot controls, site flags, bugs, and feature requests.",
  },
];

export function normalizeTutorialTier(tier: HelpTier): TutorialTier {
  return tier;
}

export function getTutorialSteps(tier: TutorialTier): TutorialStep[] {
  if (tier === "admin") return [...USER_STEPS, ...MOD_EXTRA_STEPS, ...ADMIN_EXTRA_STEPS];
  if (tier === "mod") return [...USER_STEPS, ...MOD_EXTRA_STEPS];
  return USER_STEPS;
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
