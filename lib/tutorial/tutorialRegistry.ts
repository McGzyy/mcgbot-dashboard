import type { HelpTier } from "@/lib/helpRole";

export type TutorialTier = HelpTier;

export type TutorialSection = {
  id: string;
  label: string;
};

export type TutorialStep = {
  section: string;
  target: string;
  title: string;
  content: string;
  /** When set, the tour expects this pathname before showing the step (navigation runs first). */
  route?: string;
  placement?: "auto" | "top" | "bottom" | "left" | "right" | "center";
  scrollOffset?: number;
  openAccountMenu?: boolean;
  closeAccountMenu?: boolean;
  /** When true, passed to Joyride as `skipScroll` to avoid scroll fighting the spotlight. */
  skipScroll?: boolean;
};

export type TutorialStepContext = {
  ownProfilePath?: string;
};

function sel(id: string): string {
  return `[data-tutorial="${id}"]`;
}

const SECTION_LABELS: Record<string, string> = {
  dashboard: "Home dashboard",
  watchlist: "Watchlist",
  calls: "Call log",
  performance: "Performance lab",
  topNav: "Top bar",
  accountMenu: "Account menu",
  profile: "Your profile",
  settings: "Settings",
  help: "Help",
  referrals: "Referrals",
  staffModeration: "Moderation (mods)",
  adminPanel: "Admin (admins)",
};

/** All on `/`: sidebar intro → main widgets → (mod queue) → header chrome → account menu rows. */
function dashboardHomeSteps(): TutorialStep[] {
  return [
    {
      section: "dashboard",
      target: sel("sidebar.nav.dashboard"),
      route: "/",
      title: "Dashboard",
      content:
        "Home: performance, stats, quick actions, and staff queue preview. Next we walk each block on this page, then the top bar and account menu—still from here.",
      placement: "right",
      scrollOffset: 72,
    },
    {
      section: "dashboard",
      target: sel("dashboard.performanceChart"),
      route: "/",
      title: "Performance",
      content:
        "Call performance and win rate over time. Use W / M / 3M / A to change the window. Skip or resume under Help → Tutorial mode.",
      placement: "bottom",
      scrollOffset: 120,
    },
    {
      section: "dashboard",
      target: sel("dashboard.personalStats"),
      route: "/",
      title: "Personal stats",
      content:
        "Averages, win rate, streak, totals, and recent highlights from your verified calls.",
      placement: "top",
      scrollOffset: 130,
    },
    {
      section: "dashboard",
      target: sel("dashboard.quickActions"),
      route: "/",
      title: "Quick actions",
      content:
        "Submit a call, profile, watchlist shortcuts, referral link, and more without leaving home.",
      placement: "top",
      scrollOffset: 130,
    },
  ];
}

function dashboardModSteps(): TutorialStep[] {
  return [
    {
      section: "dashboard",
      target: sel("dashboard.modQueue"),
      route: "/",
      title: "Staff queue preview",
      content:
        "Moderators and admins see a compact pending queue here so you can triage without opening Moderation.",
      placement: "top",
      scrollOffset: 140,
      skipScroll: true,
    },
  ];
}

/** Top bar while still on home (`/`). */
function dashboardTopBarSteps(): TutorialStep[] {
  return [
    {
      section: "topNav",
      target: sel("nav.tokenSearch"),
      route: "/",
      title: "Token search",
      content: "Search by symbol or contract. When focus is not in a field, press / to open search from anywhere.",
      placement: "bottom",
      scrollOffset: 88,
    },
    {
      section: "topNav",
      target: sel("nav.notifications"),
      route: "/",
      title: "Notifications",
      content: "Bell for staff decisions, bug and feature updates, and other inbox-style alerts.",
      placement: "bottom",
      scrollOffset: 88,
    },
    {
      section: "topNav",
      target: sel("nav.userMenu"),
      route: "/",
      title: "Account menu",
      content: "Opens profile, settings, help, referrals, and sign out. Next we highlight each entry—still from the dashboard.",
      placement: "bottom",
      scrollOffset: 88,
    },
  ];
}

