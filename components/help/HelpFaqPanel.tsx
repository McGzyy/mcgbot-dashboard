"use client";

import { useEffect, useMemo, useState } from "react";

type FaqFilter = "all" | "account" | "calls" | "technical" | "help";

type FaqItem = {
  id: string;
  filter: Exclude<FaqFilter, "all">;
  q: string;
  a: string;
};

const FAQ_ITEMS: FaqItem[] = [
  {
    id: "leaderboard-rank",
    filter: "calls",
    q: "How do I move up the leaderboard?",
    a: "Post quality calls that resolve well on the tracked windows. Volume alone does not beat consistent hit rate — check the daily board and Your Rank card for the same D/W/M/A ranges as the leaderboard page.",
  },
  {
    id: "referral-link",
    filter: "account",
    q: "Where is my referral link?",
    a: "Open your avatar (top right) → Referrals → Overview. Copy the link there; performance and rewards tabs add more detail as we connect live referral data.",
  },
  {
    id: "discord-login-loop",
    filter: "technical",
    q: "Why did Discord login redirect in a loop?",
    a: "Usually NEXTAUTH_URL, Discord redirect URLs, or DNS (cached A/AAAA records) disagree with the URL you actually use. Apex vs www must match everywhere, including Vercel domain redirects.",
  },
  {
    id: "help-tier-badge",
    filter: "help",
    q: "What does the Help tier badge mean?",
    a: "Doc cards are filtered by your role (caller, moderator, admin). Tier today comes from server env allowlists; later it will read from your user row in the database.",
  },
  {
    id: "ask-mcgbot-ai",
    filter: "help",
    q: "Is Ask McGBot using AI?",
    a: "Not yet — it pattern-matches common questions. We’ll swap in retrieval over these docs (and support) when you’re ready.",
  },
];

const FILTER_CHIPS: { id: FaqFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "account", label: "Account" },
  { id: "calls", label: "Calls" },
  { id: "technical", label: "Technical" },
  { id: "help", label: "Help" },
];

export function HelpFaqPanel() {
  const [filter, setFilter] = useState<FaqFilter>("all");
  const [openId, setOpenId] = useState<string | null>(FAQ_ITEMS[0]?.id ?? null);

  const visible = useMemo(
    () =>
      filter === "all"
        ? FAQ_ITEMS
        : FAQ_ITEMS.filter((item) => item.filter === filter),
    [filter]
  );

  /** Keep a valid open item when the category filter changes; allow fully collapsed when filter unchanged. */
  useEffect(() => {
    setOpenId((prev) => {
      if (visible.length === 0) return null;
      if (prev != null && visible.some((item) => item.id === prev)) return prev;
      return visible[0].id;
    });
  }, [visible]);

  return (
    <div className="rounded-2xl border border-zinc-800/90 bg-gradient-to-br from-zinc-900/85 via-zinc-950/75 to-zinc-950/90 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_28px_90px_-52px_rgba(0,0,0,0.85)] shadow-sm shadow-black/25 backdrop-blur-sm">
      <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-zinc-500">Reference</p>
      <h2 className="mt-1.5 text-base font-semibold tracking-tight text-white">FAQ</h2>
      <p className="mt-1.5 text-xs leading-relaxed text-zinc-400">
        Filter by topic, then tap a question to expand.
      </p>

      <div
        className="mt-4 flex flex-wrap gap-2 border-b border-zinc-800/60 pb-4"
        role="tablist"
        aria-label="FAQ categories"
      >
        {FILTER_CHIPS.map((chip) => {
          const active = filter === chip.id;
          return (
            <button
              key={chip.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => {
                setFilter(chip.id);
              }}
              className={`rounded-full border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] transition ${
                active
                  ? "border-[color:var(--accent)]/40 bg-[color:var(--accent)]/12 text-[color:var(--accent)] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
                  : "border-zinc-700/60 bg-black/25 text-zinc-500 hover:border-zinc-600 hover:text-zinc-300"
              }`}
            >
              {chip.label}
            </button>
          );
        })}
      </div>

      {visible.length === 0 ? (
        <p className="mt-3 text-sm text-zinc-500">No questions in this category yet.</p>
      ) : (
        <ul className="mt-4 space-y-2">
          {visible.map((item) => {
            const isOpen = openId === item.id;
            return (
              <li
                key={item.id}
                className={`overflow-hidden rounded-xl border transition-colors ${
                  isOpen
                    ? "border-[color:var(--accent)]/25 bg-black/30 shadow-[inset_0_1px_0_rgba(57,255,20,0.06)]"
                    : "border-zinc-800/60 bg-black/20 hover:border-zinc-600/40"
                }`}
              >
                <button
                  type="button"
                  onClick={() => setOpenId(isOpen ? null : item.id)}
                  className="flex w-full items-center justify-between gap-3 px-3.5 py-3 text-left text-sm font-medium text-zinc-100 transition hover:bg-zinc-900/35"
                  aria-expanded={isOpen}
                >
                  <span className="min-w-0 leading-snug">{item.q}</span>
                  <span
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border text-xs font-semibold tabular-nums ${
                      isOpen
                        ? "border-[color:var(--accent)]/30 bg-[color:var(--accent)]/10 text-[color:var(--accent)]"
                        : "border-zinc-700/60 bg-zinc-950/50 text-zinc-500"
                    }`}
                    aria-hidden
                  >
                    {isOpen ? "−" : "+"}
                  </span>
                </button>
                {isOpen ? (
                  <p className="border-t border-zinc-800/60 bg-black/20 px-3.5 py-3 text-xs leading-relaxed text-zinc-400">
                    {item.a}
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
