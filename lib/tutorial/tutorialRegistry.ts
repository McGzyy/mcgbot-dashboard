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
  route?: string;
  placement?: "auto" | "top" | "bottom" | "left" | "right" | "center";
  scrollOffset?: number;
  openAccountMenu?: boolean;
  closeAccountMenu?: boolean;
};

export type TutorialStepContext = {
  ownProfilePath?: string;
};

function sel(id: string): string {
  return `[data-tutorial="${id}"]`;
}

const SECTION_LABELS: Record<string, string> = {
  dashboard: "Home dashboard",
  calls: "Call log",
  performance: "Performance lab",
  watchlist: "Watchlist",
  topNav: "Top bar",
  accountMenu: "Account menu",
  profile: "Your profile",
  settings: "Settings",
  help: "Help",
  referrals: "Referrals",
  staffModeration: "Moderation (mods)",
  adminPanel: "Admin (admins)",
};

function dashboardSteps(): TutorialStep[] {
  return [
    {
      section: "dashboard",
      target: sel("sidebar.nav.dashboard"),
      route: "/",
      title: "Dashboard",
      content:
        "Your home surface: performance charts, personal stats, quick actions, and (for staff) a queue preview. Next we walk the widgets on this page.",
      placement: "right",
      scrollOffset: 72,
    },
    {
      section: "dashboard",
      target: sel("dashboard.performanceChart"),
      route: "/",
      title: "Performance",
      content:
        "Call performance and win rate over time. Use W / M / 3M / A to change the window. Skip or resume the tour anytime under Help → Tutorial mode.",
      placement: "bottom",
      scrollOffset: 120,
    },
    {
      section: "dashboard",
      target: sel("dashboard.personalStats"),
      route: "/",
      title: "Personal stats",
      content:
        "Snapshot of how you are doing: averages, win rate, streak, totals, and recent call highlights from your verified activity.",
      placement: "top",
      scrollOffset: 130,
    },
    {
      section: "dashboard",
      target: sel("dashboard.quickActions"),
      route: "/",
      title: "Quick actions",
      content:
        "Fast paths from home: submit a call, open your profile, watchlist shortcuts, referral link, and more without hunting the sidebar.",
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
        "Moderators and admins also see a compact pending queue here so nothing slips by while you are on the dashboard.",
      placement: "top",
      scrollOffset: 140,
    },
  ];
}

function callLogSteps(): TutorialStep[] {
  return [
    {
      section: "calls",
      target: sel("sidebar.nav.calls"),
      route: "/",
      title: "Call log",
      content:
        "Line-by-line history of your verified calls only—sources show how each row was logged. Next we open the page and tour the layout.",
      placement: "right",
      scrollOffset: 72,
    },
    {
      section: "calls",
      target: sel("calls.header"),
      route: "/calls",
      title: "Call log page",
      content:
        "Read totals for the selected window, scan when each call hit, live vs ATH multiples, and jump out to Dex or the original post.",
      placement: "bottom",
      scrollOffset: 120,
    },
    {
      section: "calls",
      target: sel("calls.filters"),
      route: "/calls",
      title: "Time windows",
      content: "Switch between 7 days, 30 days, or all time to change which calls load in the table.",
      placement: "bottom",
      scrollOffset: 96,
    },
    {
      section: "calls",
      target: sel("calls.table"),
      route: "/calls",
      title: "Call table",
      content:
        "Each row is one credited call: timing, token, live and ATH multiples, status, source, and quick outbound links.",
      placement: "top",
      scrollOffset: 120,
    },
  ];
}

function performanceLabSteps(): TutorialStep[] {
  return [
    {
      section: "performance",
      target: sel("sidebar.nav.performance"),
      route: "/calls",
      title: "Performance lab",
      content:
        "Deeper analytics from the same call data: distributions, 14-day activity, and weekly rank context. Next we open the lab and tour key blocks.",
      placement: "right",
      scrollOffset: 72,
    },
    {
      section: "performance",
      target: sel("performance.header"),
      route: "/performance",
      title: "Performance lab page",
      content:
        "Summaries sit up top; charts and breakdowns follow. Use Call log when you need raw rows, Leaderboards for community rankings.",
      placement: "bottom",
      scrollOffset: 120,
    },
    {
      section: "performance",
      target: sel("performance.summary"),
      route: "/performance",
      title: "Summary metrics",
      content:
        "Averages, medians, win rate, rolling rank, totals, best multiples, hit rates, and streak—each card calls out what changed recently.",
      placement: "top",
      scrollOffset: 130,
    },
    {
      section: "performance",
      target: sel("performance.activity"),
      route: "/performance",
      title: "Activity chart",
      content: "Two-week view of how often you called and what average ATH multiple looked like each UTC day.",
      placement: "top",
      scrollOffset: 130,
    },
  ];
}

