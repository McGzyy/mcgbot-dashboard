"use client";

import { HUB_SUGGESTED_PROMPTS, hubBotReply } from "@/lib/helpHubMcGBot";
import { useCallback, useRef, useState } from "react";

type ChatLine = {
  id: string;
  from: "user" | "bot";
  text: string;
  /** Bot-only: attribution line under the body */
  source?: string;
};

export function AskMcGBotPanel() {
  const [lines, setLines] = useState<ChatLine[]>([
    {
      id: "welcome",
      from: "bot",
      text: "Ask about ranks, referrals, Discord login, submitting calls, or settings — short answers for now.",
      source: "From: McGBot · Help hub",
    },
  ]);
  const [draft, setDraft] = useState("");
  const idRef = useRef(0);
  const nextId = () => {
    idRef.current += 1;
    return `m-${idRef.current}`;
  };

  const appendExchange = useCallback((userText: string) => {
    const t = userText.trim();
    if (!t) return;
    const reply = hubBotReply(t);
    setLines((prev) => [
      ...prev,
      { id: nextId(), from: "user", text: t },
      {
        id: nextId(),
        from: "bot",
        text: reply.body,
        source: reply.source,
      },
    ]);
  }, []);

  const send = useCallback(() => {
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    appendExchange(text);
  }, [draft, appendExchange]);

  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-white/[0.07] bg-gradient-to-br from-zinc-900/85 via-zinc-950/75 to-black/55 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_28px_90px_-52px_rgba(0,0,0,0.85)] backdrop-blur-sm">
      <div className="border-b border-white/[0.06] px-4 py-3">
        <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-zinc-500">Assistant</p>
        <h2 className="mt-1 text-base font-semibold tracking-tight text-white">Ask McGBot</h2>
        <p className="mt-1 text-[11px] leading-relaxed text-zinc-400">
          Keyword hints for now — smarter answers when we connect docs search.
        </p>
        <div className="mt-3 flex flex-wrap gap-2" aria-label="Suggested questions">
          {HUB_SUGGESTED_PROMPTS.map((chip) => (
            <button
              key={chip.label}
              type="button"
              onClick={() => appendExchange(chip.query)}
              className="rounded-full border border-zinc-700/55 bg-black/25 px-3 py-1.5 text-[10px] font-semibold text-zinc-400 transition hover:border-[color:var(--accent)]/35 hover:bg-[color:var(--accent)]/8 hover:text-zinc-200"
            >
              {chip.label}
            </button>
          ))}
        </div>
      </div>
      <div className="max-h-[220px] min-h-[120px] space-y-2 overflow-y-auto px-4 py-3">
        {lines.map((m) => (
          <div
            key={m.id}
            className={`flex ${m.from === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[95%] rounded-xl px-3 py-2 text-xs leading-relaxed ${
                m.from === "user"
                  ? "border border-zinc-700/50 bg-zinc-800/80 text-zinc-100 shadow-sm"
                  : "border border-[color:var(--accent)]/22 bg-[color:var(--accent)]/[0.07] text-zinc-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
              }`}
            >
              <div>{m.text}</div>
              {m.from === "bot" && m.source ? (
                <p className="mt-2 border-t border-white/[0.06] pt-2 text-[10px] font-medium leading-snug text-zinc-500">
                  {m.source}
                </p>
              ) : null}
            </div>
          </div>
        ))}
      </div>
      <div className="border-t border-white/[0.06] bg-black/20 p-3">
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
            className="min-w-0 flex-1 rounded-xl border border-zinc-700/50 bg-zinc-950/80 px-3 py-2.5 text-xs text-zinc-100 placeholder:text-zinc-600 focus:border-[color:var(--accent)]/40 focus:outline-none focus:ring-2 focus:ring-[color:var(--accent)]/15"
            aria-label="Question for McGBot"
          />
          <button
            type="button"
            onClick={send}
            className="shrink-0 rounded-xl bg-[color:var(--accent)] px-4 py-2.5 text-xs font-semibold text-black shadow-lg shadow-black/25 transition hover:bg-green-400"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
