/** Shared Outside Calls product copy (coming soon, Pro gate, live tape). */

export const OUTSIDE_CALLS_EYEBROW = "Pro · Off-desk lane";

export type OutsideCallsFeatureCopy = {
  step: string;
  title: string;
  subtitle: string;
  body: string;
  bullet: string;
  accent: string;
};

export const OUTSIDE_CALLS_FEATURES: readonly OutsideCallsFeatureCopy[] = [
  {
    step: "01",
    title: "Signal",
    subtitle: "Live off-desk tape",
    accent: "border-cyan-500/35 bg-cyan-950/20 text-cyan-100",
    body: "A dedicated feed of Solana CAs from approved X monitors — not the main desk. One row per call, newest first, with the source and trust score on every line.",
    bullet:
      "Dedicated feed from approved X monitors — one row per CA, newest first, with source and trust on every line.",
  },
  {
    step: "02",
    title: "Track",
    subtitle: "Multiples & charts",
    accent: "border-zinc-700/80 bg-zinc-950/50 text-zinc-100",
    body: "Live and ATH multiples on each mint, quick Dex/chart links, and echo markers when a second monitor posts the same contract.",
    bullet: "Live and ATH multiples, chart links, and echo rows when two monitors post the same mint.",
  },
  {
    step: "03",
    title: "Proof",
    subtitle: "Monitors & trust",
    accent: "border-emerald-500/30 bg-emerald-950/15 text-emerald-100",
    body: "Suggest new handles for staff to review. After two moderators approve, ingestion runs on the server — and trust scores update from how those calls actually perform.",
    bullet:
      "Propose handles for staff review; after dual approval, calls ingest automatically and trust scores learn from outcomes.",
  },
] as const;

export const OUTSIDE_CALLS_WORKFLOW = "signal → track → proof";

export const OUTSIDE_CALLS_PRO_UPGRADE = {
  title: "Outside Calls — Pro off-desk lane",
  description:
    "A second signal stream from curated X accounts — separate from McGBot desk calls. Pro unlocks the live tape, monitor submissions, and trust scores. Basic still includes desk, leaderboard, and limited inbox alerts.",
  ctaHref: "/membership?line=pro",
  ctaLabel: "View Pro plans",
} as const;

export const OUTSIDE_CALLS_COMING_SOON = {
  headline: "Outside Calls",
  introLead:
    "A second signal stream from curated X accounts — separate from McGBot desk calls. The workflow is",
  introTrail:
    "catch the CA, follow performance, and vet who gets on the monitor list. You're on Pro, so you're in when this lane goes live.",
  badge: "Opening soon",
  footerTitle: "In the meantime",
  footerBody:
    "Desk calls, leaderboard, inbox alerts, and Trusted Pro are all still on your plan — nothing extra to buy while we bring this lane online.",
} as const;

export const OUTSIDE_CALLS_LIVE_HEADER = {
  lead: "A second stream from curated X monitors — separate from desk calls.",
  body: "One row per CA on the live tape. Echo rows appear when a second source posts the same contract; only the primary row ties into milestone tracking. Propose a monitor below — staff reviews, then ingestion runs on the server.",
} as const;

export const OUTSIDE_CALLS_PRO_GATE_INLINE = {
  title: "Pro membership required",
  description:
    "The off-desk tape, monitor submissions, and trust scores are part of Pro. Upgrade to unlock the full lane.",
} as const;

export const OUTSIDE_CALLS_EMPTY_TAPE = {
  title: "No outside calls yet",
  description:
    "When a CA is recorded from an active monitor, it appears here automatically — newest first.",
  actionLabel: "Submit monitor",
} as const;
