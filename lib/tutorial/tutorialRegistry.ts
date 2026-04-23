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
  botCalls: "Bot calls",
  trustedPro: "Trusted Pro",
  leaderboard: "Leaderboards",
  pnlShowcase: "PnL Showcase",
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

/** First step on `/`: general welcome before top bar or widgets. */
function dashboardWelcomeStep(): TutorialStep[] {
  return [
    {
      section: "dashboard",
      target: sel("dashboard.tutorialWelcome"),
      route: "/",
      title: "Welcome to McGBot Terminal",
      content:
        "This tour follows the top bar (with a quick pass over the account menu), then each home widget, then every main page in the left nav with a short page overview before its modules. We return for full Profile, Settings, Help, and Referrals tours from the account menu. Skip or restart anytime from Help → Tutorial mode.",
      placement: "center",
      scrollOffset: 72,
      skipScroll: true,
    },
  ];
}

/** After the account-menu preview: full-page home overview, then widget steps. */
function dashboardHomePageIntro(): TutorialStep[] {
  return [
    {
      section: "dashboard",
      target: sel("dashboard.pageIntro"),
      route: "/",
      title: "Home dashboard",
      content:
        "Your hub: chart, personal stats, feeds, quick actions, Discord chat, and previews. Next we walk each block—then Call log, Performance lab, Watchlist, and the Arena pages on the left, followed by deeper tours of Profile, Settings, Help, and Referrals from the account menu.",
      placement: "center",
      scrollOffset: 72,
      skipScroll: true,
      closeAccountMenu: true,
    },
  ];
}

/** After account-menu rows: closes the dropdown, then spotlights the main chart before personal stats. */
function dashboardHomePerformanceStep(): TutorialStep[] {
  return [
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
      closeAccountMenu: true,
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
      content:
        "Your public profile card—quick preview. Later we open your profile and walk each section.",
      ...common,
    },
    {
      section: "accountMenu",
      target: sel("nav.menu.settings"),
      title: "Settings",
      content: "Account, notifications, widgets, and layout—preview only; full Settings tour after the left-nav pages.",
      ...common,
    },
    {
      section: "accountMenu",
      target: sel("nav.menu.help"),
      title: "Help",
      content: "Docs, FAQ, bugs, features, and tutorial controls—preview only; full Help tour after Settings.",
      ...common,
    },
    {
      section: "accountMenu",
      target: sel("nav.menu.referralsOverview"),
      title: "Referrals — overview",
      content: "Your link and network stats—preview only; full Referrals tour last.",
      ...common,
    },
    {
      section: "accountMenu",
      target: sel("nav.menu.referralsPerformance"),
      title: "Referrals — performance",
      content: "Referred callers’ performance—preview only; covered again on Referrals.",
      ...common,
    },
    {
      section: "accountMenu",
      target: sel("nav.menu.referralsRewards"),
      title: "Referrals — rewards",
      content: "Rewards-style view—preview only; covered again on Referrals.",
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
      closeAccountMenu: true,
    },
  ];
}

const dashHome: Pick<TutorialStep, "section" | "route"> = { section: "dashboard", route: "/" };

function dashboardMainFeedSteps(): TutorialStep[] {
  return [
    {
      ...dashHome,
      target: sel("dashboard.activityFeed"),
      title: "Activity feed",
      content: "Live-style stream of notable calls and moves (when the Activity widget is enabled in Settings).",
      placement: "top",
      scrollOffset: 148,
    },
    {
      ...dashHome,
      target: sel("dashboard.topPerformers"),
      title: "Top performers today",
      content: "Standout callers for the UTC day—ranks refresh as calls verify.",
      placement: "top",
      scrollOffset: 148,
    },
    {
      ...dashHome,
      target: sel("dashboard.socialFeed"),
      title: "Social feed",
      content: "Curated X posts and highlights wired into the terminal.",
      placement: "top",
      scrollOffset: 148,
    },
    {
      ...dashHome,
      target: sel("dashboard.trending"),
      title: "Trending tokens",
      content: "What the desk is watching right now (when the market strip / trending widget is on).",
      placement: "top",
      scrollOffset: 148,
    },
  ];
}

function dashboardQuickActionsRailStep(): TutorialStep[] {
  return [
    {
      section: "dashboard",
      target: sel("dashboard.quickActions"),
      route: "/",
      title: "Quick actions & rail",
      content:
        "Submit call, profile shortcuts, watchlist modal, referral copy—when the Quick Actions widget is on it sits here. Mods/admins also see the staff queue card in this column.",
      placement: "top",
      scrollOffset: 148,
    },
  ];
}

