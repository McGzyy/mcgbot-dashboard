"use client";

import {
  getHelpDocToc,
  HelpDocBodyForSlug,
} from "@/components/help/HelpDocSections";
import { HELP_DOC_CARDS } from "@/lib/helpDocCatalog";
import {
  guideSuggestedPrompts,
  replyGuideQuestion,
} from "@/lib/helpGuideMcGBot";
import type { HelpDocSlug } from "@/lib/helpRole";
import type { RefObject } from "react";
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

type ChatLine = {
  id: string;
  from: "user" | "bot";
  text: string;
  source?: string;
};

type Props = {
  slug: HelpDocSlug | null;
  /** When opening from `/help?doc=&section=`, anchor id (e.g. `caller-dashboard`). */
  initialSectionId?: string | null;
  onClose: () => void;
  /** Button (or control) that opened the modal — receives focus after close. */
  openerRef: RefObject<HTMLElement | null>;
};

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const fn = () => setReduced(mq.matches);
    mq.addEventListener("change", fn);
    return () => mq.removeEventListener("change", fn);
  }, []);
  return reduced;
}

function getFocusable(root: HTMLElement): HTMLElement[] {
  const sel = [
    "button:not([disabled])",
    "a[href]",
    "input:not([disabled])",
    "select:not([disabled])",
    "textarea:not([disabled])",
    '[tabindex]:not([tabindex="-1"])',
  ].join(",");
  return Array.from(root.querySelectorAll<HTMLElement>(sel)).filter(
    (el) => !el.hasAttribute("disabled") && el.tabIndex !== -1
  );
}

const CLOSE_MS = 220;