function watchlistSteps(): TutorialStep[] {
  return [
    {
      section: "watchlist",
      target: sel("sidebar.nav.watchlist"),
      route: "/performance",
      title: "Watchlist",
      content:
        "Private tokens you track for the terminal. Next we jump to the watchlist page and cover adding and managing rows.",
      placement: "right",
      scrollOffset: 72,
    },
    {
      section: "watchlist",
      target: sel("watchlist.header"),
      route: "/watchlist",
      title: "Watchlist page",
      content: "Your tracked list lives here—separate from the quick-add modal on the dashboard.",
      placement: "bottom",
      scrollOffset: 120,
    },
    {
      section: "watchlist",
      target: sel("watchlist.input"),
      route: "/watchlist",
      title: "Add a row",
      content: "Paste a mint or ticker, then confirm with Add. Use Manage when you need to edit or remove entries.",
      placement: "top",
      scrollOffset: 120,
    },
  ];
}

function topBarSteps(): TutorialStep[] {
  return [
    {
      section: "topNav",
      target: sel("nav.tokenSearch"),
      route: "/watchlist",
      title: "Token search",
      content:
        "Search by symbol or contract from the header. When you are not typing in a field, press / to open search anywhere.",
      placement: "bottom",
      scrollOffset: 88,
    },
    {
      section: "topNav",
      target: sel("nav.notifications"),
      route: "/watchlist",
      title: "Notifications",
      content: "Bell for staff decisions, bug and feature updates, and other inbox-style alerts.",
      placement: "bottom",
      scrollOffset: 88,
    },
    {
      section: "topNav",
      target: sel("nav.userMenu"),
      route: "/watchlist",
      title: "Account menu",
      content:
        "Your avatar opens profile, settings, help, referrals, and sign out. Next we open the menu and walk those entries.",
      placement: "bottom",
      scrollOffset: 88,
    },
  ];
}

function profileFromMenuSteps(ownProfilePath: string): TutorialStep[] {
  return [
    {
      section: "accountMenu",
      target: sel("nav.menu.profile"),
      route: "/watchlist",
      title: "Profile",
      content:
        "Public profile with banner, badges, call highlights, and Trusted Pro posts when applicable. Opens your canonical profile URL.",
      placement: "left",
      scrollOffset: 72,
      openAccountMenu: true,
    },
    {
      section: "profile",
      target: sel("profile.header"),
      route: ownProfilePath,
      title: "Your profile page",
      content:
        "What others see: performance cues, pinned call, distribution, and social links. Edit from here when it is your own profile.",
      placement: "bottom",
      scrollOffset: 120,
      closeAccountMenu: true,
    },
  ];
}

function settingsFromMenuSteps(lastRouteBeforeMenu: string): TutorialStep[] {
  return [
    {
      section: "accountMenu",
      target: sel("nav.menu.settings"),
      route: lastRouteBeforeMenu,
      title: "Settings",
      content:
        "Dashboard layout toggles, notifications, public profile visibility, X linking, and milestone mention rules. Next we load the settings page.",
      placement: "left",
      scrollOffset: 72,
      openAccountMenu: true,
    },
    {
      section: "settings",
      target: sel("settings.header"),
      route: "/settings",
      title: "Settings page",
      content:
        "Use the section links (desktop) or chips (mobile) to jump between Account & X, notifications, public profile, and dashboard widget toggles.",
      placement: "bottom",
      scrollOffset: 120,
      closeAccountMenu: true,
    },
    {
      section: "settings",
      target: sel("settings.account"),
      route: "/settings",
      title: "Account & X",
      content:
        "Connect X for a verified handle, control milestone @mentions, and manage how you appear on approved posts.",
      placement: "top",
      scrollOffset: 130,
    },
  ];
}

