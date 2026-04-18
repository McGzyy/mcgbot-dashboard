import type { McGBotReply } from "@/lib/helpMcGBotTypes";

/** Keyword answers for the main Help page “Ask McGBot” (not tied to a doc modal). */
export function hubBotReply(question: string): McGBotReply {
  const q = question.toLowerCase();
  if (q.includes("rank") || q.includes("leaderboard")) {
    return {
      body: "Leaderboard ranks use rolling windows (daily board on the home hub and full page under Leaderboard). Your Rank D/W/M/A matches that page — keep calls high quality to climb.",
      source: "From: Help hub · Leaderboard",
    };
  }
  if (q.includes("referral") || q.includes("invite")) {
    return {
      body: "Referrals live under your account menu → Referrals. Start at Overview for your link; Performance and Rewards summarize downstream callers (live metrics wiring soon).",
      source: "From: Help hub · Referrals",
    };
  }
  if (q.includes("login") || q.includes("discord") || q.includes("oauth") || q.includes("sign in")) {
    return {
      body: "We use Discord for sign-in. If OAuth loops, confirm NEXTAUTH_URL matches the live site (www vs apex) and Discord redirect URLs include https://your-domain/api/auth/callback/discord.",
      source: "From: Help hub · Auth",
    };
  }
  if (q.includes("submit") || q.includes("call")) {
    return {
      body: "Submit Call is on the dashboard: open the modal, fill symbol / chain / thesis, then send. Bad or duplicate calls hurt leaderboard trust — double-check before posting.",
      source: "From: Help hub · Submit call",
    };
  }
  if (q.includes("setting") || q.includes("profile") || q.includes("bio")) {
    return {
      body: "Profile is under your avatar → Profile; account toggles live in Settings. Visibility and bio sync when the profile API is connected to your Supabase row.",
      source: "From: Help hub · Profile & settings",
    };
  }
  if (q.includes("watchlist")) {
    return {
      body: "Watchlist is in the left nav. You’ll track tickers and alerts there as we wire market data.",
      source: "From: Help hub · Watchlist",
    };
  }
  return {
    body: "I’m McGBot help (preview). Try the quick prompts below or keywords like rank, referrals, Discord, submit call, or settings. Full answers will ship when we plug in search + docs RAG.",
    source: "From: Help hub · General",
  };
}

export const HUB_SUGGESTED_PROMPTS: { label: string; query: string }[] = [
  { label: "Leaderboard", query: "How do leaderboard ranks work?" },
  { label: "Referrals", query: "Where is my referral link?" },
  { label: "Discord login", query: "Discord OAuth or login issues" },
  { label: "Submit a call", query: "How do I submit a call?" },
  { label: "Settings", query: "Where are profile and settings?" },
];
