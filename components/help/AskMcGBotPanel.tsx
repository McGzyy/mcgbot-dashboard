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
    <div className="flex flex-col rounded-xl border border-[#1a1a1a] bg-[#0a0a0a] shadow-sm shadow-black/20">
      <div className="border-b border-[#1a1a1a] px-3 py-2">
        <h2 className="text-sm font-semibold text-zinc-100">Ask McGBot</h2>
        <p className="text-[11px] leading-snug text-zinc-500">
          Keyword hints for now — smarter answers when we connect docs search.
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5" aria-label="Suggested questions">
          {HUB_SUGGESTED_PROMPTS.map((chip) => (
            <button
              key={chip.label}
              type="button"
              onClick={() => appendExchange(chip.query)}
              className="rounded-full border border-zinc-700/90 bg-zinc-900/50 px-2.5 py-1 text-[10px] font-medium text-zinc-400 transition hover:border-green-500/35 hover:bg-zinc-800/80 hover:text-zinc-200"
            >
              {chip.label}
            </button>
          ))}
        </div>
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
              <div>{m.text}</div>
              {m.from === "bot" && m.source ? (
                <p className="mt-1.5 border-t border-green-500/15 pt-1.5 text-[10px] font-medium leading-snug text-zinc-500">
                  {m.source}
                </p>
              ) : null}
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
