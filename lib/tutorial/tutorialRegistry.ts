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
  /** When true, skip window scroll-to-target (modals, centered welcome, fixed chrome). */
  skipScroll?: boolean;
};

export type TutorialStepContext = {
  ownProfilePath?: string;
};

function sel(id: string): string {
  return `[data-tutorial="${id}"]`;
}

const SECTION_LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  watchlist: "Watchlist",
  calls: "Call log",
  performance: "Performance lab",
  tradeJournal: "Trade journal",
  botCalls: "Bot calls",
  trustedPro: "Trusted Pro",
  leaderboard: "Leaderboards",
  pnlShowcase: "PnL Showcase",
  referrals: "Referrals",
  lounge: "Lounge",
  profile: "Profile",
  settings: "Settings",
  help: "Help",
  staffModeration: "Moderation",
  adminPanel: "Admin",
  adminTreasury: "Treasury",
  topNav: "Top bar",
};

/**
 * One spotlight tour: top bar → home widgets (scroll) → sidebar order (nav on `/`, then page).
 * No “next step” copy; minimal redundant `/` bridges.
 */
export function getUserTutorialSteps(tier: HelpTier, ctx?: TutorialStepContext): TutorialStep[] {
  const own = ctx?.ownProfilePath?.trim();

  const core: TutorialStep[] = [
    {
      section: "dashboard",
      target: sel("dashboard.tutorialWelcome"),
      route: "/",
      title: "Welcome",
      content:
        "Quick pass over the real UI. Skip anytime — replay from Settings (Replay dashboard tour) or Help.",
      placement: "center",
      scrollOffset: 72,
      skipScroll: true,
    },
    {
      section: "topNav",
      target: sel("nav.tokenSearch"),
      route: "/",
      title: "Token search",
      content: "Look up symbols or contracts. Press / when focus isn’t in a field to jump here.",
      placement: "bottom",
      scrollOffset: 88,
    },
    {
      section: "topNav",
      target: sel("nav.notifications"),
      route: "/",
      title: "Notifications",
      content: "Bell inbox: staff decisions, bugs, features, and other alerts.",
      placement: "bottom",
      scrollOffset: 88,
    },
    {
      section: "topNav",
      target: sel("nav.userMenu"),
      route: "/",
      title: "Account menu",
      content: "Profile, Settings, Help, Referrals, sign out.",
      placement: "bottom",
      scrollOffset: 88,
    },
    {
      section: "dashboard",
      target: sel("dashboard.performanceChart"),
      route: "/",
      title: "Performance chart",
      content: "Verified-call performance over time — Performance Lab expands the same data.",
      placement: "bottom",
      scrollOffset: 120,
    },
    {
      section: "dashboard",
      target: sel("dashboard.personalStats"),
      route: "/",
      title: "Personal stats",
      content: "Averages, streak, win rate, and headline totals from your calls.",
      placement: "top",
      scrollOffset: 130,
    },
    {
      section: "dashboard",
      target: sel("dashboard.activityFeed"),
      route: "/",
      title: "Activity pulse",
      content: "Notable moves and context. Turn it off under Settings → Dashboard layout if you want a calmer home.",
      placement: "top",
      scrollOffset: 160,
    },
    {
      section: "dashboard",
      target: sel("dashboard.quickActions"),
      route: "/",
      title: "Quick actions",
      content: "Submit a call, profile, watchlist modal, referral link.",
      placement: "top",
      scrollOffset: 148,
    },
    {
      section: "dashboard",
      target: sel("dashboard.homeWatchlist"),
      route: "/",
      title: "Watchlist preview",
      content: "Saved mints on the home board. The Watchlist page is the full editor.",
      placement: "top",
      scrollOffset: 148,
    },
    {
      section: "dashboard",
      target: sel("dashboard.homeRecentCalls"),
      route: "/",
      title: "Recent calls",
      content: "Latest credited rows from your account. The Call log page is the full filterable table.",
      placement: "top",
      scrollOffset: 148,
    },
    {
      section: "watchlist",
      target: sel("sidebar.nav.watchlist"),
      route: "/",
      title: "Watchlist",
      content: "Private and public contract lists — same link lives here on every page.",
      placement: "right",
      scrollOffset: 72,
      skipScroll: true,
    },
    {
      section: "watchlist",
      target: sel("watchlist.manage"),
      route: "/watchlist",
      title: "Watchlist editor",
      content: "Switch private vs public, paste a Solana mint, add or remove rows.",
      placement: "top",
      scrollOffset: 100,
    },
    {
      section: "botCalls",
      target: sel("sidebar.nav.botCalls"),
      route: "/",
      title: "Bot calls",
      content: "McGBot’s live scanner tape (where your plan includes it).",
      placement: "right",
      scrollOffset: 72,
      skipScroll: true,
    },
    {
      section: "botCalls",
      target: sel("botCalls.header"),
      route: "/bot-calls",
      title: "Bot calls",
      content: "Automation feed: time windows, minimum multiple, excluded toggle, and the tape.",
      placement: "bottom",
      scrollOffset: 100,
    },
    {
      section: "botCalls",
      target: sel("botCalls.table"),
      route: "/bot-calls",
      title: "Scanner tape",
      content: "Live and ATH multiples, status, Dex/chart links — use the chips above to narrow the window.",
      placement: "top",
      scrollOffset: 120,
    },
    {
      section: "trustedPro",
      target: sel("sidebar.nav.trustedPro"),
      route: "/",
      title: "Trusted Pro",
      content: "Thesis-style calls from approved members — readable by everyone.",
      placement: "right",
      scrollOffset: 72,
      skipScroll: true,
    },
    {
      section: "trustedPro",
      target: sel("trustedPro.header"),
      route: "/trusted-pro",
      title: "Trusted Pro",
      content: "Submit or apply from the header when your account qualifies.",
      placement: "bottom",
      scrollOffset: 100,
    },
    {
      section: "trustedPro",
      target: sel("trustedPro.feed"),
      route: "/trusted-pro",
      title: "Trusted Pro feed",
      content: "Longform posts with views and engagement — deeper context than the raw scanner tape.",
      placement: "top",
      scrollOffset: 120,
    },
    {
      section: "leaderboard",
      target: sel("sidebar.nav.leaderboard"),
      route: "/",
      title: "Leaderboards",
      content: "Public scoreboards and spotlights — separate from your private Call log and Performance lab.",
      placement: "right",
      scrollOffset: 72,
      skipScroll: true,
    },
    {
      section: "leaderboard",
      target: sel("leaderboard.header"),
      route: "/leaderboard",
      title: "Leaderboards",
      content: "Arena boards: callers, bot milestones, records — community-wide.",
      placement: "bottom",
      scrollOffset: 100,
    },
    {
      section: "leaderboard",
      target: sel("leaderboard.spotlight"),
      route: "/leaderboard",
      title: "Spotlight boards",
      content: "Daily / weekly / monthly highlights — tabs below switch other boards.",
      placement: "top",
      scrollOffset: 130,
    },
    {
      section: "pnlShowcase",
      target: sel("sidebar.nav.pnlShowcase"),
      route: "/",
      title: "PnL Showcase",
      content: "On-chain verified PnL cards for eligible linked wallets.",
      placement: "right",
      scrollOffset: 72,
      skipScroll: true,
    },
    {
      section: "pnlShowcase",
      target: sel("pnlShowcase.header"),
      route: "/pnl-showcase",
      title: "PnL Showcase",
      content: "Post realized and unrealized results when a wallet qualifies.",
      placement: "bottom",
      scrollOffset: 100,
    },
    {
      section: "pnlShowcase",
      target: sel("pnlShowcase.feed"),
      route: "/pnl-showcase",
      title: "Showcase feed",
      content: "Recent verified cards with % moves and token context.",
      placement: "top",
      scrollOffset: 130,
    },
    {
      section: "calls",
      target: sel("sidebar.nav.calls"),
      route: "/",
      title: "Call log",
      content: "Your credited calls only — line history, not the whole server.",
      placement: "right",
      scrollOffset: 72,
      skipScroll: true,
    },
    {
      section: "calls",
      target: sel("calls.filters"),
      route: "/calls",
      title: "Call log filters",
      content: "7d, 30d, or all time — totals in the corner reflect the active window.",
      placement: "bottom",
      scrollOffset: 100,
    },
    {
      section: "calls",
      target: sel("calls.table"),
      route: "/calls",
      title: "Call log table",
      content: "Each row: when, token snapshot, multiples, source, Dex/chart links.",
      placement: "top",
      scrollOffset: 120,
    },
    {
      section: "performance",
      target: sel("sidebar.nav.performance"),
      route: "/",
      title: "Performance lab",
      content: "Same calls as Call log — charts, distribution, streak, and rolling rank context.",
      placement: "right",
      scrollOffset: 72,
      skipScroll: true,
    },
    {
      section: "performance",
      target: sel("performance.header"),
      route: "/performance",
      title: "Performance lab",
      content: "Header links back to Call log or Leaderboards when you want the raw list or public boards.",
      placement: "bottom",
      scrollOffset: 100,
    },
    {
      section: "performance",
      target: sel("performance.summary"),
      route: "/performance",
      title: "Summary tiles",
      content: "Averages, median, win rate, totals, and your rolling 7d rank among callers.",
      placement: "top",
      scrollOffset: 130,
    },
    {
      section: "tradeJournal",
      target: sel("sidebar.nav.tradeJournal"),
      route: "/",
      title: "Trade journal",
      content: "Private Solana trade log — separate from McGBot calls and milestones.",
      placement: "right",
      scrollOffset: 72,
      skipScroll: true,
    },
    {
      section: "tradeJournal",
      target: sel("tradeJournal.workspace"),
      route: "/trade-journal",
      title: "Trade journal",
      content: "Entries for thesis, levels, wallet touches — export Markdown from the header actions.",
      placement: "bottom",
      scrollOffset: 96,
    },
    {
      section: "referrals",
      target: sel("sidebar.nav.referrals"),
      route: "/",
      title: "Referrals",
      content: "Your referral link and how people who join on it perform.",
      placement: "right",
      scrollOffset: 72,
      skipScroll: true,
    },
    {
      section: "referrals",
      target: sel("referrals.hero"),
      route: "/referrals",
      title: "Referrals",
      content: "Program overview and how attribution works.",
      placement: "center",
      scrollOffset: 120,
    },
    {
      section: "referrals",
      target: sel("referrals.linkHub"),
      route: "/referrals",
      title: "Link hub",
      content: "Vanity slug or Discord ID link — copy buttons and quick stats.",
      placement: "top",
      scrollOffset: 120,
    },
    {
      section: "lounge",
      target: sel("sidebar.nav.loungeDiscordChats"),
      route: "/",
      title: "Discord chats",
      content: "Read-only mirror of configured Discord channels inside the terminal.",
      placement: "right",
      scrollOffset: 72,
      skipScroll: true,
    },
    {
      section: "lounge",
      target: sel("lounge.discordChats"),
      route: "/lounge/discord-chats",
      title: "Discord chats",
      content: "General and staff tabs when available — names link to dashboard profiles.",
      placement: "bottom",
      scrollOffset: 100,
    },
    {
      section: "lounge",
      target: sel("sidebar.nav.loungeVoiceChats"),
      route: "/",
      title: "Voice chats",
      content: "Premium voice tables when the feature flag is on for your account.",
      placement: "right",
      scrollOffset: 72,
      skipScroll: true,
    },
    {
      section: "lounge",
      target: sel("lounge.voiceChats"),
      route: "/lounge/voice-chats",
      title: "Voice chats",
      content: "Lobby list and join flow — moderation tools appear for eligible staff.",
      placement: "bottom",
      scrollOffset: 100,
    },
  ];

  if (own) {
    core.push(
      {
        section: "profile",
        target: sel("nav.menu.profile"),
        route: "/",
        title: "Profile",
        content: "Your public card opens from the account menu.",
        placement: "bottom",
        scrollOffset: 88,
        skipScroll: true,
        openAccountMenu: true,
      },
      {
        section: "profile",
        target: sel("profile.pageIntro"),
        route: own,
        title: "Your profile",
        content: "What others see: banner, avatar, bio, optional stats, trophies, and recent calls.",
        placement: "center",
        scrollOffset: 100,
        closeAccountMenu: true,
      },
      {
        section: "profile",
        target: sel("profile.header"),
        route: own,
        title: "Profile header",
        content: "Edit card, follow state for visitors, pinned call when you set one.",
        placement: "bottom",
        scrollOffset: 120,
      }
    );
  }

  core.push(
    {
      section: "settings",
      target: sel("settings.header"),
      route: "/settings",
      title: "Settings",
      content: "Notifications, public profile toggles, linked wallets, and which home widgets render.",
      placement: "center",
      scrollOffset: 120,
      skipScroll: true,
    },
    {
      section: "settings",
      target: sel("settings.dashboardLayout"),
      route: "/settings",
      title: "Dashboard layout",
      content: "Show or hide market pulse, feeds, quick actions, Discord chat, and more.",
      placement: "top",
      scrollOffset: 130,
    },
    {
      section: "help",
      target: sel("help.header"),
      route: "/help",
      title: "Help",
      content: "Role docs, FAQ, bug and feature forms.",
      placement: "center",
      scrollOffset: 120,
      skipScroll: true,
    },
    {
      section: "help",
      target: sel("help.tutorialPanel"),
      route: "/help",
      title: "Tutorial",
      content: "Start this tour again, jump to a section, or reset progress.",
      placement: "top",
      scrollOffset: 120,
    }
  );

  if (tier === "mod" || tier === "admin") {
    core.push(
      {
        section: "staffModeration",
        target: sel("sidebar.nav.moderation"),
        route: "/",
        title: "Moderation",
        content: "Staff queues for approvals and mirrored Discord intake — details in onboarding.",
        placement: "right",
        scrollOffset: 72,
        skipScroll: true,
      },
      {
        section: "staffModeration",
        target: sel("moderation.header"),
        route: "/moderation",
        title: "Moderation desk",
        content: "Live queue plus Supabase-backed desks your team triages together.",
        placement: "bottom",
        scrollOffset: 120,
      }
    );
  }

  if (tier === "admin") {
    core.push(
      {
        section: "adminPanel",
        target: sel("sidebar.nav.admin"),
        route: "/",
        title: "Admin",
        content: "Subscriptions, bot controls, site flags, bugs, feature requests — overview on the next screen.",
        placement: "right",
        scrollOffset: 72,
        skipScroll: true,
      },
      {
        section: "adminPanel",
        target: sel("admin.intro"),
        route: "/admin",
        title: "Admin overview",
        content: "Jump cards into each workspace; stats summarize live health.",
        placement: "bottom",
        scrollOffset: 120,
      },
      {
        section: "adminTreasury",
        target: sel("sidebar.nav.treasury"),
        route: "/",
        title: "Treasury",
        content: "SOL treasuries, Stripe balance, tips, voucher pool.",
        placement: "right",
        scrollOffset: 72,
        skipScroll: true,
      },
      {
        section: "adminTreasury",
        target: sel("admin.treasury"),
        route: "/admin/treasury",
        title: "Treasury hub",
        content: "Balances and payment rails — staff onboarding covers workflows.",
        placement: "bottom",
        scrollOffset: 120,
      }
    );
  }

  core.push({
    section: "dashboard",
    target: sel("dashboard.tutorialWelcome"),
    route: "/",
    title: "You’re set",
    content: "Replay anytime from Settings → Replay dashboard tour, or Help → Tutorial.",
    placement: "center",
    scrollOffset: 72,
    skipScroll: true,
  });

  return core;
}

export function getTutorialSteps(track: TutorialTrackId, tier: HelpTier, ctx?: TutorialStepContext): TutorialStep[] {
  if (track !== "user") return [];
  return getUserTutorialSteps(tier, ctx);
}

function sectionLabel(id: string): string {
  return SECTION_LABELS[id] ?? id;
}

export function getTutorialSections(track: TutorialTrackId, tier: HelpTier, ctx?: TutorialStepContext): TutorialSection[] {
  if (track !== "user") return [];
  const steps = getUserTutorialSteps(tier, ctx);
  const seen = new Set<string>();
  const out: TutorialSection[] = [];
  for (const s of steps) {
    if (seen.has(s.section)) continue;
    seen.add(s.section);
    out.push({ id: s.section, label: sectionLabel(s.section) });
  }
  return out;
}

export function availableTutorialTracks(_tier: HelpTier): TutorialTrackId[] {
  return ["user"];
}