function dashboardRightColumnLowerSteps(): TutorialStep[] {
  return [
    {
      ...dashHome,
      target: sel("dashboard.discordChat"),
      title: "Discord chat",
      content: "Terminal chat with callers; staff see an extra mod tab when configured.",
      placement: "top",
      scrollOffset: 148,
    },
    {
      ...dashHome,
      target: sel("dashboard.dailyLeaderboard"),
      title: "Daily leaderboard",
      content: "Snapshot of today’s leaderboard race on your dashboard (when enabled).",
      placement: "top",
      scrollOffset: 148,
    },
    {
      ...dashHome,
      target: sel("dashboard.homeRecentCalls"),
      title: "Recent calls (home)",
      content: "Last few verified calls with a shortcut into the full call log.",
      placement: "top",
      scrollOffset: 148,
    },
    {
      ...dashHome,
      target: sel("dashboard.homeWatchlist"),
      title: "Watchlist preview",
      content: "A peek at saved contracts; the full editor is on the Watchlist page after Call log and Performance lab.",
      placement: "top",
      scrollOffset: 148,
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
      scrollOffset: 148,
    },
  ];
}

function callLogPageIntro(): TutorialStep[] {
  return [
    {
      section: "calls",
      target: sel("calls.header"),
      route: "/calls",
      title: "Call log",
      content:
        "Your verified calls only—time windows, totals, and the table. Next: switch 7d / 30d / all time, then the rows.",
      placement: "bottom",
      scrollOffset: 100,
      skipScroll: true,
    },
  ];
}

function performancePageIntro(): TutorialStep[] {
  return [
    {
      section: "performance",
      target: sel("performance.header"),
      route: "/performance",
      title: "Performance lab",
      content:
        "Same calls as Call log, summarized: headline stats, 14-day activity, multiple mix, and rank. Next: the summary tiles.",
      placement: "bottom",
      scrollOffset: 100,
      skipScroll: true,
    },
  ];
}

function watchlistPageIntro(): TutorialStep[] {
  return [
    {
      section: "watchlist",
      target: sel("watchlist.header"),
      route: "/watchlist",
      title: "Watchlist",
      content:
        "Private and public Solana contract lists for quick chart jumps. Next: scope, add row, and saved contracts.",
      placement: "bottom",
      scrollOffset: 100,
      skipScroll: true,
      closeAccountMenu: true,
    },
  ];
}

function watchlistPageSteps(): TutorialStep[] {
  return [
    {
      section: "watchlist",
      target: sel("watchlist.manage"),
      route: "/watchlist",
      title: "Private / public & list",
      content: "Toggle scope, refresh, and browse or remove saved mints for the active list.",
      placement: "top",
      scrollOffset: 120,
    },
    {
      section: "watchlist",
      target: sel("watchlist.input"),
      route: "/watchlist",
      title: "Add contracts",
      content: "Paste a valid mint, then Add. Rows dedupe automatically.",
      placement: "top",
      scrollOffset: 120,
    },
  ];
}

function botCallsPageIntro(): TutorialStep[] {
  return [
    {
      section: "botCalls",
      target: sel("botCalls.header"),
      route: "/bot-calls",
      title: "Bot calls",
      content:
        "Live McGBot scanner feed (Pro): time windows, min multiple, excluded toggle, and the tape. Next: filters.",
      placement: "bottom",
      scrollOffset: 100,
      skipScroll: true,
    },
  ];
}

function botCallsPageSteps(): TutorialStep[] {
  return [
    {
      section: "botCalls",
      target: sel("botCalls.filters"),
      route: "/bot-calls",
      title: "Filters",
      content: "24h / 7d / all time, minimum ×, and whether excluded calls show in the list.",
      placement: "bottom",
      scrollOffset: 96,
    },
    {
      section: "botCalls",
      target: sel("botCalls.table"),
      route: "/bot-calls",
      title: "Bot call table",
      content: "Each row: timing, token, live and ATH multiples, status, Dex and chart shortcuts.",
      placement: "top",
      scrollOffset: 120,
    },
  ];
}

function trustedProPageIntro(): TutorialStep[] {
  return [
    {
      section: "trustedPro",
      target: sel("trustedPro.header"),
      route: "/trusted-pro",
      title: "Trusted Pro",
      content:
        "Longform thesis posts from Trusted Pro members; everyone reads, only approved members submit. Next: the public feed.",
      placement: "bottom",
      scrollOffset: 100,
      skipScroll: true,
    },
  ];
}

function trustedProPageSteps(): TutorialStep[] {
  return [
    {
      section: "trustedPro",
      target: sel("trustedPro.feed"),
      route: "/trusted-pro",
      title: "Trusted Pro feed",
      content: "Published calls with thesis, narrative, views, and timestamps—apply or submit from the header when eligible.",
      placement: "top",
      scrollOffset: 120,
    },
  ];
}

function leaderboardPageIntro(): TutorialStep[] {
  return [
    {
      section: "leaderboard",
      target: sel("leaderboard.header"),
      route: "/leaderboard",
      title: "Leaderboards",
      content:
        "Public arena: spotlight leaders, records, caller boards, and top single-call multiples—separate from your private Call log and Performance lab. Next: spotlight cards.",
      placement: "bottom",
      scrollOffset: 100,
      skipScroll: true,
    },
  ];
}