export function HelpDocModal({
  slug,
  initialSectionId = null,
  onClose,
  openerRef,
}: Props) {
  const titleId = useId();
  const scrollRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const [mounted, setMounted] = useState(false);
  const reduceMotion = usePrefersReducedMotion();
  /** Enter/exit: CSS anim handles enter; exit uses class + timeout. */
  const [exiting, setExiting] = useState(false);
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
    const tocRows = getHelpDocToc(slug);
    const first = tocRows[0]?.id ?? "";
    const pick =
      initialSectionId && tocRows.some((t) => t.id === initialSectionId)
        ? initialSectionId
        : first;
    setSectionId(pick);
    setAskDraft("");
    setExiting(false);
    setAskLines([
      {
        id: "intro",
        from: "bot",
        text: "Pick a section from the list, then ask a targeted question — answers are scoped to this guide for now.",
        source: "From: McGBot · Guide assistant",
      },
    ]);

    let raf = 0;
    if (
      initialSectionId &&
      tocRows.some((t) => t.id === initialSectionId)
    ) {
      const sid = initialSectionId;
      const run = () => {
        const el = scrollRef.current?.querySelector(`#${CSS.escape(sid)}`);
        if (!el || !(el instanceof HTMLElement)) return;
        el.scrollIntoView({
          behavior: reduceMotion ? "auto" : "smooth",
          block: "start",
        });
        if (!reduceMotion) {
          el.classList.add("help-section-jump-flash");
          window.setTimeout(() => el.classList.remove("help-section-jump-flash"), 1100);
        } else {
          el.classList.add("ring-2", "ring-green-500/40");
          window.setTimeout(() => el.classList.remove("ring-2", "ring-green-500/40"), 600);
        }
      };
      raf = window.requestAnimationFrame(() =>
        window.requestAnimationFrame(run)
      );
    }
    return () => {
      if (raf !== 0) window.cancelAnimationFrame(raf);
    };
  }, [slug, initialSectionId, reduceMotion]);

  const finishClose = useCallback(() => {
    onClose();
    queueMicrotask(() => {
      const el = openerRef.current;
      if (el && typeof el.focus === "function") {
        try {
          el.focus();
        } catch {
          /* ignore */
        }
      }
    });
  }, [onClose, openerRef]);

  const requestClose = useCallback(() => {
    if (exiting) return;
    if (reduceMotion) {
      finishClose();
      return;
    }
    setExiting(true);
  }, [exiting, reduceMotion, finishClose]);

  useEffect(() => {
    if (!exiting || reduceMotion) return;
    const t = window.setTimeout(() => {
      setExiting(false);
      finishClose();
    }, CLOSE_MS);
    return () => window.clearTimeout(t);
  }, [exiting, reduceMotion, finishClose]);

  useEffect(() => {
    if (!slug) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        requestClose();
      }
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [slug, requestClose]);

  /** Initial focus when dialog opens (after enter animation unless reduced motion). */
  useEffect(() => {
    if (!slug || exiting) return;
    const delay = reduceMotion ? 0 : 80;
    const t = window.setTimeout(() => {
      closeBtnRef.current?.focus();
    }, delay);
    return () => window.clearTimeout(t);
  }, [slug, exiting, reduceMotion]);

  /** Tab trap while modal is open (not during exit). */
  useEffect(() => {
    if (!slug || exiting) return;
    const onDocKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const root = dialogRef.current;
      if (!root) return;

      const list = getFocusable(root);
      if (list.length === 0) return;
      const first = list[0];
      const last = list[list.length - 1];
      const active = document.activeElement;

      if (!active || !root.contains(active)) {
        e.preventDefault();
        first.focus();
        return;
      }

      if (e.shiftKey) {
        if (active === first) {
          e.preventDefault();
          last.focus();
        }
      } else if (active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onDocKeyDown, true);
    return () => document.removeEventListener("keydown", onDocKeyDown, true);
  }, [slug, exiting]);

  const sectionLabel =
    toc.find((t) => t.id === sectionId)?.label ?? "Whole guide";

  const scrollToSection = useCallback(() => {
    if (!sectionId || !scrollRef.current) return;
    const el = scrollRef.current.querySelector(`#${CSS.escape(sectionId)}`);
    if (!el || !(el instanceof HTMLElement)) return;
    el.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
    if (!reduceMotion) {
      el.classList.add("help-section-jump-flash");
      window.setTimeout(() => el.classList.remove("help-section-jump-flash"), 1100);
    } else {
      el.classList.add("ring-2", "ring-green-500/40");
      window.setTimeout(() => el.classList.remove("ring-2", "ring-green-500/40"), 600);
    }
  }, [sectionId, reduceMotion]);

  const appendGuideExchange = useCallback(
    (userText: string) => {
      if (!slug) return;
      const t = userText.trim();
      if (!t) return;
      const reply = replyGuideQuestion(t, slug, sectionLabel);
      setAskLines((prev) => [
        ...prev,
        { id: nextAskId(), from: "user", text: t },
        {
          id: nextAskId(),
          from: "bot",
          text: reply.body,
          source: reply.source,
        },
      ]);
    },
    [sectionLabel, slug]
  );

  const sendAsk = useCallback(() => {
    const text = askDraft.trim();
    if (!text) return;
    setAskDraft("");
    appendGuideExchange(text);
  }, [askDraft, appendGuideExchange]);

  if (!mounted || !slug) return null;

  const backdropClass = reduceMotion
    ? "bg-black/75 opacity-100"
    : exiting
      ? "bg-black/75 opacity-0 transition-opacity duration-[220ms] ease-out"
      : "help-modal-backdrop-in bg-black/75 opacity-100";

  const panelClass = reduceMotion
    ? "opacity-100"
    : exiting
      ? "opacity-0 translate-y-2 scale-[0.97] transition-all duration-[220ms] ease-out"
      : "help-modal-panel-in opacity-100";

  return createPortal(
    <div
      className={`fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto p-3 sm:p-6 ${backdropClass}`}
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !exiting) requestClose();
      }}
    >
      <div
        key={slug}
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`my-auto flex h-[min(94vh,900px)] w-full max-w-[min(96vw,72rem)] flex-col overflow-hidden rounded-2xl border border-zinc-700 bg-[#070707] shadow-2xl shadow-black/60 ${panelClass}`}
      >
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-zinc-800 px-4 py-3 sm:px-5">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Help</p>
            <h2 id={titleId} className="truncate text-lg font-semibold text-zinc-50 sm:text-xl">
              {docTitle}
            </h2>
          </div>
          <button
            ref={closeBtnRef}
            type="button"
            onClick={requestClose}
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
              <div className="border-t border-zinc-800 px-2 pb-2 pt-1.5">
                <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-zinc-600">
                  Quick prompts
                </p>
                <div className="mb-2 flex flex-wrap gap-1" aria-label="Suggested questions for this section">
                  {guideSuggestedPrompts(sectionLabel).map((chip) => (
                    <button
                      key={chip.label}
                      type="button"
                      onClick={() => appendGuideExchange(chip.query)}
                      className="rounded-full border border-zinc-700/90 bg-zinc-900/50 px-2 py-0.5 text-[10px] font-medium text-zinc-400 transition hover:border-green-500/35 hover:bg-zinc-800/80 hover:text-zinc-200"
                    >
                      {chip.label}
                    </button>
                  ))}
                </div>
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
