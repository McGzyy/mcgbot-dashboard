import type { HelpDocSlug } from "@/lib/helpRole";

/** Placeholder answers scoped to guide + section (swap for RAG / LLM later). */
export function replyGuideQuestion(
  question: string,
  slug: HelpDocSlug,
  sectionLabel: string
): string {
  const q = question.toLowerCase();
  const sec = sectionLabel.toLowerCase();

  if (slug === "caller") {
    if (sec.includes("dashboard") || q.includes("widget") || q.includes("dashboard")) {
      return "That section is about the home hub: widgets like activity, trending, Submit Call, and Your Rank. Rearrange or hide widgets from Settings when that preference UI lands.";
    }
    if (sec.includes("referral") || q.includes("referral")) {
      return "Referrals: use the account menu → Referrals for your link and tabs. Live stats will replace placeholders once the referrals API is wired.";
    }
    if (sec.includes("reputation") || q.includes("leaderboard") || q.includes("rank")) {
      return "Reputation ties to leaderboard windows — quality and consistency beat spam volume. Profiles and visibility are under Settings / Profile.";
    }
  }

  if (slug === "moderator") {
    if (sec.includes("overview") || q.includes("who")) {
      return "Moderators enforce McGBot standards in public: clear violations first, document actions, escalate ambiguous cases to admins.";
    }
    if (sec.includes("moderation") || q.includes("spam") || q.includes("ban")) {
      return "Moderation: prioritize harassment, scams, and malicious links. Use neutral, specific language; avoid public pile-ons when a DM warning works.";
    }
    if (sec.includes("tone") || q.includes("tone")) {
      return "Tone: fast, fair, and boring-in-a-good-way. One warning with expectations; firmer boundaries if the pattern repeats.";
    }
  }

  if (slug === "admin") {
    if (sec.includes("overview")) {
      return "Admins own infra and policy: env secrets, OAuth URLs, DNS, and who holds mod/admin access until roles live in the database.";
    }
    if (sec.includes("operations") || q.includes("vercel") || q.includes("oauth") || q.includes("dns")) {
      return "Operations: keep NEXTAUTH_URL and Discord callback URLs aligned with the canonical domain; DNS changes need TTL-aware verification (A + AAAA).";
    }
    if (sec.includes("roles") || q.includes("role") || q.includes("supabase")) {
      return "Roles today: DISCORD_ADMIN_IDS / DISCORD_MOD_IDS. Next step: a `role` (or permissions JSON) column on `users` in Supabase, read in /api/me/help-role.";
    }
  }

  const tail =
    sectionLabel && sectionLabel !== "Whole guide"
      ? ` (you referenced: ${sectionLabel})`
      : "";
  return `I’m McGBot (preview) for the ${slug} doc${tail}. Try naming a concept from that section, or ask about referrals, OAuth/DNS, moderation flow, or leaderboard rules.`;
}