/** Account dropdown rows on `/` (no page navigation yet). */
function dashboardAccountMenuRows(): TutorialStep[] {
  return [
    {
      section: "accountMenu",
      target: sel("nav.menu.profile"),
      route: "/",
      title: "Profile",
      content: "Your public profile card. We tour the live page after watchlist, call log, and performance.",
      placement: "left",
      scrollOffset: 72,
      openAccountMenu: true,
    },
    {
      section: "accountMenu",
      target: sel("nav.menu.settings"),
      route: "/",
      title: "Settings",
      content: "Dashboard layout, notifications, profile visibility, and X linking—we open this page later in the tour.",
      placement: "left",
      scrollOffset: 72,
    },
    {
      section: "accountMenu",
      target: sel("nav.menu.help"),
      route: "/",
      title: "Help",
      content: "Docs, FAQ, bugs, features, and Tutorial controls. We visit Help after Settings.",
      placement: "left",
      scrollOffset: 72,
    },
    {
      section: "accountMenu",
      target: sel("nav.menu.referralsOverview"),
      route: "/",
      title: "Referrals",
      content: "Overview: your link, network stats, and entry points to performance and rewards.",
      placement: "left",
      scrollOffset: 72,
      openAccountMenu: true,
    },
    {
      section: "accountMenu",
      target: sel("nav.menu.referralsPerformance"),
      route: "/",
      title: "Referral performance",
      content: "Leaderboard-style view of how referred callers are performing.",
      placement: "left",
      scrollOffset: 72,
      openAccountMenu: true,
    },
    {
      section: "accountMenu",
      target: sel("nav.menu.referralsRewards"),
      route: "/",
      title: "Referral rewards",
      content: "Track rewards and milestones tied to your referral network.",
      placement: "left",
      scrollOffset: 72,
      openAccountMenu: true,
    },
  ];
}

/** Navigate first (navWait), then sidebar, then widgets only—no duplicate page headers. */
function watchlistChapter(): TutorialStep[] {
  return [
    {
      section: "watchlist",
      target: sel("sidebar.nav.watchlist"),
      route: "/watchlist",
      title: "Watchlist",
      content:
        "Private tokens you track for the terminal. Next: add and manage rows on this page.",
      placement: "right",
      scrollOffset: 72,
      closeAccountMenu: true,
    },
    {
      section: "watchlist",
      target: sel("watchlist.input"),
      route: "/watchlist",
      title: "Add tokens",
      content: "Paste a mint or ticker, then confirm with Add. Use Manage to edit or remove rows.",
      placement: "top",
      scrollOffset: 120,
    },
  ];
}

function callLogChapter(): TutorialStep[] {
  return [
    {
      section: "calls",
      target: sel("sidebar.nav.calls"),
      route: "/calls",
      title: "Call log",
      content:
        "Your verified calls only, line by line. Next: filters and the table—no extra intro on this page.",
      placement: "right",
      scrollOffset: 72,
    },
    {
      section: "calls",
      target: sel("calls.filters"),
      route: "/calls",
      title: "Time windows",
      content: "Switch between 7 days, 30 days, or all time to change which rows load.",
      placement: "bottom",
      scrollOffset: 96,
    },
    {
      section: "calls",
      target: sel("calls.table"),
      route: "/calls",
      title: "Call table",
      content: "Each row: timing, token, live and ATH multiples, status, source, and outbound links.",
      placement: "top",
      scrollOffset: 120,
    },
  ];
}

function performanceChapter(): TutorialStep[] {
  return [
    {
      section: "performance",
      target: sel("sidebar.nav.performance"),
      route: "/performance",
      title: "Performance lab",
      content:
        "Summaries, activity, and distribution from the same data as Call log. Next: the metric cards, chart, and multiple mix.",
      placement: "right",
      scrollOffset: 72,
    },
    {
      section: "performance",
      target: sel("performance.summary"),
      route: "/performance",
      title: "Summary metrics",
      content: "Averages, medians, win rate, rolling rank, totals, best multiples, hit rates, and streak.",
      placement: "top",
      scrollOffset: 130,
    },
    {
      section: "performance",
      target: sel("performance.activity"),
      route: "/performance",
      title: "Activity chart",
      content: "Two-week view: call count per UTC day and average ATH multiple per day.",
      placement: "top",
      scrollOffset: 130,
    },
    {
      section: "performance",
      target: sel("performance.distribution"),
      route: "/performance",
      title: "Multiple mix",
      content: "How your calls stack into ATH buckets (under 2×, 2–5×, 5×+).",
      placement: "top",
      scrollOffset: 130,
    },
  ];
}

