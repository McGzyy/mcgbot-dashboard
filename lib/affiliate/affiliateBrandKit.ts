import { TIER_COMPARE_HIGHLIGHTS, TIER_MARKETING } from "@/lib/subscription/planTiers";

export type AffiliateCopyTemplate = {
  id: string;
  title: string;
  description: string;
  body: string;
};

export type AffiliateBrandAsset = {
  id: string;
  name: string;
  href: string;
  format: string;
  usage: string;
};

export const AFFILIATE_BRAND_COLORS = [
  { name: "Primary violet", hex: "#6D28D9", usage: "Buttons, accents, affiliate hub" },
  { name: "Deep violet", hex: "#4C1D95", usage: "Headlines on light backgrounds" },
  { name: "Ink", hex: "#18181B", usage: "Body text" },
  { name: "Muted", hex: "#71717A", usage: "Secondary text" },
] as const;

export const AFFILIATE_BRAND_ASSETS: AffiliateBrandAsset[] = [
  {
    id: "logo-png",
    name: "McGBot logo",
    href: "/brand/mcgbot-logo.png",
    format: "PNG",
    usage: "Light backgrounds only. Do not stretch, recolor, or add effects.",
  },
  {
    id: "guidelines-md",
    name: "Brand & promotion guidelines",
    href: "/affiliate/mcgbot-affiliate-brand-guidelines.md",
    format: "Markdown",
    usage: "Share with your editor or VA. Includes rules and disclosure language.",
  },
];

export const AFFILIATE_PROMOTION_RULES = [
  "Disclose your affiliate relationship wherever required (FTC, platform policies, local law).",
  "No guaranteed-profit claims, fake PnL screenshots, or impersonation of McGBot staff.",
  "Do not bid on McGBot brand keywords in paid search without written approval.",
  "Use only approved assets from this page — do not alter logo colors or proportions.",
  "Direct signups through your tracking link or campaign link so attribution stays accurate.",
  "No spam, unsolicited DMs, or misleading “official partnership” claims unless approved in writing.",
] as const;

export function affiliateCopyTemplates(trackingLink: string): AffiliateCopyTemplate[] {
  const link = trackingLink.trim() || "https://mcgbot.xyz/r/YOUR_CODE";

  return [
    {
      id: "disclosure-short",
      title: "Short disclosure",
      description: "Inline — social posts, video descriptions, pinned comments.",
      body: `Some links in this content are affiliate links. If you subscribe through them, I may earn a commission at no extra cost to you.`,
    },
    {
      id: "disclosure-long",
      title: "Long disclosure",
      description: "Blog posts, newsletters, or dedicated disclaimer blocks.",
      body: `Disclosure: I participate in the McGBot affiliate program. If you sign up for McGBot Terminal through my link (${link}), I may receive a commission. This does not change the price you pay. I only promote tools I use or genuinely believe add value for traders doing their own research.`,
    },
    {
      id: "x-short",
      title: "X / Twitter — short post",
      description: "Single post with CTA.",
      body: `I've been using McGBot Terminal for verified desk calls, live tape, and performance tracking — solid workflow if you're serious about journaling your edge.\n\nTry it here: ${link}\n\n(Affiliate link — I may earn a commission if you subscribe.)`,
    },
    {
      id: "discord",
      title: "Discord announcement",
      description: "Server post or DM-friendly blurb.",
      body: `**McGBot Terminal** — trading dashboard for verified calls, leaderboard, watchlist, and Performance Lab.\n\n• Basic & Pro plans\n• Track your own referrals with a real affiliate program if you create content\n\nMy link: ${link}\n_(Affiliate link — supports the channel at no extra cost to you.)_`,
    },
    {
      id: "youtube-desc",
      title: "YouTube description block",
      description: "Paste at the top or bottom of video descriptions.",
      body: `─── McGBot Terminal ───\nSign up: ${link}\n\nMcGBot is a member trading dashboard — verified call tape, desk intel, leaderboard, and performance analytics.\n\nDisclosure: This is an affiliate link. I may earn a commission if you subscribe through it. Not financial advice.\n──────────────────────`,
    },
  ];
}

export const AFFILIATE_PRODUCT_PITCHES = [
  {
    tier: "basic" as const,
    title: TIER_MARKETING.basic.title,
    tagline: TIER_MARKETING.basic.tagline,
    bullets: TIER_COMPARE_HIGHLIGHTS.basic,
  },
  {
    tier: "pro" as const,
    title: TIER_MARKETING.pro.title,
    tagline: TIER_MARKETING.pro.tagline,
    bullets: TIER_COMPARE_HIGHLIGHTS.pro,
  },
];
