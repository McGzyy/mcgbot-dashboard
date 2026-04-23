import type { HelpTier } from "@/lib/helpRole";
import type { TutorialTrackId } from "@/lib/tutorial/tutorialVersions";

export type TutorialSection = { id: string; label: string };

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
  skipScroll?: boolean;
};

export type TutorialStepContext = {
  ownProfilePath?: string;
};

function sel(id: string): string {
  return `[data-tutorial="${id}"]`;
}

const USER_SECTION_LABELS: Record<string, string> = {
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
};

const MOD_SECTION_LABELS: Record<string, string> = {
  dashboard: "Home · queue preview",
  staffModeration: "Moderation desk",
};

const ADMIN_SECTION_LABELS: Record<string, string> = {
  adminPanel: "Admin overview",
};

function dashboardIntroSteps(): TutorialStep[] {
  return [
    {
      section: "dashboard",
      target: sel("sidebar.nav.dashboard"),
      route: "/",
      title: "Dashboard",
      content:
        "Home base: charts, stats, quick actions, and (for staff) a queue preview. Next: performance, then the top bar, then the rest of this page.",
      placement: "right",
      scrollOffset: 72,
      skipScroll: true,
    },
    {
      section: "dashboard",
      target: sel("dashboard.performanceChart"),
      route: "/",
      title: "Performance",
      content:
        "Call performance and win rate over time. Use W / M / 3M / A to change the window. Tutorial controls live under Help.",
      placement: "bottom",
      scrollOffset: 120,
      skipScroll: true,
    },
  ];
}

function dashboardTopBarSteps(): TutorialStep[] {
  const skip = { skipScroll: true as const };
  return [
    {
      section: "topNav",
      target: sel("nav.tokenSearch"),
      route: "/",
      title: "Token search",
      content:
        "Search by symbol or contract. When focus is not in a field, press / to open search from anywhere.",
      placement: "bottom",
      scrollOffset: 88,
      ...skip,
    },
    {
      section: "topNav",
      target: sel("nav.notifications"),
      route: "/",
      title: "Notifications",
      content: "Bell for staff decisions, bug and feature updates, and other inbox-style alerts.",
      placement: "bottom",
      scrollOffset: 88,
      ...skip,
    },
    {
      section: "topNav",
      target: sel("nav.userMenu"),
      route: "/",
      title: "Account menu",
      content:
        "Profile, settings, help, referrals, sign out. Next we walk each row while the menu stays open.",
      placement: "bottom",
      scrollOffset: 88,
      ...skip,
    },
  ];
}

function dashboardAccountMenuRows(): TutorialStep[] {
  const common = { route: "/", placement: "left" as const, scrollOffset: 72, openAccountMenu: true, skipScroll: true };
  return [
    {
      section: "accountMenu",
      target: sel("nav.menu.profile"),
      title: "Profile",
      content: "Your public profile. The caller tour opens your live profile page after Performance lab.",
      ...common,
    },
    {
      section: "accountMenu",
      target: sel("nav.menu.settings"),
      title: "Settings",
      content: "Account, notifications, public visibility, and dashboard widget toggles—we tour this page later.",
      ...common,
    },
    {
      section: "accountMenu",
      target: sel("nav.menu.help"),
      title: "Help",
      content: "Docs, FAQ, bugs, features, and tutorial controls.",
      ...common,
    },
    {
      section: "accountMenu",
      target: sel("nav.menu.referralsOverview"),
      title: "Referrals — overview",
      content: "Your link and aggregate stats; sub-links open performance and rewards views.",
      ...common,
    },
    {
      section: "accountMenu",
      target: sel("nav.menu.referralsPerformance"),
      title: "Referrals — performance",
      content: "Leaderboard-style view of referred callers.",
      ...common,
    },
    {
      section: "accountMenu",
      target: sel("nav.menu.referralsRewards"),
      title: "Referrals — rewards",
      content: "Rewards and milestones for your network.",
      ...common,
    },
  ];
}

function dashboardBodySteps(): TutorialStep[] {
  return [
    {
      section: "dashboard",
      target: sel("dashboard.personalStats"),
      route: "/",
      title: "Personal stats",
      content: "Averages, win rate, streak, totals, and recent highlights from your verified calls.",
      placement: "top",
      scrollOffset: 130,
      skipScroll: true,
    },
    {
      section: "dashboard",
      target: sel("dashboard.quickActions"),
      route: "/",
      title: "Quick actions",
      content: "Submit a call, profile, watchlist shortcuts, referral link, and more without leaving home.",
      placement: "top",
      scrollOffset: 130,
      skipScroll: true,
    },
  ];
}

