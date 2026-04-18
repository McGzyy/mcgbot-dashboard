"use client";

import {
  getHelpDocToc,
  HelpDocBodyForSlug,
} from "@/components/help/HelpDocSections";
import { HELP_DOC_CARDS } from "@/lib/helpDocCatalog";
import { replyGuideQuestion } from "@/lib/helpGuideMcGBot";
import type { HelpDocSlug } from "@/lib/helpRole";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

type ChatLine = { id: string; from: "user" | "bot"; text: string };

type Props = {
  slug: HelpDocSlug | null;
  onClose: () => void;
};

export function HelpDocModal({ slug, onClose }: Props) {
  const titleId = useId();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [sectionId, setSectionId] = useState<string>("");
  const [askDraft, setAskDraft] = useState("");
  const [askLines, setAskLines] = useState<ChatLine[]>([]);
  const askId = useRef(0);
  const nextAskId = () => {
    askId.current += 1;
    return `ga-${askId.current}`;
  };

  const toc = slug ? getHelpDocToc(slug) : [];
  const docTitle = slug
    ? HELP_DOC_CARDS.find((c) => c.slug === slug)?.title ?? "Guide"
    : "Guide";

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!slug) return;
    const first = getHelpDocToc(slug)[0]?.id ?? "";
    setSectionId(first);
    setAskDraft("");
    setAskLines([
      {
        id: "intro",
        from: "bot",
        text: "Pick a section from the list, then ask a targeted question — answers are scoped to this guide for now.",
      },
    ]);
  }, [slug]);

  useEffect(() => {
    if (!slug) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [slug, onClose]);

  const sectionLabel =
    toc.find((t) => t.id === sectionId)?.label ?? "Whole guide";

  const scrollToSection = useCallback(() => {
    if (!sectionId || !scrollRef.current) return;
    const el = scrollRef.current.querySelector(`#${CSS.escape(sectionId)}`);
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [sectionId]);

  const sendAsk = useCallback(() => {
    const text = askDraft.trim();
    if (!slug || !text) return;
    setAskDraft("");
    const ctx = `[${docTitle} → ${sectionLabel}]`;
    setAskLines((prev) => [
      ...prev,
      { id: nextAskId(), from: "user", text: `${ctx} ${text}` },
      {
        id: nextAskId(),
        from: "bot",
        text: replyGuideQuestion(text, slug, sectionLabel),
      },
    ]);
  }, [askDraft, docTitle, sectionLabel, slug]);

  if (!mounted || !slug) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-black/75 p-3 sm:p-6"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="my-auto flex h-[min(94vh,900px)] w-full max-w-[min(96vw,72rem)] flex-col overflow-hidden rounded-2xl border border-zinc-700 bg-[#070707] shadow-2xl shadow-black/60"
      >
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-zinc-800 px-4 py-3 sm:px-5">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Help</p>
            <h2 id={titleId} className="truncate text-lg font-semibold text-zinc-50 sm:text-xl">
              {docTitle}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg border border-zinc-700 px-3 py-1.5 text-sm font-medium text-zinc-300 transition hover:border-zinc-500 hover:bg-zinc-900 hover:text-white"
          >
            Close
          </button>
        </header>

        <div className="grid min-h-0 flex-1 grid-cols-1 divide-y divide-zinc-800 lg:grid-cols-[minmax(0,1fr)_minmax(272px,300px)] lg:divide-x lg:divide-y-0">
          <div
            ref={scrollRef}
            className="min-h-0 overflow-y-auto px-4 py-4 sm:px-5"
          >
            <HelpDocBodyForSlug slug={slug} />
          </div>

          <aside className="flex min-h-0 flex-col gap-3 overflow-y-auto bg-zinc-950/40 px-4 py-4 sm:px-5 lg:max-h-none">
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Reference a section
              </h3>
              <p className="mt-1 text-[11px] leading-snug text-zinc-600">
                Choose where you are in the doc, jump to it, then ask McGBot — replies use that
                context.
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <label className="sr-only" htmlFor="help-doc-section">
                  Section
                </label>
                <select
                  id="help-doc-section"
                  value={sectionId}
                  onChange={(e) => setSectionId(e.target.value)}
                  className="min-w-0 flex-1 rounded-lg border border-zinc-700 bg-zinc-900/80 px-2 py-2 text-xs text-zinc-100 focus:border-green-500/40 focus:outline-none focus:ring-1 focus:ring-green-500/25"
                >
                  {toc.map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.label}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={scrollToSection}
                  className="shrink-0 rounded-lg border border-zinc-600 bg-zinc-800/80 px-3 py-2 text-xs font-semibold text-zinc-200 transition hover:border-zinc-500 hover:bg-zinc-800"
                >
                  Jump
                </button>
              </div>
            </div>

            <div className="flex min-h-0 flex-1 flex-col rounded-xl border border-zinc-800 bg-[#0a0a0a]">
              <div className="border-b border-zinc-800 px-3 py-2">
                <h3 className="text-xs font-semibold text-zinc-200">Ask McGBot</h3>
                <p className="mt-0.5 text-[10px] leading-snug text-zinc-500">
                  About: <span className="font-medium text-green-400/90">{sectionLabel}</span>
                </p>
              </div>
              <div className="max-h-[140px] min-h-[72px] space-y-1.5 overflow-y-auto px-2 py-2">
                {askLines.map((m) => (
                  <div
                    key={m.id}
                    className={`flex ${m.from === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[98%] rounded-md px-2 py-1 text-[11px] leading-relaxed ${
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
              <div className="border-t border-zinc-800 p-2">
                <textarea
                  value={askDraft}
                  onChange={(e) => setAskDraft(e.target.value)}
                  rows={2}
                  placeholder="Ask about the section you selected…"
                  className="w-full resize-none rounded-lg border border-zinc-700 bg-zinc-950/80 px-2 py-1.5 text-[11px] text-zinc-100 placeholder:text-zinc-600 focus:border-green-500/40 focus:outline-none focus:ring-1 focus:ring-green-500/25"
                />
                <button
                  type="button"
                  onClick={sendAsk}
                  className="mt-2 w-full rounded-lg bg-[color:var(--accent)] py-2 text-xs font-semibold text-black transition hover:bg-green-400"
                >
                  Send
                </button>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>,
    document.body
  );
}