function helpFromMenuSteps(lastRoute: string): TutorialStep[] {
  return [
    {
      section: "accountMenu",
      target: sel("nav.menu.help"),
      route: lastRoute,
      title: "Help",
      content:
        "Role docs, FAQ, bug reports, feature requests, and Tutorial mode live here. Next we open Help.",
      placement: "left",
      scrollOffset: 72,
      openAccountMenu: true,
    },
    {
      section: "help",
      target: sel("help.header"),
      route: "/help",
      title: "Help center",
      content:
        "Documentation scales with your role (caller, moderator, admin). You can restart or jump sections of this tour from Tutorial mode below.",
      placement: "bottom",
      scrollOffset: 120,
      closeAccountMenu: true,
    },
    {
      section: "help",
      target: sel("help.tutorialPanel"),
      route: "/help",
      title: "Tutorial mode",
      content:
        "Start the full tour again, jump to a section, or reset progress so it auto-runs on next login after a schema bump.",
      placement: "top",
      scrollOffset: 120,
    },
  ];
}

function referralsFromMenuSteps(lastRoute: string): TutorialStep[] {
  return [
    {
      section: "accountMenu",
      target: sel("nav.menu.referralsOverview"),
      route: lastRoute,
      title: "Referrals",
      content:
        "Track your link, network quality, and rewards-style stats in one workspace modeled like the rest of the terminal.",
      placement: "left",
      scrollOffset: 72,
      openAccountMenu: true,
    },
    {
      section: "referrals",
      target: sel("referrals.hero"),
      route: "/referrals",
      title: "Referrals overview",
      content:
        "Hero copy explains the program. The account menu also lists Performance and Rewards for deeper slices when you need them.",
      placement: "bottom",
      scrollOffset: 120,
      closeAccountMenu: true,
    },
    {
      section: "referrals",
      target: sel("referrals.linkHub"),
      route: "/referrals",
      title: "Your referral link",
      content: "Copy the live URL, share it anywhere, and watch signups roll into the tables below.",
      placement: "top",
      scrollOffset: 120,
    },
    {
      section: "referrals",
      target: sel("referrals.stats"),
      route: "/referrals",
      title: "Network snapshot",
      content: "Totals, active callers, and top performers give you a quick read on how your network is doing.",
      placement: "top",
      scrollOffset: 130,
    },
  ];
}

function moderationSteps(): TutorialStep[] {
  return [
    {
      section: "staffModeration",
      target: sel("sidebar.nav.moderation"),
      route: "/referrals",
      title: "Moderation",
      content:
        "Full approval desk for bot calls, Trusted Pro posts, and related staff workflows. Next we open the moderation page.",
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
}

function adminSteps(): TutorialStep[] {
  return [
    {
      section: "adminPanel",
      target: sel("sidebar.nav.admin"),
      route: "/moderation",
      title: "Admin",
      content:
        "Subscription bypass lists, bot controls, site flags, bug inbox, and feature requests—reserved for admins. Next we open the console.",
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
}

export function normalizeTutorialTier(tier: HelpTier): TutorialTier {
  return tier;
}

export function getTutorialSteps(tier: TutorialTier, ctx?: TutorialStepContext): TutorialStep[] {
  const own = ctx?.ownProfilePath?.trim();
  const out: TutorialStep[] = [...dashboardSteps()];
  if (tier === "mod" || tier === "admin") {
    out.push(...dashboardModSteps());
  }
  out.push(...callLogSteps(), ...performanceLabSteps(), ...watchlistSteps(), ...topBarSteps());

  if (own) {
    out.push(...profileFromMenuSteps(own));
    out.push(...settingsFromMenuSteps(own));
  } else {
    out.push(...settingsFromMenuSteps("/watchlist"));
  }

  out.push(...helpFromMenuSteps("/settings"), ...referralsFromMenuSteps("/help"));

  if (tier === "mod" || tier === "admin") {
    out.push(...moderationSteps());
  }
  if (tier === "admin") {
    out.push(...adminSteps());
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
