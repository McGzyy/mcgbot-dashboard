"use client";

import { useCallback, useRef, useState } from "react";

type ChatLine = { id: string; from: "user" | "bot"; text: string };

function botReply(question: string): string {
  const q = question.toLowerCase();
  if (q.includes("rank") || q.includes("leaderboard")) {
    return "Leaderboard ranks use rolling windows (daily board on the home hub and full page under Leaderboard). Your Rank D/W/M/A matches that page — keep calls high quality to climb.";
  }
  if (q.includes("referral") || q.includes("invite")) {
    return "Referrals live under your account menu → Referrals. Start at Overview for your link; Performance and Rewards summarize downstream callers (live metrics wiring soon).";
  }
  if (q.includes("login") || q.includes("discord") || q.includes("oauth") || q.includes("sign in")) {
    return "We use Discord for sign-in. If OAuth loops, confirm NEXTAUTH_URL matches the live site (www vs apex) and Discord redirect URLs include https://your-domain/api/auth/callback/discord.";
  }
  if (q.includes("submit") || q.includes("call")) {
    return "Submit Call is on the dashboard: open the modal, fill symbol / chain / thesis, then send. Bad or duplicate calls hurt leaderboard trust — double-check before posting.";
  }
  if (q.includes("setting") || q.includes("profile") || q.includes("bio")) {
    return "Profile is under your avatar → Profile; account toggles live in Settings. Visibility and bio sync when the profile API is connected to your Supabase row.";
  }
  if (q.includes("watchlist")) {
    return "Watchlist is in the left nav. You’ll track tickers and alerts there as we wire market data.";
  }
  return "I’m McGBot help (preview). Try keywords like **rank**, **referrals**, **Discord**, **submit call**, or **settings**. Full answers will ship when we plug in search + docs RAG.";
}

export function AskMcGBotPanel() {
  const [lines, setLines] = useState<ChatLine[]>([
    {
      id: "welcome",
      from: "bot",
      text: "Ask about ranks, referrals, Discord login, submitting calls, or settings — short answers for now.",
    },
  ]);
  const [draft, setDraft] = useState("");
  const idRef = useRef(0);
  const nextId = () => {
    idRef.current += 1;
    return `m-${idRef.current}`;
  };

  const send = useCallback(() => {
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    setLines((prev) => [
      ...prev,
      { id: nextId(), from: "user", text },
      { id: nextId(), from: "bot", text: botReply(text) },
    ]);
  }, [draft]);

  return (
    <div className="flex flex-col rounded-xl border border-[#1a1a1a] bg-[#0a0a0a] shadow-sm shadow-black/20">
      <div className="border-b border-[#1a1a1a] px-3 py-2">
        <h2 className="text-sm font-semibold text-zinc-100">Ask McGBot</h2>
        <p className="text-[11px] leading-snug text-zinc-500">
          Keyword hints for now — smarter answers when we connect docs search.
        </p>
      </div>
      <div className="max-h-[220px] min-h-[120px] space-y-2 overflow-y-auto px-3 py-2">
        {lines.map((m) => (
          <div
            key={m.id}
            className={`flex ${m.from === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[95%] rounded-lg px-2.5 py-1.5 text-xs leading-relaxed ${
                m.from === "user"
                  ? "bg-zinc-800 text-zinc-100"
                  : "border border-green-500/20 bg-green-500/5 text-zinc-200"
              }`}
            >
              {m.text}
            </div>
          </div>
        ))}
      </div>
      <div className="border-t border-[#1a1a1a] p-2">
        <div className="flex gap-2">
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                send();
              }
            }}
            placeholder="Type a question…"
            className="min-w-0 flex-1 rounded-lg border border-zinc-800 bg-zinc-950/80 px-2.5 py-2 text-xs text-zinc-100 placeholder:text-zinc-600 focus:border-green-500/40 focus:outline-none focus:ring-1 focus:ring-green-500/25"
            aria-label="Question for McGBot"
          />
          <button
            type="button"
            onClick={send}
            className="shrink-0 rounded-lg bg-[color:var(--accent)] px-3 py-2 text-xs font-semibold text-black transition hover:bg-green-400"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
