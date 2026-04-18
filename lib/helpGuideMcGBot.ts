import type { McGBotReply } from "@/lib/helpMcGBotTypes";
import type { HelpDocSlug } from "@/lib/helpRole";

function docTitle(slug: HelpDocSlug): string {
  if (slug === "caller") return "Caller handbook";
  if (slug === "moderator") return "Moderator playbook";
  return "Admin runbook";
}

/** Placeholder answers scoped to guide + section (swap for RAG / LLM later). */
export function replyGuideQuestion(
  question: string,
  slug: HelpDocSlug,
  sectionLabel: string
): McGBotReply {
  const q = question.toLowerCase();
  const sec = sectionLabel.toLowerCase();
  const base = docTitle(slug);

  if (slug === "caller") {
    if (sec.includes("dashboard") || q.includes("widget") || q.includes("dashboard")) {
      return {
        body: "That section is about the home hub: widgets like activity, trending, Submit Call, and Your Rank. Rearrange or hide widgets from Settings when that preference UI lands.",
        source: `From: ${base} → Dashboard`,
      };
    }
    if (sec.includes("referral") || q.includes("referral")) {
      return {
        body: "Referrals: use the account menu → Referrals for your link and tabs. Live stats will replace placeholders once the referrals API is wired.",
        source: `From: ${base} → Referrals`,
      };
    }
    if (sec.includes("reputation") || q.includes("leaderboard") || q.includes("rank")) {
      return {
        body: "Reputation ties to leaderboard windows — quality and consistency beat spam volume. Profiles and visibility are under Settings / Profile.",
        source: `From: ${base} → Reputation`,
      };
    }
  }

  if (slug === "moderator") {
    if (sec.includes("overview") || q.includes("who")) {
      return {
        body: "Moderators enforce McGBot standards in public: clear violations first, document actions, escalate ambiguous cases to admins.",
        source: `From: ${base} → Overview`,
      };
    }
    if (sec.includes("moderation") || q.includes("spam") || q.includes("ban")) {
      return {
        body: "Moderation: prioritize harassment, scams, and malicious links. Use neutral, specific language; avoid public pile-ons when a DM warning works.",
        source: `From: ${base} → Moderation`,
      };
    }
    if (sec.includes("tone") || q.includes("tone")) {
      return {
        body: "Tone: fast, fair, and boring-in-a-good-way. One warning with expectations; firmer boundaries if the pattern repeats.",
        source: `From: ${base} → Community tone`,
      };
    }
  }

  if (slug === "admin") {
    if (sec.includes("overview")) {
      return {
        body: "Admins own infra and policy: env secrets, OAuth URLs, DNS, and who holds mod/admin access until roles live in the database.",
        source: `From: ${base} → Overview`,
      };
    }
    if (sec.includes("operations") || q.includes("vercel") || q.includes("oauth") || q.includes("dns")) {
      return {
        body: "Operations: keep NEXTAUTH_URL and Discord callback URLs aligned with the canonical domain; DNS changes need TTL-aware verification (A + AAAA).",
        source: `From: ${base} → Operations`,
      };
    }
    if (sec.includes("roles") || q.includes("role") || q.includes("supabase")) {
      return {
        body: "Roles today: DISCORD_ADMIN_IDS / DISCORD_MOD_IDS. Next step: a `role` (or permissions JSON) column on `users` in Supabase, read in /api/me/help-role.",
        source: `From: ${base} → Roles`,
      };
    }
  }

  const secPart =
    sectionLabel && sectionLabel !== "Whole guide" ? ` → ${sectionLabel}` : "";
  return {
    body: `I’m McGBot (preview) for this doc${secPart}. Try naming a concept from the selected section, or ask about referrals, OAuth/DNS, moderation flow, or leaderboard rules.`,
    source: `From: ${base}${secPart || " · General"}`,
  };
}

export function guideSuggestedPrompts(
  sectionLabel: string
): { label: string; query: string }[] {
  return [
    {
      label: "Summarize",
      query: `Summarize the "${sectionLabel}" part of this guide in two sentences.`,
    },
    {
      label: "Mistakes to avoid",
      query: `What mistakes should I avoid that relate to "${sectionLabel}"?`,
    },
    {
      label: "Escalate when?",
      query: "When should I escalate instead of deciding alone?",
    },
  ];
}
