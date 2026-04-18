"use client";

import { useState } from "react";

const FAQ_ITEMS: { q: string; a: string }[] = [
  {
    q: "How do I move up the leaderboard?",
    a: "Post quality calls that resolve well on the tracked windows. Volume alone does not beat consistent hit rate — check the daily board and Your Rank card for the same D/W/M/A ranges as the leaderboard page.",
  },
  {
    q: "Where is my referral link?",
    a: "Open your avatar (top right) → Referrals → Overview. Copy the link there; performance and rewards tabs add more detail as we connect live referral data.",
  },
  {
    q: "Why did Discord login redirect in a loop?",
    a: "Usually NEXTAUTH_URL, Discord redirect URLs, or DNS (cached A/AAAA records) disagree with the URL you actually use. Apex vs www must match everywhere, including Vercel domain redirects.",
  },
  {
    q: "What does the Help tier badge mean?",
    a: "Doc cards are filtered by your role (caller, moderator, admin). Tier today comes from server env allowlists; later it will read from your user row in the database.",
  },
  {
    q: "Is Ask McGBot using AI?",
    a: "Not yet — it pattern-matches common questions. We’ll swap in retrieval over these docs (and support) when you’re ready.",
  },
];

export function HelpFaqPanel() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <div className="rounded-xl border border-[#1a1a1a] bg-[#0a0a0a] p-4 shadow-sm shadow-black/20">
      <h2 className="text-sm font-semibold text-zinc-100">FAQ</h2>
      <p className="mt-0.5 text-xs text-zinc-500">Tap a question to expand.</p>
      <ul className="mt-3 space-y-2">
        {FAQ_ITEMS.map((item, i) => {
          const isOpen = open === i;
          return (
            <li key={item.q} className="rounded-lg border border-zinc-800/80 bg-zinc-950/30">
              <button
                type="button"
                onClick={() => setOpen(isOpen ? null : i)}
                className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-sm font-medium text-zinc-200 transition hover:bg-zinc-900/40"
                aria-expanded={isOpen}
              >
                <span>{item.q}</span>
                <span className="shrink-0 text-zinc-500" aria-hidden>
                  {isOpen ? "−" : "+"}
                </span>
              </button>
              {isOpen ? (
                <p className="border-t border-zinc-800/60 px-3 py-2.5 text-xs leading-relaxed text-zinc-400">
                  {item.a}
                </p>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
