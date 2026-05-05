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
 * Page-first flow: each route shows real UI, then the matching sidebar link on that same URL.
 * Home widgets scroll into view; no redundant `/` hops between workspace pages.
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
      title: "Trending tokens",
      content: "Heat snapshot of what the terminal is watching right now.",
      placement: "top",
      scrollOffset: 148,
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
      placement: "top",
      scrollOffset: 120,
    },
    {
      section: "botCalls",
      target: sel("sidebar.nav.botCalls"),
      route: "/bot-calls",
      title: "Bot calls · sidebar",
      content: "Same route from the Markets group — one click when you’re elsewhere in the app.",
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
      section: "trustedPro",
      target: sel("sidebar.nav.trustedPro"),
      route: "/trusted-pro",
      title: "Trusted Pro · sidebar",
      content: "Markets group link — jumps back here from anywhere in the terminal.",
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
      placement: "top",
      scrollOffset: 130,
    },
    {
      section: "leaderboard",
      target: sel("sidebar.nav.leaderboard"),
      route: "/leaderboard",
      title: "Leaderboards · sidebar",
      content: "Markets group — community scoreboards and bot milestones live here.",
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
      section: "pnlShowcase",
      target: sel("sidebar.nav.pnlShowcase"),
      route: "/pnl-showcase",
      title: "PnL Showcase · sidebar",
      content: "Markets group — open the showcase whenever you want to post or browse.",
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
      placement: "top",
      scrollOffset: 120,
    },
    {
      section: "calls",
      target: sel("sidebar.nav.calls"),
      route: "/calls",
      title: "Call log · sidebar",
      content: "Workspace link — fastest return to this tape from other routes.",
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
      section: "performance",
      target: sel("sidebar.nav.performance"),
      route: "/performance",
      title: "Performance lab · sidebar",
      content: "Workspace link — reopen charts and distribution anytime.",
      placement: "right",
      scrollOffset: 72,
      skipScroll: true,
    },

    {
      section: "tradeJournal",
      target: sel("tradeJournal.mainGrid"),
      route: "/trade-journal",
      title: "Trade journal layout",
      content: "Journal on the left, linked-wallet touches on the right — private from public McGBot calls.",
      placement: "top",
      scrollOffset: 100,
    },
    {
      section: "tradeJournal",
      target: sel("tradeJournal.entries"),
      route: "/trade-journal",
      title: "Journal entries",
      content: "Saved plays with thesis and invalidation — New entry / Export Markdown sit in the header above.",
      placement: "top",
      scrollOffset: 120,
    },
    {
      section: "tradeJournal",
      target: sel("tradeJournal.walletActivity"),
      route: "/trade-journal",
      title: "Wallet activity",
      content: "Recent SPL touches from a linked wallet — tap a row to draft a journal line with that mint.",
      placement: "top",
      scrollOffset: 120,
    },
    {
      section: "tradeJournal",
      target: sel("sidebar.nav.tradeJournal"),
      route: "/trade-journal",
      title: "Trade journal · sidebar",
      content: "Workspace link — your private Solana ledger.",
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
      section: "watchlist",
      target: sel("sidebar.nav.watchlist"),
      route: "/watchlist",
      title: "Watchlist · sidebar",
      content: "Workspace link — same lists surface on your profile when public is on.",
      placement: "right",
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
      target: sel("referrals.flow"),
      route: "/referrals",
      title: "How it flows",
      content: "Drop link → friends sign up → their performance rolls up under your network.",
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
      target: sel("sidebar.nav.referrals"),
      route: "/referrals",
      title: "Referrals · sidebar",
      content: "Workspace link — share and track from one place.",
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
      placement: "top",
      scrollOffset: 100,
    },
    {
      section: "lounge",
      target: sel("sidebar.nav.loungeDiscordChats"),
      route: "/lounge/discord-chats",
      title: "Discord chats · sidebar",
      content: "Community group — jump here from any page.",
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
    {
      section: "lounge",
      target: sel("sidebar.nav.loungeVoiceChats"),
      route: "/lounge/voice-chats",
      title: "Voice chats · sidebar",
      content: "Community group — premium tables when the voice flag is on for this host.",
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
        scrollOffset: 130,
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
      title: "Settings",
      content: "Every account preference for the terminal — layout, alerts, and linked accounts.",
      placement: "center",
      scrollOffset: 120,
      skipScroll: true,
      closeAccountMenu: true,
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
        target: sel("moderation.header"),
        route: "/moderation",
        title: "Moderation desk",
        content: "Live queue plus Supabase-backed desks your team triages together.",
        placement: "bottom",
        scrollOffset: 120,
      },
      {
        section: "staffModeration",
        target: sel("sidebar.nav.moderation"),
        route: "/moderation",
        title: "Moderation · sidebar",
        content: "Staff group link — return here from anywhere when you’re triaging.",
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
        target: sel("admin.intro"),
        route: "/admin",
        title: "Admin overview",
        content: "Jump cards into each workspace; stats summarize live health.",
        placement: "bottom",
        scrollOffset: 120,
      },
      {
        section: "adminPanel",
        target: sel("sidebar.nav.admin"),
        route: "/admin",
        title: "Admin · sidebar",
        content: "Staff group link — subscriptions, bot, site flags, bugs, and requests.",
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
      },
      {
        section: "adminTreasury",
        target: sel("sidebar.nav.treasury"),
        route: "/admin/treasury",
        title: "Treasury · sidebar",
        content: "SOL treasuries, Stripe balance, tips, voucher pool — same entry from the staff rail.",
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
