import type { HelpDocSlug, HelpTier } from "@/lib/helpRole";

export type HelpDocCard = {
  slug: HelpDocSlug;
  title: string;
  description: string;
  /** Approximate reading time for the in-app guide. */
  readMinutes: number;
  /** Shown on the card; bump when you materially edit the doc. */
  updatedLabel: string;
  visible: (tier: HelpTier) => boolean;
};

export const HELP_DOC_CARDS: HelpDocCard[] = [
  {
    slug: "caller",
    title: "Caller handbook",
    description:
      "Dashboard widgets, submitting calls, referrals basics, and how reputation shows up on the leaderboard.",
    readMinutes: 4,
    updatedLabel: "Apr 17, 2026",
    visible: () => true,
  },
  {
    slug: "moderator",
    title: "Moderator playbook",
    description:
      "How we moderate, when to escalate, and keeping public tone consistent with McGBot standards.",
    readMinutes: 3,
    updatedLabel: "Apr 17, 2026",
    visible: (tier) => tier === "mod" || tier === "admin",
  },
  {
    slug: "admin",
    title: "Admin runbook",
    description:
      "Hosting, auth URLs, DNS gotchas, and where roles will eventually live in the database.",
    readMinutes: 3,
    updatedLabel: "Apr 17, 2026",
    visible: (tier) => tier === "admin",
  },
];