function leaderboardPageSteps(): TutorialStep[] {
  return [
    {
      section: "leaderboard",
      target: sel("leaderboard.spotlight"),
      route: "/leaderboard",
      title: "Spotlight leaders",
      content: "Daily, weekly, and monthly faces on the board with best and average multiples.",
      placement: "top",
      scrollOffset: 130,
    },
    {
      section: "leaderboard",
      target: sel("leaderboard.userBoard"),
      route: "/leaderboard",
      title: "User leaderboard",
      content: "Ranked callers for the selected timeframe—avg, best, win rate, calls, and rank deltas.",
      placement: "top",
      scrollOffset: 130,
    },
    {
      section: "leaderboard",
      target: sel("leaderboard.topCalls"),
      route: "/leaderboard",
      title: "Top single calls",
      content: "Highest multiples and time-to-ATH for standout individual calls in the window.",
      placement: "top",
      scrollOffset: 130,
    },
  ];
}

function pnlShowcasePageIntro(): TutorialStep[] {
  return [
    {
      section: "pnlShowcase",
      target: sel("pnlShowcase.header"),
      route: "/pnl-showcase",
      title: "PnL Showcase",
      content:
        "Verified realized and unrealized PnLs from on-chain data for tokens you’ve called—post from here when eligible. Next: the public feed.",
      placement: "bottom",
      scrollOffset: 100,
      skipScroll: true,
    },
  ];
}

function pnlShowcasePageSteps(): TutorialStep[] {
  return [
    {
      section: "pnlShowcase",
      target: sel("pnlShowcase.feed"),
      route: "/pnl-showcase",
      title: "Verified posts",
      content: "Recent showcase cards with % moves, SOL figures, wallet and token context, and refresh.",
      placement: "top",
      scrollOffset: 130,
    },
  ];
}

function profilePageIntro(ownProfilePath: string): TutorialStep[] {
  return [
    {
      section: "profile",
      target: sel("profile.pageIntro"),
      route: ownProfilePath,
      title: "Your profile",
      content:
        "What others see: banner, avatar, bio, optional performance, trophies, and recent calls. Next: the header and actions.",
      placement: "center",
      scrollOffset: 100,
      skipScroll: true,
    },
  ];
}

function settingsPageIntro(): TutorialStep[] {
  return [
    {
      section: "settings",
      target: sel("settings.header"),
      route: "/settings",
      title: "Settings",
      content:
        "Link Discord/X, notifications, public profile visibility, and which home widgets render. Next: Account & X.",
      placement: "center",
      scrollOffset: 120,
      skipScroll: true,
    },
  ];
}

function helpPageIntro(): TutorialStep[] {
  return [
    {
      section: "help",
      target: sel("help.header"),
      route: "/help",
      title: "Help",
      content: "Tutorial controls, bug and feature forms, and role-sized handbooks. Next: Tutorial mode.",
      placement: "center",
      scrollOffset: 120,
      skipScroll: true,
    },
  ];
}

function referralsPageIntro(): TutorialStep[] {
  return [
    {
      section: "referrals",
      target: sel("referrals.hero"),
      route: "/referrals",
      title: "Referrals",
      content: "Share your link, track signups, and see how referred callers perform. Next: link hub and copy tools.",
      placement: "center",
      scrollOffset: 120,
      skipScroll: true,
    },
  ];
}

function callLogPageSteps(): TutorialStep[] {
  return [
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

function performancePageSteps(): TutorialStep[] {
  return [
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
export function getUserTutorialSteps(_tier: HelpTier, ctx?: TutorialStepContext): TutorialStep[] {
  const own = ctx?.ownProfilePath?.trim();
  const out: TutorialStep[] = [
    ...dashboardWelcomeStep(),
    ...dashboardTopBarSteps(),
    ...dashboardAccountMenuRows(),
    ...dashboardHomePageIntro(),
    ...dashboardHomePerformanceStep(),
    ...dashboardBodySteps(),
    ...dashboardMainFeedSteps(),
    ...dashboardQuickActionsRailStep(),
    ...dashboardRightColumnLowerSteps(),
    ...callLogPageIntro(),
    ...callLogPageSteps(),
    ...performancePageIntro(),
    ...performancePageSteps(),
    ...watchlistPageIntro(),
    ...watchlistPageSteps(),
    ...botCallsPageIntro(),
    ...botCallsPageSteps(),
    ...trustedProPageIntro(),
    ...trustedProPageSteps(),
    ...leaderboardPageIntro(),
    ...leaderboardPageSteps(),
    ...pnlShowcasePageIntro(),
    ...pnlShowcasePageSteps(),
  ];
  if (own) out.push(...profilePageIntro(own), ...profileChapter(own));
  out.push(
    ...settingsPageIntro(),
    ...settingsChapter(),
    ...helpPageIntro(),
    ...helpChapter(),
    ...referralsPageIntro(),
    ...referralsChapter()
  );
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
