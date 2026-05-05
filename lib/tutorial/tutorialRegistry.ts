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
 * One condensed spotlight tour for every dashboard role.
 * Order: home highlights → deep pages (2–3 targets) → home nav reinforcement → …
 */
export function getUserTutorialSteps(tier: HelpTier, ctx?: TutorialStepContext): TutorialStep[] {
  const own = ctx?.ownProfilePath?.trim();

  const core: TutorialStep[] = [
    {
      section: "dashboard",
      target: sel("dashboard.tutorialWelcome"),
      route: "/",
      title: "Welcome",
      content: "Short orientation: we spotlight real UI. Next / Skip anytime — replay later in Settings.",
      placement: "center",
      scrollOffset: 72,
      skipScroll: true,
    },
    {
      section: "dashboard",
      target: sel("sidebar.logo"),
      route: "/",
      title: "Terminal home",
      content: "Logo returns here. The left rail lists every main workspace route.",
      placement: "right",
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
      skipScroll: true,
    },
    {
      section: "topNav",
      target: sel("nav.notifications"),
      route: "/",
      title: "Notifications",
      content: "Bell inbox: staff decisions, bugs, features, and other alerts.",
      placement: "bottom",
      scrollOffset: 88,
      skipScroll: true,
    },
    {
      section: "topNav",
      target: sel("nav.userMenu"),
      route: "/",
      title: "Account menu",
      content: "Profile, Settings, Help, Referrals, sign out — always one click away.",
      placement: "bottom",
      scrollOffset: 88,
      skipScroll: true,
    },
    {
      section: "dashboard",
      target: sel("dashboard.performanceChart"),
      route: "/",
      title: "Performance chart",
      content: "Your verified-call performance over time. Performance Lab expands this next.",
      placement: "bottom",
      scrollOffset: 120,
      skipScroll: true,
    },
    {
      section: "dashboard",
      target: sel("dashboard.personalStats"),
      route: "/",
      title: "Personal stats",
      content: "Averages, streak, win rate, and headline totals from your calls.",
      placement: "top",
      scrollOffset: 130,
      skipScroll: true,
    },
    {
      section: "dashboard",
      target: sel("dashboard.activityFeed"),
      route: "/",
      title: "Activity pulse",
      content: "Live-style feed of notable moves (toggle the widget in Settings if you prefer a calmer home).",
      placement: "top",
      scrollOffset: 148,
      skipScroll: true,
    },
    {
      section: "dashboard",
      target: sel("dashboard.quickActions"),
      route: "/",
      title: "Quick actions",
      content: "Submit a call, jump to profile, watchlist modal, referral link — your fastest shortcuts.",
      placement: "top",
      scrollOffset: 148,
      skipScroll: true,
    },
    {
      section: "dashboard",
      target: sel("dashboard.homeWatchlist"),
      route: "/",
      title: "Watchlist preview",
      content: "Saved mints on the home board. Next: full editor on the Watchlist page.",
      placement: "top",
      scrollOffset: 148,
      skipScroll: true,
    },
    {
      section: "watchlist",
      target: sel("sidebar.nav.watchlist"),
      route: "/",
      title: "Watchlist · nav",
      content: "Always reachable from the rail — opens your private/public contract lists.",
      placement: "right",
      scrollOffset: 72,
      skipScroll: true,
    },
    {
      section: "watchlist",
      target: sel("watchlist.header"),
      route: "/watchlist",
      title: "Watchlist",
      content: "Full editor: scope, refresh, and how lists appear on your profile.",
      placement: "bottom",
      scrollOffset: 100,
      skipScroll: true,
    },
    {
      section: "watchlist",
      target: sel("watchlist.manage"),
      route: "/watchlist",
      title: "Lists & add row",
      content: "Toggle private/public, then paste a Solana mint below to track it.",
      placement: "top",
      scrollOffset: 120,
      skipScroll: true,
    },
    {
      section: "dashboard",
      target: sel("dashboard.homeRecentCalls"),
      route: "/",
      title: "Recent calls",
      content: "Latest verified rows with a shortcut into the full Call log — next step opens it.",
      placement: "top",
      scrollOffset: 148,
      skipScroll: true,
    },
    {
      section: "calls",
      target: sel("calls.header"),
      route: "/calls",
      title: "Call log",
      content: "Line-by-line history: only your credited calls, filterable by window.",
      placement: "bottom",
      scrollOffset: 100,
      skipScroll: true,
    },
    {
      section: "calls",
      target: sel("calls.table"),
      route: "/calls",
      title: "Call table",
      content: "Use the window chips above for 7d / 30d / all time. Each row links to Dex and charts.",
      placement: "top",
      scrollOffset: 120,
      skipScroll: true,
    },
    {
      section: "calls",
      target: sel("sidebar.nav.calls"),
      route: "/",
      title: "Call log · nav",
      content: "This rail link is the fastest way back when you’re deep in other pages.",
      placement: "right",
      scrollOffset: 72,
      skipScroll: true,
    },
    {
      section: "performance",
      target: sel("performance.header"),
      route: "/performance",
      title: "Performance lab",
      content: "Same calls as Call log — summarized: streak, distribution, and rank context.",
      placement: "bottom",
      scrollOffset: 100,
      skipScroll: true,
    },
    {
      section: "performance",
      target: sel("performance.summary"),
      route: "/performance",
      title: "Summary tiles",
      content: "Averages, medians, win rate, totals, and your rolling 7d rank among callers.",
      placement: "top",
      scrollOffset: 130,
      skipScroll: true,
    },
    {
      section: "performance",
      target: sel("sidebar.nav.performance"),
      route: "/",
      title: "Performance · nav",
      content: "Re-open the lab anytime from Workspace.",
      placement: "right",
      scrollOffset: 72,
      skipScroll: true,
    },
    {
      section: "tradeJournal",
      target: sel("sidebar.nav.tradeJournal"),
      route: "/",
      title: "Trade journal · nav",
      content: "Private Solana trade log (separate from milestones). Next: the journal workspace.",
      placement: "right",
      scrollOffset: 72,
      skipScroll: true,
    },
    {
      section: "tradeJournal",
      target: sel("tradeJournal.workspace"),
      route: "/trade-journal",
      title: "Trade journal",
      content: "Log thesis, MC levels, wallet touches — export Markdown when you want a offline review.",
      placement: "bottom",
      scrollOffset: 100,
      skipScroll: true,
    },
    {
      section: "dashboard",
      target: sel("sidebar.nav.dashboard"),
      route: "/",
      title: "Dashboard",
      content: "Back to your hub. Next: Markets — McGBot scanner feed.",
      placement: "right",
      scrollOffset: 72,
      skipScroll: true,
    },
    {
      section: "botCalls",
      target: sel("sidebar.nav.botCalls"),
      route: "/",
      title: "Bot calls · nav",
      content: "McGBot’s live scanner tape (Pro). Opens the full feed next.",
      placement: "right",
      scrollOffset: 72,
      skipScroll: true,
    },
    {
      section: "botCalls",
      target: sel("botCalls.header"),
      route: "/bot-calls",
      title: "Bot calls",
      content: "Automation feed: time windows, min multiple, excluded toggle, and the running tape.",
      placement: "bottom",
      scrollOffset: 100,
      skipScroll: true,
    },
    {
      section: "botCalls",
      target: sel("botCalls.table"),
      route: "/bot-calls",
      title: "Scanner tape",
      content: "Rows show live/ATH multiples, status, and outbound links — pair with filters above.",
      placement: "top",
      scrollOffset: 120,
      skipScroll: true,
    },
    {
      section: "dashboard",
      target: sel("sidebar.nav.dashboard"),
      route: "/",
      title: "Home",
      content: "Trusted Pro next — long-form thesis posts from approved members.",
      placement: "right",
      scrollOffset: 72,
      skipScroll: true,
    },
    {
      section: "trustedPro",
      target: sel("sidebar.nav.trustedPro"),
      route: "/",
      title: "Trusted Pro · nav",
      content: "Curated thesis feed; submission rules live on the page header when you’re eligible.",
      placement: "right",
      scrollOffset: 72,
      skipScroll: true,
    },
    {
      section: "trustedPro",
      target: sel("trustedPro.header"),
      route: "/trusted-pro",
      title: "Trusted Pro",
      content: "Read published calls; apply or submit from the header when your account qualifies.",
      placement: "bottom",
      scrollOffset: 100,
      skipScroll: true,
    },
    {
      section: "trustedPro",
      target: sel("trustedPro.feed"),
      route: "/trusted-pro",
      title: "Feed",
      content: "Thesis cards with engagement stats — your research layer above raw tape.",
      placement: "top",
      scrollOffset: 120,
      skipScroll: true,
    },
    {
      section: "dashboard",
      target: sel("sidebar.nav.dashboard"),
      route: "/",
      title: "Home",
      content: "Public arena next: Leaderboards.",
      placement: "right",
      scrollOffset: 72,
      skipScroll: true,
    },
    {
      section: "leaderboard",
      target: sel("sidebar.nav.leaderboard"),
      route: "/",
      title: "Leaderboards · nav",
      content: "Community scoreboards — separate from your private Call log / Performance lab.",
      placement: "right",
      scrollOffset: 72,
      skipScroll: true,
    },
    {
      section: "leaderboard",
      target: sel("leaderboard.header"),
      route: "/leaderboard",
      title: "Leaderboards",
      content: "Spotlights, records, caller boards, and McGBot-only sections — all public arena data.",
      placement: "bottom",
      scrollOffset: 100,
      skipScroll: true,
    },
    {
      section: "leaderboard",
      target: sel("leaderboard.spotlight"),
      route: "/leaderboard",
      title: "Spotlight boards",
      content: "Daily / weekly / monthly faces and best calls — drill tabs below for other boards.",
      placement: "top",
      scrollOffset: 130,
      skipScroll: true,
    },
    {
      section: "dashboard",
      target: sel("sidebar.nav.dashboard"),
      route: "/",
      title: "Home",
      content: "PnL Showcase next — verified wallet posts when you’re eligible.",
      placement: "right",
      scrollOffset: 72,
      skipScroll: true,
    },
    {
      section: "pnlShowcase",
      target: sel("sidebar.nav.pnlShowcase"),
      route: "/",
      title: "PnL Showcase · nav",
      content: "On-chain verified PnL cards — opens the public feed next.",
      placement: "right",
      scrollOffset: 72,
      skipScroll: true,
    },
    {
      section: "pnlShowcase",
      target: sel("pnlShowcase.header"),
      route: "/pnl-showcase",
      title: "PnL Showcase",
      content: "Post realized/unrealized wins when linked wallets qualify — social proof layer.",
      placement: "bottom",
      scrollOffset: 100,
      skipScroll: true,
    },
    {
      section: "pnlShowcase",
      target: sel("pnlShowcase.feed"),
      route: "/pnl-showcase",
      title: "Showcase feed",
      content: "Recent verified cards with % moves and token context.",
      placement: "top",
      scrollOffset: 130,
      skipScroll: true,
    },
    {
      section: "dashboard",
      target: sel("sidebar.nav.dashboard"),
      route: "/",
      title: "Home",
      content: "Referrals next — your link, signups, and downstream caller stats.",
      placement: "right",
      scrollOffset: 72,
      skipScroll: true,
    },
    {
      section: "referrals",
      target: sel("sidebar.nav.referrals"),
      route: "/",
      title: "Referrals · nav",
      content: "Share McGBot; performance rolls up for people who join on your link.",
      placement: "right",
      scrollOffset: 72,
      skipScroll: true,
    },
    {
      section: "referrals",
      target: sel("referrals.hero"),
      route: "/referrals",
      title: "Referrals",
      content: "Copy your URL, track signups, and see how referred callers perform.",
      placement: "center",
      scrollOffset: 120,
      skipScroll: true,
    },
    {
      section: "referrals",
      target: sel("referrals.linkHub"),
      route: "/referrals",
      title: "Link hub",
      content: "Vanity slug or Discord ID link — copy buttons and quick stats live here.",
      placement: "top",
      scrollOffset: 120,
      skipScroll: true,
    },
    {
      section: "dashboard",
      target: sel("sidebar.nav.dashboard"),
      route: "/",
      title: "Home",
      content: "Lounge next — Discord text mirrored in the dashboard.",
      placement: "right",
      scrollOffset: 72,
      skipScroll: true,
    },
    {
      section: "lounge",
      target: sel("sidebar.nav.loungeDiscordChats"),
      route: "/",
      title: "Discord chats · nav",
      content: "Read-only mirror of configured channels — opens the terminal view next.",
      placement: "right",
      scrollOffset: 72,
      skipScroll: true,
    },
    {
      section: "lounge",
      target: sel("lounge.discordChats"),
      route: "/lounge/discord-chats",
      title: "Discord chats",
      content: "General + staff tabs when available; click names to open dashboard profiles.",
      placement: "bottom",
      scrollOffset: 100,
      skipScroll: true,
    },
    {
      section: "dashboard",
      target: sel("sidebar.nav.dashboard"),
      route: "/",
      title: "Home",
      content: "Voice tables next — premium voice lounge.",
      placement: "right",
      scrollOffset: 72,
      skipScroll: true,
    },
    {
      section: "lounge",
      target: sel("sidebar.nav.loungeVoiceChats"),
      route: "/",
      title: "Voice chats · nav",
      content: "Join curated voice lobbies (feature-flagged). Opens the docked experience next.",
      placement: "right",
      scrollOffset: 72,
      skipScroll: true,
    },
    {
      section: "lounge",
      target: sel("lounge.voiceChats"),
      route: "/lounge/voice-chats",
      title: "Voice chats",
      content: "Lobby list, join flow, and moderation affordances when voice is enabled for your tier.",
      placement: "bottom",
      scrollOffset: 100,
      skipScroll: true,
    },
    {
      section: "dashboard",
      target: sel("sidebar.nav.dashboard"),
      route: "/",
      title: "Home",
      content: "Account destinations next: your public profile, Settings, and Help.",
      placement: "right",
      scrollOffset: 72,
      skipScroll: true,
    },
  ];

  if (own) {
    core.push(
      {
        section: "profile",
        target: sel("nav.menu.profile"),
        route: "/",
        title: "Profile · menu",
        content: "Opening your menu — Profile is your public card.",
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
        skipScroll: true,
        closeAccountMenu: true,
      },
      {
        section: "profile",
        target: sel("profile.header"),
        route: own,
        title: "Header & actions",
        content: "Edit card, follow state for visitors, and pinned call when you set one.",
        placement: "bottom",
        scrollOffset: 120,
        skipScroll: true,
      },
      {
        section: "dashboard",
        target: sel("sidebar.nav.dashboard"),
        route: "/",
        title: "Home",
        content: "Settings next — notifications, widgets, and profile visibility.",
        placement: "right",
        scrollOffset: 72,
        skipScroll: true,
      }
    );
  } else {
    core.push({
      section: "settings",
      target: sel("sidebar.nav.dashboard"),
      route: "/",
      title: "Home",
      content: "Settings next — open the account menu → Settings anytime.",
      placement: "right",
      scrollOffset: 72,
      skipScroll: true,
    });
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
      skipScroll: true,
    },
    {
      section: "help",
      target: sel("help.header"),
      route: "/help",
      title: "Help",
      content: "Docs sized to your role, bug + feature forms, and tutorial replay controls.",
      placement: "center",
      scrollOffset: 120,
      skipScroll: true,
    },
    {
      section: "help",
      target: sel("help.tutorialPanel"),
      route: "/help",
      title: "Replay tour",
      content: "Restart this walkthrough or jump to a section — same tour for every role.",
      placement: "top",
      scrollOffset: 120,
      skipScroll: true,
    }
  );

  if (tier === "mod" || tier === "admin") {
    core.push(
      {
        section: "staffModeration",
        target: sel("sidebar.nav.moderation"),
        route: "/",
        title: "Moderation · nav",
        content: "Staff approvals: calls, Trusted Pro, and mirrored Discord queues — details onboard separately.",
        placement: "right",
        scrollOffset: 72,
        skipScroll: true,
      },
      {
        section: "staffModeration",
        target: sel("moderation.header"),
        route: "/moderation",
        title: "Moderation desk",
        content: "Live queue + Supabase-backed desks for intake you triage with the team.",
        placement: "bottom",
        scrollOffset: 120,
        skipScroll: true,
      },
      {
        section: "dashboard",
        target: sel("sidebar.nav.dashboard"),
        route: "/",
        title: "Home",
        content: "Back to the hub.",
        placement: "right",
        scrollOffset: 72,
        skipScroll: true,
      }
    );
  }

  if (tier === "admin") {
    core.push(
      {
        section: "adminPanel",
        target: sel("sidebar.nav.admin"),
        route: "/",
        title: "Admin · nav",
        content: "Subscription tools, bot controls, site flags, bugs, and feature requests — deep dives onboard separately.",
        placement: "right",
        scrollOffset: 72,
        skipScroll: true,
      },
      {
        section: "adminPanel",
        target: sel("admin.intro"),
        route: "/admin",
        title: "Admin overview",
        content: "Jump cards into each workspace; stats above summarize live health.",
        placement: "bottom",
        scrollOffset: 120,
        skipScroll: true,
      },
      {
        section: "dashboard",
        target: sel("sidebar.nav.dashboard"),
        route: "/",
        title: "Home",
        content: "Treasury hub next — on-chain SOL, Stripe, and membership flows.",
        placement: "right",
        scrollOffset: 72,
        skipScroll: true,
      },
      {
        section: "adminTreasury",
        target: sel("sidebar.nav.treasury"),
        route: "/",
        title: "Treasury · nav",
        content: "SOL treasuries, Stripe balance, tips, and voucher pool — opens the hub next.",
        placement: "right",
        scrollOffset: 72,
        skipScroll: true,
      },
      {
        section: "adminTreasury",
        target: sel("admin.treasury"),
        route: "/admin/treasury",
        title: "Treasury hub",
        content: "Live balances and payment rails; details covered in staff onboarding.",
        placement: "bottom",
        scrollOffset: 120,
        skipScroll: true,
      },
      {
        section: "dashboard",
        target: sel("sidebar.nav.dashboard"),
        route: "/",
        title: "Home",
        content: "Return here after admin work.",
        placement: "right",
        scrollOffset: 72,
        skipScroll: true,
      }
    );
  }

  core.push({
    section: "dashboard",
    target: sel("dashboard.tutorialWelcome"),
    route: "/",
    title: "You’re set",
    content: "Explore at your own pace. Replay anytime from Settings → Replay dashboard tour, or Help → Tutorial.",
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