function profilePageSteps(ownProfilePath: string): TutorialStep[] {
  return [
    {
      section: "profile",
      target: sel("profile.header"),
      route: ownProfilePath,
      title: "Your profile",
      content:
        "What others see: banner, badges, call highlights, Trusted Pro posts, and edit controls when it is your profile.",
      placement: "bottom",
      scrollOffset: 120,
    },
  ];
}

function settingsChapter(): TutorialStep[] {
  return [
    {
      section: "settings",
      target: sel("settings.account"),
      route: "/settings",
      title: "Settings",
      content:
        "Account & X: link your handle, milestone @mention rules, and how you appear on approved posts. Use the section nav for notifications, public profile, and dashboard widget toggles.",
      placement: "top",
      scrollOffset: 130,
    },
  ];
}

function helpChapter(): TutorialStep[] {
  return [
    {
      section: "help",
      target: sel("help.tutorialPanel"),
      route: "/help",
      title: "Help & tutorial",
      content:
        "Role docs and FAQ live here. Tutorial mode lets you restart this tour or jump to a section.",
      placement: "top",
      scrollOffset: 120,
    },
  ];
}

function referralsChapter(): TutorialStep[] {
  return [
    {
      section: "referrals",
      target: sel("referrals.linkHub"),
      route: "/referrals",
      title: "Your referral link",
      content: "Copy your URL and share it; signups attach here.",
      placement: "top",
      scrollOffset: 120,
    },
    {
      section: "referrals",
      target: sel("referrals.stats"),
      route: "/referrals",
      title: "Network snapshot",
      content: "Totals, active callers, and top performers in your network.",
      placement: "top",
      scrollOffset: 130,
    },
  ];
}

function moderationChapter(): TutorialStep[] {
  return [
    {
      section: "staffModeration",
      target: sel("sidebar.nav.moderation"),
      route: "/moderation",
      title: "Moderation",
      content: "Full approval desk for bot calls, Trusted Pro posts, and related staff workflows.",
      placement: "right",
      scrollOffset: 72,
    },
    {
      section: "staffModeration",
      target: sel("moderation.header"),
      route: "/moderation",
      title: "Moderation desk",
      content: "Queue, refresh, and live counters for totals, McGBot items, other calls, and dev submissions.",
      placement: "bottom",
      scrollOffset: 130,
    },
  ];
}

function adminChapter(): TutorialStep[] {
  return [
    {
      section: "adminPanel",
      target: sel("sidebar.nav.admin"),
      route: "/admin",
      title: "Admin",
      content: "Subscription bypass, bot controls, site flags, bugs, and feature requests.",
      placement: "right",
      scrollOffset: 72,
    },
    {
      section: "adminPanel",
      target: sel("admin.overview"),
      route: "/admin",
      title: "Admin overview",
      content: "Pick a workspace card to drill into each area.",
      placement: "bottom",
      scrollOffset: 120,
    },
  ];
}

export function normalizeTutorialTier(tier: HelpTier): TutorialTier {
  return tier;
}

export function getTutorialSteps(tier: TutorialTier, ctx?: TutorialStepContext): TutorialStep[] {
  const own = ctx?.ownProfilePath?.trim();
  const out: TutorialStep[] = [
    ...dashboardHomeSteps(),
    ...(tier === "mod" || tier === "admin" ? dashboardModSteps() : []),
    ...dashboardTopBarSteps(),
    ...dashboardAccountMenuRows(),
    ...watchlistChapter(),
    ...callLogChapter(),
    ...performanceChapter(),
  ];

  if (own) {
    out.push(...profilePageSteps(own));
  }
  out.push(...settingsChapter(), ...helpChapter(), ...referralsChapter());

  if (tier === "mod" || tier === "admin") {
    out.push(...moderationChapter());
  }
  if (tier === "admin") {
    out.push(...adminChapter());
  }
  return out;
}

export function getTutorialSections(tier: TutorialTier, ctx?: TutorialStepContext): TutorialSection[] {
  const steps = getTutorialSteps(tier, ctx);
  const seen = new Set<string>();
  const out: TutorialSection[] = [];
  for (const s of steps) {
    if (seen.has(s.section)) continue;
    seen.add(s.section);
    out.push({ id: s.section, label: SECTION_LABELS[s.section] ?? s.section });
  }
  return out;
}
