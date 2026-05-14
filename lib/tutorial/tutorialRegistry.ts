import type { HelpTier } from "@/lib/helpRole";
import type { TutorialTrackId } from "@/lib/tutorial/tutorialVersions";

export type TutorialSection = { id: string; label: string };

export type TutorialStep = {
  section: string;
  target: string;
  title: string;
  content: string;
  /** When set, `TutorialProvider` navigates here before showing the step. Omit to stay on the current URL. */
  route?: string;
  placement?: "auto" | "top" | "bottom" | "left" | "right" | "center";
  scrollOffset?: number;
  openAccountMenu?: boolean;
  closeAccountMenu?: boolean;
  /** When true, skip window scroll-to-target (modals, centered welcome, fixed chrome). */
  skipScroll?: boolean;
  /**
   * When true, react-joyride keeps `placement` fixed (no flip to the opposite edge when the viewport is tight).
   * Use with `placement: "top"` when the tooltip must stay above the target (e.g. panels at the bottom of the page).
   */
  disablePlacementFlip?: boolean;
  /** Per-step: no dimmed SVG overlay (avoids full-document height / layout issues on dense pages). */
  hideOverlay?: boolean;
  /** Spacing between tooltip and target (react-joyride `offset`); default from Joyride. */
  joyrideOffset?: number;
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
 * Sidebar-first per section: spotlight the left-rail link (no `route` → no navigation), then open the page.
 * Home widgets still use explicit `route: "/"` where needed.
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
      title: "CA Analyzer",
      content:
        "Inspect a Solana mint: FaSol-style snapshot plus full dashboard call history. Press / when focus isn’t in a field to open it.",
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
      target: sel("dashboard.topPerformers"),
      route: "/",
      title: "Top performers today",
      content: "Who’s moving in the window you picked — quick scan without leaving home.",
      placement: "top",
      scrollOffset: 148,
    },
    {
      section: "dashboard",
      target: sel("dashboard.socialFeed"),
      route: "/",
      title: "Social feed",
      content: "Curated X and community signal — same card can be hidden from Dashboard layout.",
      placement: "top",
      scrollOffset: 148,
    },
    {
      section: "dashboard",
      target: sel("dashboard.trending"),
      route: "/",
      title: "Trending coins",
      content: "Heat snapshot of what the terminal is watching right now.",
      /**
       * No custom window scroll: scrolling this step was stretching/breaking the shell. No overlay: full-page SVG
       * overlay used document height and fought the layout. Flip off + small offset keeps the bubble on the card.
       */
      placement: "top",
      skipScroll: true,
      hideOverlay: true,
      joyrideOffset: 6,
      disablePlacementFlip: true,
    },
    {
      section: "dashboard",
      target: sel("dashboard.quickActions"),
      route: "/",
      title: "Quick actions",
      content: "Submit a call, profile, watchlist modal, referral link.",
      placement: "bottom",
      scrollOffset: 200,
    },
    {
      section: "dashboard",
      target: sel("dashboard.homeWatchlist"),
      route: "/",
      title: "Watchlist preview",
      content: "Saved mints on the home board — the Watchlist page is the full editor (covered later in Workspace).",
      placement: "top",
      scrollOffset: 148,
    },
    {
      section: "dashboard",
      target: sel("dashboard.homeRecentCalls"),
      route: "/",
      title: "Recent calls",
      content: "Latest credited rows from your account — Call log has the full filterable table.",
      placement: "top",
      scrollOffset: 138,
    },

    {
      section: "botCalls",
      target: sel("sidebar.nav.botCalls"),
      title: "Bot calls",
      content: "Markets group — McGBot’s live scanner tape opens here.",
      placement: "right",
      scrollOffset: 72,
      skipScroll: true,
    },
    {
      section: "botCalls",
      target: sel("botCalls.filters"),
      route: "/bot-calls",
      title: "Scanner filters",
      content: "Time window, minimum multiple, and whether excluded calls show in the tape.",
      placement: "bottom",
      scrollOffset: 100,
    },
    {
      section: "botCalls",
      target: sel("botCalls.table"),
      route: "/bot-calls",
      title: "Scanner tape",
      content: "Live and ATH multiples, status, Dex/chart links — the running feed from McGBot.",
      placement: "bottom",
      scrollOffset: 128,
    },

    {
      section: "trustedPro",
      target: sel("sidebar.nav.trustedPro"),
      title: "Trusted Pro",
      content: "Markets group — thesis-style calls from approved members.",
      placement: "right",
      scrollOffset: 72,
      skipScroll: true,
    },
    {
      section: "trustedPro",
      target: sel("trustedPro.feed"),
      route: "/trusted-pro",
      title: "Trusted Pro feed",
      content: "Longform thesis posts — read everyone’s published work; submit when your account qualifies.",
      placement: "top",
      scrollOffset: 120,
    },

    {
      section: "leaderboard",
      target: sel("sidebar.nav.leaderboard"),
      title: "Leaderboards",
      content: "Markets group — public scoreboards, spotlights, and bot milestones.",
      placement: "right",
      scrollOffset: 72,
      skipScroll: true,
    },
    {
      section: "leaderboard",
      target: sel("leaderboard.spotlight"),
      route: "/leaderboard",
      title: "Spotlight boards",
      content: "Daily / weekly / monthly faces and best calls — public arena, separate from your private stats.",
      placement: "top",
      scrollOffset: 130,
    },
    {
      section: "leaderboard",
      target: sel("leaderboard.userBoard"),
      route: "/leaderboard",
      title: "Caller boards",
      content: "Ranked callers for the timeframe you pick — drill with the tabs above.",
      /** Same as `leaderboard.botSection`: anchor is header strip only, tooltip below with arrow up. */
      placement: "bottom",
      scrollOffset: 128,
      disablePlacementFlip: true,
    },
    {
      section: "leaderboard",
      target: sel("leaderboard.botSection"),
      route: "/leaderboard",
      title: "Bot calls (leaderboards)",
      content:
        "McGBot’s public bot ladder on this page — KPI cards, milestones, and live bot rows. The full scanner tape lives under Bot Calls in the sidebar.",
      placement: "bottom",
      scrollOffset: 128,
    },

    {
      section: "pnlShowcase",
      target: sel("sidebar.nav.pnlShowcase"),
      title: "PnL Showcase",
      content: "Markets group — verified wallet PnL cards for called tokens.",
      placement: "right",
      scrollOffset: 72,
      skipScroll: true,
    },
    {
      section: "pnlShowcase",
      target: sel("pnlShowcase.feed"),
      route: "/pnl-showcase",
      title: "PnL feed",
      content: "Verified wallet posts for called tokens — headline % moves and token context.",
      placement: "top",
      scrollOffset: 130,
    },

    {
      section: "calls",
      target: sel("sidebar.nav.calls"),
      title: "Call log",
      content: "Workspace — your credited calls only, line by line.",
      placement: "right",
      scrollOffset: 72,
      skipScroll: true,
    },
    {
      section: "calls",
      target: sel("calls.filters"),
      route: "/calls",
      title: "Call log filters",
      content: "7d, 30d, or all time — totals in the corner follow the active window.",
      placement: "bottom",
      scrollOffset: 100,
    },
    {
      section: "calls",
      target: sel("calls.table"),
      route: "/calls",
      title: "Call log table",
      content: "Each row: when, token snapshot, multiples, source, Dex/chart links — your credited calls only.",
      placement: "bottom",
      scrollOffset: 128,
    },

    {
      section: "performance",
      target: sel("sidebar.nav.performance"),
      title: "Performance lab",
      content: "Workspace — charts and distribution from the same calls as Call log.",
      placement: "right",
      scrollOffset: 72,
      skipScroll: true,
    },
    {
      section: "performance",
      target: sel("performance.summary"),
      route: "/performance",
      title: "Performance tiles",
      content: "Averages, median, win rate, totals, and rolling 7d rank — same underlying calls as Call log.",
      placement: "top",
      scrollOffset: 130,
    },
    {
      section: "performance",
      target: sel("performance.activity"),
      route: "/performance",
      title: "14-day activity",
      content: "Bars are call count per UTC day; line is average ATH multiple that day.",
      placement: "top",
      scrollOffset: 130,
    },
    {
      section: "performance",
      target: sel("performance.distribution"),
      route: "/performance",
      title: "Multiple mix",
      content: "How your calls stack into ATH buckets — peak ÷ entry MC per call.",
      placement: "top",
      scrollOffset: 130,
    },

    {
      section: "tradeJournal",
      target: sel("sidebar.nav.tradeJournal"),
      title: "Trade journal",
      content: "Workspace — Solana-only notes for how you traded, not McGBot call credit or public rankings.",
      placement: "right",
      scrollOffset: 72,
      skipScroll: true,
    },
    {
      section: "tradeJournal",
      target: sel("tradeJournal.entries"),
      route: "/trade-journal",
      title: "Journal entries",
      content: "Saved plays with setups, thesis, and invalidation. Use New entry or Export Markdown in the header when you are ready.",
      placement: "top",
      scrollOffset: 200,
      disablePlacementFlip: true,
    },
    {
      section: "tradeJournal",
      target: sel("tradeJournal.walletActivity"),
      route: "/trade-journal",
      title: "Wallet activity",
      content: "Pulls recent SPL touches from your linked wallet so you can anchor a note to a real mint—open a row to start a draft without hunting explorers.",
      placement: "top",
      scrollOffset: 200,
      disablePlacementFlip: true,
    },

    {
      section: "watchlist",
      target: sel("sidebar.nav.watchlist"),
      title: "Watchlist",
      content: "Workspace — private and public contract lists.",
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
      placement: "bottom",
      scrollOffset: 128,
      skipScroll: true,
    },

    {
      section: "referrals",
      target: sel("nav.menu.referralsOverview"),
      title: "Referrals",
      content:
        "Open your profile menu (top right) → Referrals — overview, performance, and rewards. Your link and signups live here.",
      placement: "left",
      scrollOffset: 72,
      skipScroll: true,
    },
    {
      section: "referrals",
      target: sel("referrals.linkHub"),
      route: "/referrals",
      title: "Your referral link",
      content: "Vanity slug or Discord ID link — copy buttons and live status.",
      placement: "top",
      scrollOffset: 110,
    },
    {
      section: "referrals",
      target: sel("referrals.stats"),
      route: "/referrals",
      title: "Network snapshot",
      content: "Totals, today, and week signups — who joined on your link at a glance.",
      placement: "top",
      scrollOffset: 120,
    },
    {
      section: "referrals",
      target: sel("referrals.lists"),
      route: "/referrals",
      title: "Referral lists",
      content: "Per-referral cards and performance — dig in when you want detail beyond the snapshot strip.",
      placement: "top",
      scrollOffset: 120,
    },
    {
      section: "referrals",
      target: sel("referrals.rewards"),
      route: "/referrals",
      title: "Rewards & attribution",
      content:
        "Qualifying subscription payments from your network show up here as a ledger preview—nothing auto-credits until a reward policy is published, but the counts stay visible.",
      placement: "top",
      scrollOffset: 140,
    },

    {
      section: "lounge",
      target: sel("sidebar.nav.loungeDiscordChats"),
      title: "Discord chats",
      content: "Community — read-only mirror of configured Discord channels.",
      placement: "right",
      scrollOffset: 72,
      skipScroll: true,
    },
    {
      section: "lounge",
      target: sel("lounge.discordChats.panel"),
      route: "/lounge/discord-chats",
      title: "Discord mirror",
      content: "Read-only channel tabs and live messages — names open dashboard profiles.",
      /** Anchor is header strip only (not message list); tooltip below matches stable rect after tabs load. */
      placement: "bottom",
      scrollOffset: 108,
      disablePlacementFlip: true,
    },

    {
      section: "lounge",
      target: sel("sidebar.nav.loungeVoiceChats"),
      title: "Voice chats",
      content: "Community — premium voice tables when enabled on this host.",
      placement: "right",
      scrollOffset: 72,
      skipScroll: true,
    },
    {
      section: "lounge",
      target: sel("lounge.voiceChats.panel"),
      route: "/lounge/voice-chats",
      title: "Voice lobbies",
      content: "Pick a table, see who’s live, join with one tap — staff tools appear when your tier allows.",
      placement: "top",
      scrollOffset: 100,
    },
  ];

  if (own) {
    core.push(
      {
        section: "profile",
        target: sel("nav.menu.profile"),
        title: "Profile",
        content: "Your public card opens from here.",
        placement: "left",
        scrollOffset: 88,
        skipScroll: true,
        openAccountMenu: true,
      },
      {
        section: "profile",
        target: sel("profile.header"),
        route: own,
        title: "Profile header",
        content: "Banner, avatar, bio, edit card, follow state, and pinned call when you set one.",
        placement: "bottom",
        scrollOffset: 120,
        closeAccountMenu: true,
      },
      {
        section: "profile",
        target: sel("profile.performance"),
        route: own,
        title: "Profile performance",
        content: "Public stats tiles — same spirit as Performance lab, visitor-facing.",
        placement: "top",
        scrollOffset: 130,
      },
      {
        section: "profile",
        target: sel("profile.recentCalls"),
        route: own,
        title: "Recent calls on profile",
        content: "What visitors see from your last verified rows — pin one as your signature pick above.",
        placement: "top",
        skipScroll: true,
        hideOverlay: true,
        joyrideOffset: 6,
        disablePlacementFlip: true,
      }
    );
  }

  core.push(
    {
      section: "settings",
      target: sel("nav.menu.settings"),
      title: "Settings",
      content: "Notifications, widgets, wallets, and profile visibility — opens from the avatar menu.",
      placement: "left",
      scrollOffset: 88,
      skipScroll: true,
      openAccountMenu: true,
    },
    {
      section: "settings",
      target: sel("settings.header"),
      route: "/settings",
      title: "Settings overview",
      content: "Every account preference for the terminal — layout, alerts, linked X, and public visibility.",
      placement: "center",
      scrollOffset: 120,
      skipScroll: true,
      closeAccountMenu: true,
    },
    {
      section: "settings",
      target: sel("settings.connectedX"),
      route: "/settings",
      title: "Connect X",
      content:
        "Link X to verify your handle on your profile and unlock optional @mentions on approved high-multiple milestone posts.",
      placement: "bottom",
      scrollOffset: 120,
    },
    {
      section: "settings",
      target: sel("settings.xMilestones"),
      route: "/settings",
      title: "X milestone posts",
      content:
        "Allow @mentions on milestone posts and set the minimum multiple — so you are not pinged on every small move.",
      placement: "bottom",
      scrollOffset: 130,
    },
    {
      section: "settings",
      target: sel("settings.notifications"),
      route: "/settings",
      title: "Notifications",
      content:
        "My Calls Only, Following, Global, and in-dashboard sound — tune what alerts you without leaving the terminal.",
      placement: "bottom",
      scrollOffset: 130,
    },
    {
      section: "settings",
      target: sel("settings.publicProfile"),
      route: "/settings",
      title: "Public profile",
      content:
        "Toggle what visitors see on your McGBot profile: stats, trophy case, recent calls, and your pinned call.",
      placement: "bottom",
      scrollOffset: 140,
    },
    {
      section: "settings",
      target: sel("settings.dashboardLayout"),
      route: "/settings",
      title: "Dashboard layout",
      content: "Toggle home modules: pulse, feeds, quick actions, Discord chat, and more.",
      placement: "top",
      scrollOffset: 130,
    },
    {
      section: "help",
      target: sel("nav.menu.help"),
      title: "Help",
      content: "Support hub, role docs, FAQ, bug reports, and Ask McGBot — open from your avatar menu anytime.",
      placement: "left",
      scrollOffset: 88,
      skipScroll: true,
      openAccountMenu: true,
    },
    {
      section: "help",
      target: sel("help.header"),
      route: "/help",
      title: "Help hub",
      content: "Role docs, FAQ, quick answers, and forms — plus ? (Shift + /) when focus is not in a field.",
      placement: "center",
      scrollOffset: 120,
      skipScroll: true,
      closeAccountMenu: true,
    },
    {
      section: "help",
      target: sel("help.tutorialPanel"),
      route: "/help",
      title: "Tutorial",
      content: "Start this tour again, jump to a section, or reset progress.",
      placement: "top",
      scrollOffset: 120,
    },
    {
      section: "help",
      target: sel("help.reportBug"),
      route: "/help",
      title: "Report a bug",
      content: "Submit broken behavior with steps and screenshots — you get a bell when it is closed.",
      placement: "bottom",
      scrollOffset: 130,
    },
    {
      section: "help",
      target: sel("help.featureRequest"),
      route: "/help",
      title: "Feature request",
      content: "Share product ideas and why they matter — separate from bugs so triage stays clean.",
      placement: "bottom",
      scrollOffset: 130,
    },
    {
      section: "help",
      target: sel("help.docs"),
      route: "/help",
      title: "User docs",
      content: "Role-matched guides open as modals — deeper runbooks unlock for staff accounts.",
      placement: "bottom",
      scrollOffset: 140,
    },
    {
      section: "help",
      target: sel("help.faq"),
      route: "/help",
      title: "FAQ",
      content: "Filter by topic and expand answers for common flows — ranks, referrals, login, and Help itself.",
      placement: "bottom",
      scrollOffset: 140,
    },
    {
      section: "help",
      target: sel("help.askMcGBot"),
      route: "/help",
      title: "Ask McGBot",
      content: "Try suggested prompts or type a short question — keyword hints today, doc-backed answers later.",
      placement: "bottom",
      scrollOffset: 140,
    }
  );

  if (tier === "mod" || tier === "admin") {
    core.push(
      {
        section: "staffModeration",
        target: sel("sidebar.nav.moderation"),
        title: "Moderation",
        content: "Staff group — approvals, Trusted Pro queues, mirrored Discord intake.",
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
        title: "Admin",
        content: "Staff group — subscriptions, bot, site flags, bugs, feature requests.",
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
        title: "Treasury",
        content: "Staff group — SOL treasuries, Stripe balance, tips, voucher pool.",
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
        skipScroll: true,
        hideOverlay: true,
        joyrideOffset: 6,
        disablePlacementFlip: true,
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