function dashboardModQueueStep(): TutorialStep[] {
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

function watchlistChapter(): TutorialStep[] {
  return [
    {
      section: "watchlist",
      target: sel("sidebar.nav.watchlist"),
      route: "/watchlist",
      title: "Watchlist",
      content: "Private tokens you track for the terminal. Next: add and manage rows on this page.",
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
      content: "Your verified calls only, line by line. Next: filters and the table.",
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
      content: "Summaries, activity, and distribution from the same data as Call log.",
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

function profileChapter(ownProfilePath: string): TutorialStep[] {
  return [
    {
      section: "profile",
      target: sel("profile.header"),
      route: ownProfilePath,
      title: "Profile header",
      content: "Banner, avatar, badges, bio, and actions visitors or you see on your card.",
      placement: "bottom",
      scrollOffset: 120,
    },
    {
      section: "profile",
      target: sel("profile.performance"),
      route: ownProfilePath,
      title: "On-card performance",
      content: "Public averages, win rate, totals, and hit rates you choose to show.",
      placement: "top",
      scrollOffset: 130,
    },
    {
      section: "profile",
      target: sel("profile.trophies"),
      route: ownProfilePath,
      title: "Trophy case",
      content: "Daily / weekly / monthly ladders plus milestone club picks.",
      placement: "top",
      scrollOffset: 130,
    },
    {
      section: "profile",
      target: sel("profile.recentCalls"),
      route: ownProfilePath,
      title: "Recent calls",
      content: "Latest verified calls others can browse from your profile.",
      placement: "top",
      scrollOffset: 130,
    },
  ];
}

function settingsChapter(): TutorialStep[] {
  return [
    {
      section: "settings",
      target: sel("settings.account"),
      route: "/settings",
      title: "Account & X",
      content: "Link X, milestone @mention rules, and how you appear on approved posts.",
      placement: "top",
      scrollOffset: 130,
    },
    {
      section: "settings",
      target: sel("settings.notifications"),
      route: "/settings",
      title: "Notifications",
      content: "In-dashboard alerts: scope (your calls vs global), sounds, and quiet hours.",
      placement: "top",
      scrollOffset: 130,
    },
    {
      section: "settings",
      target: sel("settings.publicProfile"),
      route: "/settings",
      title: "Public profile",
      content: "Toggle which stats, trophies, calls, and distribution visitors can see.",
      placement: "top",
      scrollOffset: 130,
    },
    {
      section: "settings",
      target: sel("settings.dashboardLayout"),
      route: "/settings",
      title: "Dashboard layout",
      content: "Show or hide home widgets like market strip, rank, and staff previews.",
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
      title: "Tutorial mode",
      content: "Restart tours, jump to a section, or reset progress per track (caller / mod / admin).",
      placement: "top",
      scrollOffset: 120,
    },
    {
      section: "help",
      target: sel("help.reportBug"),
      route: "/help",
      title: "Report a bug",
      content: "Submit issues to the team; you get a bell when it is closed.",
      placement: "top",
      scrollOffset: 120,
    },
    {
      section: "help",
      target: sel("help.featureRequest"),
      route: "/help",
      title: "Feature requests",
      content: "Ideas for the dashboard or bot—triaged like bugs.",
      placement: "top",
      scrollOffset: 120,
    },
    {
      section: "help",
      target: sel("help.docs"),
      route: "/help",
      title: "Role docs",
      content: "Caller, moderator, and admin handbooks sized to your access.",
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
      content: "Totals, active callers, best performer, and conversion (when wired).",
      placement: "top",
      scrollOffset: 130,
    },
    {
      section: "referrals",
      target: sel("referrals.flow"),
      route: "/referrals",
      title: "How it flows",
      content: "Share link → friends sign up on McGBot → performance rolls up here.",
      placement: "top",
      scrollOffset: 130,
    },
    {
      section: "referrals",
      target: sel("referrals.lists"),
      route: "/referrals",
      title: "Recent signups & performance",
      content: "Latest referrals and per-user averages at a glance.",
      placement: "top",
      scrollOffset: 130,
    },
  ];
}

/** Full caller-facing tour (everyone runs this track for the shared terminal). */
export function getUserTutorialSteps(tier: HelpTier, ctx?: TutorialStepContext): TutorialStep[] {
  const own = ctx?.ownProfilePath?.trim();
  const out: TutorialStep[] = [
    ...dashboardIntroSteps(),
    ...dashboardTopBarSteps(),
    ...dashboardAccountMenuRows(),
    ...dashboardBodySteps(),
    ...(tier === "mod" || tier === "admin" ? dashboardModQueueStep() : []),
    ...watchlistChapter(),
    ...callLogChapter(),
    ...performanceChapter(),
  ];
  if (own) out.push(...profileChapter(own));
  out.push(...settingsChapter(), ...helpChapter(), ...referralsChapter());
  return out;
}

/** Moderator-only tour: queue preview on home, then the full moderation desk. */
export function getModTutorialSteps(): TutorialStep[] {
  return [
    ...dashboardModQueueStep(),
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
      title: "Command center",
      content: "Context for what lands in this queue and how it ties to Discord approvals.",
      placement: "bottom",
      scrollOffset: 130,
    },
    {
      section: "staffModeration",
      target: sel("moderation.liveQueue"),
      route: "/moderation",
      title: "Live queue strip",
      content: "Refresh, timestamps, and quick counts for Trusted Pro intake alongside call totals.",
      placement: "bottom",
      scrollOffset: 130,
    },
    {
      section: "staffModeration",
      target: sel("moderation.queueStats"),
      route: "/moderation",
      title: "Queue counters",
      content: "Totals split between McGBot calls, other pending calls, and dev submissions.",
      placement: "top",
      scrollOffset: 130,
    },
  ];
}

/** Administrator-only tour: overview snapshot and each workspace entry point. */
export function getAdminTutorialSteps(): TutorialStep[] {
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
      target: sel("admin.intro"),
      route: "/admin",
      title: "Overview",
      content: "Jump cards mirror serious workspaces; stats above summarize live health.",
      placement: "bottom",
      scrollOffset: 120,
    },
    {
      section: "adminPanel",
      target: sel("admin.stats"),
      route: "/admin",
      title: "Live snapshot",
      content: "Scanner flag, Discord socket, users, subscriptions, and coarse retention.",
      placement: "top",
      scrollOffset: 130,
    },
    {
      section: "adminPanel",
      target: sel("admin.card.subscription"),
      route: "/admin",
      title: "Subscription access",
      content: "Bypass list and exempt Discord IDs for dashboard access.",
      placement: "top",
      scrollOffset: 120,
    },
    {
      section: "adminPanel",
      target: sel("admin.card.bot"),
      route: "/admin",
      title: "Bot controls",
      content: "Health checks and scanner toggles (same effect as Discord commands).",
      placement: "top",
      scrollOffset: 120,
    },
    {
      section: "adminPanel",
      target: sel("admin.card.site"),
      route: "/admin",
      title: "Site & flags",
      content: "Maintenance mode, banners, paywall, and live Supabase-backed settings.",
      placement: "top",
      scrollOffset: 120,
    },
    {
      section: "adminPanel",
      target: sel("admin.card.bugs"),
      route: "/admin",
      title: "Bug reports",
      content: "Triage user bugs, leave notes, close with a bell back to the reporter.",
      placement: "top",
      scrollOffset: 120,
    },
    {
      section: "adminPanel",
      target: sel("admin.card.features"),
      route: "/admin",
      title: "Feature requests",
      content: "Same workflow as bugs for product ideas.",
      placement: "top",
      scrollOffset: 120,
    },
  ];
}

export function getTutorialSteps(track: TutorialTrackId, tier: HelpTier, ctx?: TutorialStepContext): TutorialStep[] {
  if (track === "user") return getUserTutorialSteps(tier, ctx);
  if (track === "mod") return getModTutorialSteps();
  return getAdminTutorialSteps();
}

function sectionLabel(track: TutorialTrackId, id: string): string {
  if (track === "admin") return ADMIN_SECTION_LABELS[id] ?? id;
  if (track === "mod") return MOD_SECTION_LABELS[id] ?? id;
  return USER_SECTION_LABELS[id] ?? id;
}

export function getTutorialSections(track: TutorialTrackId, tier: HelpTier, ctx?: TutorialStepContext): TutorialSection[] {
  const steps = getTutorialSteps(track, tier, ctx);
  const seen = new Set<string>();
  const out: TutorialSection[] = [];
  for (const s of steps) {
    if (seen.has(s.section)) continue;
    seen.add(s.section);
    out.push({ id: s.section, label: sectionLabel(track, s.section) });
  }
  return out;
}

export function availableTutorialTracks(tier: HelpTier): TutorialTrackId[] {
  if (tier === "admin") return ["user", "mod", "admin"];
  if (tier === "mod") return ["user", "mod"];
  return ["user"];
}
