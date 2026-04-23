"use client";

import { AskMcGBotPanel } from "@/components/help/AskMcGBotPanel";
import { HelpDocModal } from "@/components/help/HelpDocModal";
import { HelpFaqPanel } from "@/components/help/HelpFaqPanel";
import { HelpQuickLinksPanel } from "@/components/help/HelpQuickLinksPanel";
import { getHelpDocToc } from "@/components/help/HelpDocSections";
import { HELP_DOC_CARDS } from "@/lib/helpDocCatalog";
import { isHelpDocSlug, type HelpDocSlug, type HelpTier } from "@/lib/helpRole";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { Suspense, useEffect, useRef, useState } from "react";
import { useNotifications } from "@/app/contexts/NotificationsContext";
import type { TutorialSection } from "@/lib/tutorial/tutorialRegistry";

function HelpPageContent() {
  const { status } = useSession();
  const { addNotification } = useNotifications();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [tier, setTier] = useState<HelpTier | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [openDocSlug, setOpenDocSlug] = useState<HelpDocSlug | null>(null);
  /** When opening from `?doc=&section=`, which anchor to select + scroll to (cleared on modal close). */
  const [initialSectionId, setInitialSectionId] = useState<string | null>(null);
  const docOpenerRef = useRef<HTMLElement | null>(null);
  const [bugOpen, setBugOpen] = useState(false);
  const [bugTitle, setBugTitle] = useState("");
  const [bugDescription, setBugDescription] = useState("");
  const [bugSteps, setBugSteps] = useState("");
  const [bugImages, setBugImages] = useState<File[]>([]);
  const [bugSubmitting, setBugSubmitting] = useState(false);
  const [featureOpen, setFeatureOpen] = useState(false);
  const [featureTitle, setFeatureTitle] = useState("");
  const [featureDescription, setFeatureDescription] = useState("");
  const [featureUseCase, setFeatureUseCase] = useState("");
  const [featureImages, setFeatureImages] = useState<File[]>([]);
  const [featureSubmitting, setFeatureSubmitting] = useState(false);
  const [tutorialSections, setTutorialSections] = useState<TutorialSection[]>([]);
  const [tutorialSectionId, setTutorialSectionId] = useState<string>("");

  useEffect(() => {
    if (status !== "authenticated") return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/me/help-role");
        if (!res.ok) {
          if (!cancelled) setLoadError("Could not resolve your help tier.");
          return;
        }
        const data = (await res.json()) as { role?: HelpTier };
        const r = data.role;
        if (r === "user" || r === "mod" || r === "admin") {
          if (!cancelled) setTier(r);
        } else if (!cancelled) setLoadError("Unexpected response.");
      } catch {
        if (!cancelled) setLoadError("Network error.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [status]);

  useEffect(() => {
    if (tier === null) return;
    const docRaw = searchParams.get("doc");
    if (!docRaw || !isHelpDocSlug(docRaw)) return;
    const slug = docRaw;
    const allowed = HELP_DOC_CARDS.some((c) => c.slug === slug && c.visible(tier));
    if (!allowed) return;

    const sectionRaw = searchParams.get("section");
    let sectionValid: string | null = null;
    if (sectionRaw && getHelpDocToc(slug).some((r) => r.id === sectionRaw)) {
      sectionValid = sectionRaw;
    }

    docOpenerRef.current = null;
    setInitialSectionId(sectionValid);
    setOpenDocSlug(slug);
    router.replace("/help", { scroll: false });
  }, [tier, searchParams, router]);

  const visibleCards =
    tier === null ? [] : HELP_DOC_CARDS.filter((c) => c.visible(tier));

  const closeModal = () => {
    setOpenDocSlug(null);
    setInitialSectionId(null);
  };

  useEffect(() => {
    if (status !== "authenticated" || tier === null) return;
    try {
      const w = window as any;
      const sections = typeof w?.__mcgbotTutorial?.sections === "function" ? w.__mcgbotTutorial.sections() : [];
      if (Array.isArray(sections)) {
        setTutorialSections(sections as TutorialSection[]);
      }
    } catch {}
  }, [status, tier]);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6">
      <header
        className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between"
        data-tutorial="help.header"
      >
        <div>
          <h1 className="text-xl font-semibold text-zinc-100">Help</h1>
          <p className="text-sm text-zinc-500">
            Role docs, FAQ, and quick answers — McGBot support will plug in here over time.
          </p>
          {status === "authenticated" ? (
            <p className="mt-2 text-xs leading-relaxed text-zinc-600">
              <span className="font-medium text-zinc-500">Shortcut:</span>{" "}
              <kbd className="rounded-md border border-zinc-700/80 bg-zinc-900/50 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-zinc-400">
                ?
              </kbd>{" "}
              <span className="text-zinc-600">
                (Shift + /) opens Help from any page when focus is not in a field, like
              </span>{" "}
              <kbd className="rounded-md border border-zinc-700/80 bg-zinc-900/50 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-zinc-400">
                /
              </kbd>{" "}
              <span className="text-zinc-600">for token search.</span>
            </p>
          ) : null}
        </div>
        <Link
          href="/"
          className="text-sm font-medium text-[color:var(--accent)] transition hover:text-green-400"
        >
          ← Dashboard
        </Link>
      </header>

      {status === "loading" ? (
        <p className="text-sm text-zinc-500">Loading…</p>
      ) : status === "unauthenticated" ? (
        <div className="rounded-xl border border-[#1a1a1a] bg-[#0a0a0a] p-8 text-center">
          <p className="text-sm text-zinc-400">Sign in with Discord to open Help and role docs.</p>
          <Link
            href="/"
            className="mt-3 inline-block text-sm font-semibold text-[color:var(--accent)] hover:text-green-400"
          >
            Go to home
          </Link>
        </div>
      ) : loadError ? (
        <p className="text-sm text-red-400/90">{loadError}</p>
      ) : tier === null ? (
        <p className="text-sm text-zinc-500">Resolving your access…</p>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <section
              aria-label="Tutorial mode"
              data-tutorial="help.tutorialPanel"
              className="rounded-xl border border-zinc-800/80 bg-zinc-950/40 p-4 shadow-sm shadow-black/20"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-zinc-500">Onboarding</p>
                  <h2 className="mt-1 text-sm font-semibold text-zinc-100">Tutorial mode</h2>
                  <p className="mt-1 text-xs leading-relaxed text-zinc-500">
                    Run the guided tour again, or jump to a specific section. You can skip anytime.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const w = window as any;
                    if (typeof w?.__mcgbotTutorial?.start === "function") {
                      w.__mcgbotTutorial.start();
                      addNotification({
                        id: crypto.randomUUID(),
                        text: "Tutorial started.",
                        type: "call",
                        createdAt: Date.now(),
                        priority: "low",
                      });
                    }
                  }}
                  className="rounded-lg border border-emerald-500/30 bg-emerald-950/35 px-3 py-1.5 text-xs font-semibold text-emerald-100/95 transition hover:border-emerald-400/45 hover:bg-emerald-950/50"
                >
                  Start tutorial
                </button>
              </div>

              <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
                <label className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Jump to</label>
                <select
                  value={tutorialSectionId}
                  onChange={(e) => setTutorialSectionId(e.target.value)}
                  className="min-w-0 flex-1 rounded-lg border border-zinc-800/80 bg-black/25 px-3 py-2 text-xs text-zinc-200 outline-none focus:ring-2 focus:ring-[color:var(--accent)]/20"
                >
                  <option value="">Choose a section…</option>
                  {tutorialSections.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => {
                    const id = tutorialSectionId.trim();
                    if (!id) return;
                    const w = window as any;
                    if (typeof w?.__mcgbotTutorial?.start === "function") {
                      w.__mcgbotTutorial.start(id);
                    }
                  }}
                  disabled={!tutorialSectionId.trim()}
                  className="rounded-lg border border-zinc-700/80 bg-zinc-950/50 px-3 py-2 text-xs font-semibold text-zinc-200 transition hover:border-zinc-600 hover:text-white disabled:opacity-50"
                >
                  Go
                </button>
              </div>

              <div className="mt-3">
                <button
                  type="button"
                  onClick={async () => {
                    const w = window as any;
                    if (typeof w?.__mcgbotTutorial?.reset === "function") {
                      await w.__mcgbotTutorial.reset();
                      addNotification({
                        id: crypto.randomUUID(),
                        text: "Tutorial reset. It will auto-run again on next login.",
                        type: "call",
                        createdAt: Date.now(),
                        priority: "low",
                      });
                    }
                  }}
                  className="text-xs font-semibold text-zinc-500 underline-offset-2 transition hover:text-zinc-300 hover:underline"
                >
                  Reset tutorial
                </button>
              </div>
            </section>
            <section aria-label="Report a bug" className="rounded-xl border border-zinc-800/80 bg-zinc-950/40 p-4 shadow-sm shadow-black/20">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-zinc-500">Support</p>
                  <h2 className="mt-1 text-sm font-semibold text-zinc-100">Report a bug</h2>
                  <p className="mt-1 text-xs leading-relaxed text-zinc-500">
                    Found something broken? Admin will review and you’ll get a bell notification when it’s closed.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setBugOpen(true)}
                  className="rounded-lg border border-zinc-700/80 bg-zinc-950/50 px-3 py-1.5 text-xs font-semibold text-zinc-200 transition hover:border-zinc-600 hover:text-white"
                >
                  Submit bug
                </button>
              </div>
            </section>
            <section aria-label="Request a feature" className="rounded-xl border border-zinc-800/80 bg-zinc-950/40 p-4 shadow-sm shadow-black/20">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-zinc-500">Feedback</p>
                  <h2 className="mt-1 text-sm font-semibold text-zinc-100">Feature request</h2>
                  <p className="mt-1 text-xs leading-relaxed text-zinc-500">
                    Have an idea for the dashboard or bot? Tell us what you want and why it matters to you.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setFeatureOpen(true)}
                  className="rounded-lg border border-violet-600/40 bg-violet-950/40 px-3 py-1.5 text-xs font-semibold text-violet-100 transition hover:border-violet-500/60 hover:bg-violet-950/60"
                >
                  Submit idea
                </button>
              </div>
            </section>
          </div>

          <section aria-label="Documentation for your role">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Docs
              </span>
              <span
                className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                  tier === "admin"
                    ? "border-amber-500/30 bg-amber-500/10 text-amber-200"
                    : tier === "mod"
                      ? "border-sky-500/30 bg-sky-500/10 text-sky-200"
                      : "border-zinc-600/50 bg-zinc-800/40 text-zinc-200"
                }`}
              >
                {tier === "admin" ? "Admin" : tier === "mod" ? "Moderator" : "Caller"}
              </span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {visibleCards.map((card, index) => (
                <button
                  key={card.slug}
                  type="button"
                  onMouseDown={(e) => {
                    docOpenerRef.current = e.currentTarget;
                  }}
                  onClick={() => {
                    setInitialSectionId(null);
                    setOpenDocSlug(card.slug);
                  }}
                  className={[
                    "group relative flex flex-col overflow-hidden rounded-xl border border-zinc-800/90",
                    "bg-gradient-to-b from-zinc-900/55 to-zinc-900/[0.18] p-3 text-left shadow-sm shadow-black/25",
                    "shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]",
                    "transition-[border-color,box-shadow,transform,background-color] duration-200 ease-out",
                    "before:pointer-events-none before:absolute before:inset-0 before:rounded-xl",
                    "before:bg-gradient-to-br before:from-[#39FF14]/12 before:via-transparent before:to-sky-500/5",
                    "before:opacity-0 before:transition-opacity before:duration-200",
                    "hover:-translate-y-0.5 hover:border-green-500/35 hover:shadow-[inset_0_1px_0_rgba(57,255,20,0.07),0_12px_40px_-16px_rgba(0,0,0,0.75)]",
                    "hover:before:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500/35",
                  ].join(" ")}
                >
                  <div className="relative z-[1] flex flex-col gap-2">
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-600 transition-colors group-hover:text-[color:var(--accent)]/90">
                        #{String(index + 1).padStart(2, "0")}
                      </span>
                      <span className="shrink-0 rounded-md border border-zinc-800/80 bg-black/25 px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-zinc-500 transition-colors group-hover:border-green-500/20 group-hover:text-zinc-400">
                        {card.readMinutes} min read
                      </span>
                    </div>
                    <h2 className="text-sm font-semibold leading-snug text-zinc-100 transition-colors group-hover:text-[color:var(--accent)]">
                      {card.title}
                    </h2>
                    <p className="min-h-[2.75rem] flex-1 text-xs leading-relaxed text-zinc-500 transition-colors group-hover:text-zinc-400">
                      {card.description}
                    </p>
                    <div className="mt-1 flex items-end justify-between gap-2 border-t border-zinc-800/60 pt-2">
                      <span className="text-[10px] tabular-nums text-zinc-600">
                        Updated{" "}
                        <span className="font-medium text-zinc-500 group-hover:text-zinc-400">
                          {card.updatedLabel}
                        </span>
                      </span>
                      <span className="text-[11px] font-semibold text-zinc-600 transition-colors group-hover:text-green-400/90">
                        Open guide →
                      </span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </section>

          <HelpDocModal
            slug={openDocSlug}
            initialSectionId={initialSectionId}
            onClose={closeModal}
            openerRef={docOpenerRef}
          />

          <div className="border-t border-zinc-800/90" aria-hidden />

          <section
            className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(260px,300px)] lg:items-start"
            aria-label="FAQ and assistant"
          >
            <HelpFaqPanel />
            <div className="flex flex-col gap-4">
              <AskMcGBotPanel />
              <HelpQuickLinksPanel />
            </div>
          </section>

          {bugOpen ? (
            <div
              className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-black/60 px-4 py-10"
              role="dialog"
              aria-modal="true"
              aria-label="Submit bug report"
              onMouseDown={(e) => {
                if (e.target === e.currentTarget) setBugOpen(false);
              }}
            >
              <div className="mt-10 w-full max-w-xl rounded-xl border border-zinc-800/80 bg-zinc-950/90 p-4 shadow-xl shadow-black/50 backdrop-blur">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-zinc-100">Submit bug</h3>
                    <p className="mt-1 text-xs text-zinc-500">Short and specific is best.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setBugOpen(false)}
                    className="rounded-md border border-zinc-800 bg-zinc-900/60 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-900"
                    aria-label="Close"
                  >
                    Esc
                  </button>
                </div>

                <div className="mt-4 space-y-3">
                  <div>
                    <label className="text-xs font-medium text-zinc-400">Title</label>
                    <input
                      value={bugTitle}
                      onChange={(e) => setBugTitle(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-zinc-800 bg-black/30 px-3 py-2 text-sm text-zinc-100 outline-none ring-emerald-500/20 focus:ring-2"
                      placeholder="e.g. Bot calls page shows blank"
                      disabled={bugSubmitting}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-zinc-400">What happened?</label>
                    <textarea
                      value={bugDescription}
                      onChange={(e) => setBugDescription(e.target.value)}
                      rows={4}
                      className="mt-1 w-full resize-none rounded-lg border border-zinc-800 bg-black/30 px-3 py-2 text-sm text-zinc-100 outline-none ring-emerald-500/20 focus:ring-2"
                      placeholder="Describe the bug and what you expected instead."
                      disabled={bugSubmitting}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-zinc-400">Steps to reproduce (optional)</label>
                    <textarea
                      value={bugSteps}
                      onChange={(e) => setBugSteps(e.target.value)}
                      rows={3}
                      className="mt-1 w-full resize-none rounded-lg border border-zinc-800 bg-black/30 px-3 py-2 text-sm text-zinc-100 outline-none ring-emerald-500/20 focus:ring-2"
                      placeholder="1) … 2) … 3) …"
                      disabled={bugSubmitting}
                    />
                  </div>

                  <div>
                    <label className="text-xs font-medium text-zinc-400">
                      Screenshots (optional, up to 5)
                    </label>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      disabled={bugSubmitting}
                      onChange={(e) => {
                        const list = Array.from(e.target.files ?? []);
                        setBugImages(list.slice(0, 5));
                      }}
                      className="mt-1 block w-full rounded-lg border border-zinc-800 bg-black/30 px-3 py-2 text-xs text-zinc-300 file:mr-3 file:rounded-md file:border-0 file:bg-zinc-900 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-zinc-200 hover:file:bg-zinc-800 disabled:opacity-60"
                    />
                    {bugImages.length ? (
                      <p className="mt-1 text-[11px] text-zinc-500">
                        {bugImages.length} image{bugImages.length === 1 ? "" : "s"} selected
                      </p>
                    ) : null}
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setBugOpen(false)}
                      disabled={bugSubmitting}
                      className="rounded-md border border-zinc-800 bg-zinc-900/60 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-900 disabled:opacity-60"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        if (bugSubmitting) return;
                        const t = bugTitle.trim();
                        const d = bugDescription.trim();
                        if (!t || !d) {
                          addNotification({
                            id: crypto.randomUUID(),
                            text: "Please add a title and description.",
                            type: "call",
                            createdAt: Date.now(),
                            priority: "low",
                          });
                          return;
                        }
                        setBugSubmitting(true);
                        try {
                          const screenshotUrls: string[] = [];
                          for (const file of bugImages.slice(0, 5)) {
                            const ct = file.type || "image/png";
                            const uRes = await fetch("/api/report/bug/upload-url", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              credentials: "same-origin",
                              body: JSON.stringify({
                                filename: file.name || "screenshot.png",
                                contentType: ct,
                              }),
                            });
                            const uJson = await uRes.json().catch(() => ({}));
                            if (!uRes.ok || !uJson || uJson.success !== true || typeof uJson.uploadUrl !== "string") {
                              throw new Error(typeof uJson?.error === "string" ? uJson.error : "Upload init failed");
                            }
                            const uploadUrl = String(uJson.uploadUrl);
                            const publicUrl = typeof uJson.publicUrl === "string" ? uJson.publicUrl : null;

                            const put = await fetch(uploadUrl, {
                              method: "PUT",
                              headers: { "Content-Type": ct },
                              body: file,
                            });
                            if (!put.ok) {
                              const txt = await put.text().catch(() => "");
                              throw new Error(`Upload failed (${put.status}) ${txt}`.trim());
                            }
                            if (publicUrl) screenshotUrls.push(publicUrl);
                          }

                          const res = await fetch("/api/report/bug", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            credentials: "same-origin",
                            body: JSON.stringify({
                              title: t,
                              description: d,
                              reproductionSteps: bugSteps.trim() || null,
                              pageUrl: typeof window !== "undefined" ? window.location.href : null,
                              screenshotUrls,
                            }),
                          });
                          const json = await res.json().catch(() => ({}));
                          if (!res.ok || !json || json.success !== true) {
                            addNotification({
                              id: crypto.randomUUID(),
                              text: typeof (json as any).error === "string" ? (json as any).error : "Bug report failed.",
                              type: "call",
                              createdAt: Date.now(),
                              priority: "low",
                            });
                            return;
                          }
                          addNotification({
                            id: crypto.randomUUID(),
                            text: "Bug submitted. Thank you.",
                            type: "call",
                            createdAt: Date.now(),
                            priority: "medium",
                          });
                          setBugOpen(false);
                          setBugTitle("");
                          setBugDescription("");
                          setBugSteps("");
                          setBugImages([]);
                        } catch {
                          addNotification({
                            id: crypto.randomUUID(),
                            text: "Bug report failed.",
                            type: "call",
                            createdAt: Date.now(),
                            priority: "low",
                          });
                        } finally {
                          setBugSubmitting(false);
                        }
                      }}
                      disabled={bugSubmitting}
                      className="rounded-md bg-gradient-to-r from-emerald-500 to-cyan-500 px-3 py-1.5 text-xs font-semibold text-black shadow-lg shadow-black/30 transition hover:from-emerald-400 hover:to-cyan-400 disabled:opacity-60"
                    >
                      {bugSubmitting ? "Submitting…" : "Submit"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {featureOpen ? (
            <div
              className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-black/60 px-4 py-10"
              role="dialog"
              aria-modal="true"
              aria-label="Submit feature request"
              onMouseDown={(e) => {
                if (e.target === e.currentTarget) setFeatureOpen(false);
              }}
            >
              <div className="mt-10 w-full max-w-xl rounded-xl border border-zinc-800/80 bg-zinc-950/90 p-4 shadow-xl shadow-black/50 backdrop-blur">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-zinc-100">Feature request</h3>
                    <p className="mt-1 text-xs text-zinc-500">One clear idea per submission works best.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFeatureOpen(false)}
                    className="rounded-md border border-zinc-800 bg-zinc-900/60 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-900"
                    aria-label="Close"
                  >
                    Esc
                  </button>
                </div>

                <div className="mt-4 space-y-3">
                  <div>
                    <label className="text-xs font-medium text-zinc-400">Title</label>
                    <input
                      value={featureTitle}
                      onChange={(e) => setFeatureTitle(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-zinc-800 bg-black/30 px-3 py-2 text-sm text-zinc-100 outline-none ring-violet-500/20 focus:ring-2"
                      placeholder="e.g. Filter bot calls by caller"
                      disabled={featureSubmitting}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-zinc-400">Describe the feature</label>
                    <textarea
                      value={featureDescription}
                      onChange={(e) => setFeatureDescription(e.target.value)}
                      rows={4}
                      className="mt-1 w-full resize-none rounded-lg border border-zinc-800 bg-black/30 px-3 py-2 text-sm text-zinc-100 outline-none ring-violet-500/20 focus:ring-2"
                      placeholder="What should it do? Where in the app would it live?"
                      disabled={featureSubmitting}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-zinc-400">Why / use case (optional)</label>
                    <textarea
                      value={featureUseCase}
                      onChange={(e) => setFeatureUseCase(e.target.value)}
                      rows={3}
                      className="mt-1 w-full resize-none rounded-lg border border-zinc-800 bg-black/30 px-3 py-2 text-sm text-zinc-100 outline-none ring-violet-500/20 focus:ring-2"
                      placeholder="How would this help your workflow?"
                      disabled={featureSubmitting}
                    />
                  </div>

                  <div>
                    <label className="text-xs font-medium text-zinc-400">
                      Reference images (optional, up to 5)
                    </label>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      disabled={featureSubmitting}
                      onChange={(e) => {
                        const list = Array.from(e.target.files ?? []);
                        setFeatureImages(list.slice(0, 5));
                      }}
                      className="mt-1 block w-full rounded-lg border border-zinc-800 bg-black/30 px-3 py-2 text-xs text-zinc-300 file:mr-3 file:rounded-md file:border-0 file:bg-zinc-900 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-zinc-200 hover:file:bg-zinc-800 disabled:opacity-60"
                    />
                    {featureImages.length ? (
                      <p className="mt-1 text-[11px] text-zinc-500">
                        {featureImages.length} image{featureImages.length === 1 ? "" : "s"} selected
                      </p>
                    ) : null}
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setFeatureOpen(false)}
                      disabled={featureSubmitting}
                      className="rounded-md border border-zinc-800 bg-zinc-900/60 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-900 disabled:opacity-60"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        if (featureSubmitting) return;
                        const t = featureTitle.trim();
                        const d = featureDescription.trim();
                        if (!t || !d) {
                          addNotification({
                            id: crypto.randomUUID(),
                            text: "Please add a title and description.",
                            type: "call",
                            createdAt: Date.now(),
                            priority: "low",
                          });
                          return;
                        }
                        setFeatureSubmitting(true);
                        try {
                          const screenshotUrls: string[] = [];
                          for (const file of featureImages.slice(0, 5)) {
                            const ct = file.type || "image/png";
                            const uRes = await fetch("/api/report/feature/upload-url", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              credentials: "same-origin",
                              body: JSON.stringify({
                                filename: file.name || "mockup.png",
                                contentType: ct,
                              }),
                            });
                            const uJson = await uRes.json().catch(() => ({}));
                            if (!uRes.ok || !uJson || uJson.success !== true || typeof uJson.uploadUrl !== "string") {
                              throw new Error(typeof uJson?.error === "string" ? uJson.error : "Upload init failed");
                            }
                            const uploadUrl = String(uJson.uploadUrl);
                            const publicUrl = typeof uJson.publicUrl === "string" ? uJson.publicUrl : null;

                            const put = await fetch(uploadUrl, {
                              method: "PUT",
                              headers: { "Content-Type": ct },
                              body: file,
                            });
                            if (!put.ok) {
                              const txt = await put.text().catch(() => "");
                              throw new Error(`Upload failed (${put.status}) ${txt}`.trim());
                            }
                            if (publicUrl) screenshotUrls.push(publicUrl);
                          }

                          const res = await fetch("/api/report/feature", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            credentials: "same-origin",
                            body: JSON.stringify({
                              title: t,
                              description: d,
                              useCase: featureUseCase.trim() || null,
                              pageUrl: typeof window !== "undefined" ? window.location.href : null,
                              screenshotUrls,
                            }),
                          });
                          const json = await res.json().catch(() => ({}));
                          if (!res.ok || !json || json.success !== true) {
                            addNotification({
                              id: crypto.randomUUID(),
                              text:
                                typeof (json as { error?: string }).error === "string"
                                  ? (json as { error: string }).error
                                  : "Feature request failed.",
                              type: "call",
                              createdAt: Date.now(),
                              priority: "low",
                            });
                            return;
                          }
                          addNotification({
                            id: crypto.randomUUID(),
                            text: "Feature request submitted. Thank you.",
                            type: "call",
                            createdAt: Date.now(),
                            priority: "medium",
                          });
                          setFeatureOpen(false);
                          setFeatureTitle("");
                          setFeatureDescription("");
                          setFeatureUseCase("");
                          setFeatureImages([]);
                        } catch {
                          addNotification({
                            id: crypto.randomUUID(),
                            text: "Feature request failed.",
                            type: "call",
                            createdAt: Date.now(),
                            priority: "low",
                          });
                        } finally {
                          setFeatureSubmitting(false);
                        }
                      }}
                      disabled={featureSubmitting}
                      className="rounded-md bg-gradient-to-r from-violet-500 to-fuchsia-600 px-3 py-1.5 text-xs font-semibold text-white shadow-lg shadow-black/30 transition hover:from-violet-400 hover:to-fuchsia-500 disabled:opacity-60"
                    >
                      {featureSubmitting ? "Submitting…" : "Submit"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

export default function HelpPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto w-full max-w-6xl px-4 py-6 text-sm text-zinc-500">Loading Help…</div>
      }
    >
      <HelpPageContent />
    </Suspense>
  );
}
