import type { HelpDocSlug, HelpTier } from "@/lib/helpRole";

export type HelpDocCard = {
  slug: HelpDocSlug;
  title: string;
  description: string;
  visible: (tier: HelpTier) => boolean;
};

export const HELP_DOC_CARDS: HelpDocCard[] = [
  {
    slug: "caller",
    title: "Caller handbook",
    description:
      "Dashboard widgets, submitting calls, referrals basics, and how reputation shows up on the leaderboard.",
    visible: () => true,
  },
  {
    slug: "moderator",
    title: "Moderator playbook",
    description:
      "How we moderate, when to escalate, and keeping public tone consistent with McGBot standards.",
    visible: (tier) => tier === "mod" || tier === "admin",
  },
  {
    slug: "admin",
    title: "Admin runbook",
    description:
      "Hosting, auth URLs, DNS gotchas, and where roles will eventually live in the database.",
    visible: (tier) => tier === "admin",
  },
];
