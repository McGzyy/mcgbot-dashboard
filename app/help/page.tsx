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
import { terminalUi } from "@/lib/terminalDesignTokens";
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
      const fn = w?.__mcgbotTutorial?.sectionsForTrack;
      const sections = typeof fn === "function" ? fn("user") : [];
      if (Array.isArray(sections)) {
        setTutorialSections(sections as TutorialSection[]);
      }
    } catch {}
  }, [status, tier]);

  const helpCard =
    "rounded-2xl border border-zinc-800/90 bg-gradient-to-br from-zinc-900/85 via-zinc-950/75 to-zinc-950/90 p-5 shadow-[inset_0_1px_0_0_rgba(63,63,70,0.26),0_28px_90px_-52px_rgba(0,0,0,0.85)] shadow-sm shadow-black/25 backdrop-blur-sm";

  return (
    <div className="relative mx-auto w-full max-w-6xl px-0 py-8 sm:py-10">
      <div
        className="pointer-events-none absolute inset-x-0 -top-32 h-72 bg-[radial-gradient(ellipse_70%_55%_at_50%_0%,rgba(57,255,20,0.11),transparent_65%)] sm:-top-40 sm:h-96"
        aria-hidden
      />
      <div className="relative space-y-8 sm:space-y-10">
      <header
        className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"
        data-tutorial="help.header"
      >
        <div className="max-w-2xl">
          <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-zinc-500">
            Support hub
          </p>
          <h1 className="mt-1.5 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            Help
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-zinc-400">
            Role docs, FAQ, and quick answers — refined over time as McGBot grows.
          </p>
          {status === "authenticated" ? (
            <p className="mt-3 text-xs leading-relaxed text-zinc-500">
              <span className="font-semibold text-zinc-400">Shortcuts</span>
              {" · "}
              <kbd className="rounded-md border border-zinc-600/60 bg-zinc-950/80 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-zinc-300 shadow-[inset_0_1px_0_0_rgba(63,63,70,0.28)]">
                ?
              </kbd>{" "}
              <span className="text-zinc-500">
                (Shift + /) opens Help when focus isn’t in a field. Use
              </span>{" "}
              <kbd className="rounded-md border border-zinc-600/60 bg-zinc-950/80 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-zinc-300 shadow-[inset_0_1px_0_0_rgba(63,63,70,0.28)]">
                /
              </kbd>{" "}
              <span className="text-zinc-500">for the CA Analyzer.</span>
            </p>
          ) : null}
        </div>
        <Link
          href="/"
          className="inline-flex shrink-0 items-center justify-center gap-2 self-start rounded-full border border-zinc-800/70 bg-zinc-900/30 px-4 py-2.5 text-xs font-semibold text-zinc-200 shadow-[inset_0_1px_0_0_rgba(63,63,70,0.28)] transition hover:border-[color:var(--accent)]/35 hover:bg-zinc-800/45 hover:text-white sm:self-auto"
        >
          <span className="text-[color:var(--accent)]" aria-hidden>
            ←
          </span>
          Dashboard
        </Link>
      </header>

      {status === "loading" ? (
        <p className="text-sm text-zinc-500">Loading…</p>
      ) : status === "unauthenticated" ? (
        <div
          className={`${helpCard} mx-auto max-w-md text-center`}
        >
          <p className="text-sm leading-relaxed text-zinc-300">
            Sign in with Discord to open Help, tutorials, and role-specific docs.
          </p>
          <Link
            href="/"
            className="mt-4 inline-flex items-center justify-center rounded-full bg-[color:var(--accent)] px-5 py-2.5 text-sm font-semibold text-black shadow-lg shadow-black/30 transition hover:bg-green-400"
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
          <div className="grid gap-4 lg:grid-cols-3">
            <section
              aria-label="Tutorial mode"
              data-tutorial="help.tutorialPanel"
              className={`${helpCard} lg:col-span-2 lg:row-span-2`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-zinc-500">Onboarding</p>
                  <h2 className="mt-1.5 text-base font-semibold tracking-tight text-white">Tutorial mode</h2>
                  <p className="mt-2 text-xs leading-relaxed text-zinc-400">
                    One dashboard walkthrough for everyone. Staff-only areas get a short pointer when your account
                    can see them — full mod/admin workflows are covered in onboarding.
                  </p>
                </div>
                <div className="flex flex-wrap justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const w = window as any;
                      if (typeof w?.__mcgbotTutorial?.start === "function") {
                        w.__mcgbotTutorial.start();
                        addNotification({
                          id: crypto.randomUUID(),
                          text: "Dashboard tour started.",
                          type: "call",
                          createdAt: Date.now(),
                          priority: "low",
                          silent: true,
                        });
                      }
                    }}
                    className="rounded-full border border-[color:var(--accent)]/35 bg-[color:var(--accent)]/10 px-3 py-1.5 text-[11px] font-semibold text-[color:var(--accent)] shadow-[inset_0_1px_0_0_rgba(63,63,70,0.28)] transition hover:border-[color:var(--accent)]/55 hover:bg-[color:var(--accent)]/16"
                  >
                    Start tour
                  </button>
                </div>
              </div>

              <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
                <div className="flex min-w-0 flex-[2] flex-col gap-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-500">Jump to</label>
                  <select
                    value={tutorialSectionId}
                    onChange={(e) => setTutorialSectionId(e.target.value)}
                    className="w-full rounded-xl border border-zinc-700/50 bg-black/35 px-3 py-2.5 text-xs text-zinc-100 outline-none transition focus:border-[color:var(--accent)]/40 focus:ring-2 focus:ring-[color:var(--accent)]/15"
                  >
                    <option value="">Choose a section…</option>
                    {tutorialSections.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const id = tutorialSectionId.trim();
                    if (!id) return;
                    const w = window as any;
                    if (typeof w?.__mcgbotTutorial?.start === "function") {
                      w.__mcgbotTutorial.start({ sectionId: id });
                    }
                  }}
                  disabled={!tutorialSectionId.trim()}
                  className="rounded-xl border border-zinc-600/50 bg-zinc-900/60 px-4 py-2.5 text-xs font-semibold text-zinc-100 transition hover:border-zinc-500 hover:bg-zinc-800/50 hover:text-white disabled:opacity-45 sm:mb-0.5"
                >
                  Go
                </button>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-zinc-800/60 pt-4 text-[11px] font-semibold text-zinc-500">
                <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-600">Reset</span>
                <button
                  type="button"
                  className="text-zinc-400 underline-offset-2 transition hover:text-[color:var(--accent)] hover:underline"
                  onClick={async () => {
                    const w = window as any;
                    if (typeof w?.__mcgbotTutorial?.reset === "function") {
                      await w.__mcgbotTutorial.reset("user");
                      addNotification({
                        id: crypto.randomUUID(),
                        text: "Tour progress reset — use Start tour here when you want the walkthrough again (it won’t open automatically on login).",
                        type: "call",
                        createdAt: Date.now(),
                        priority: "low",
                        silent: true,
                      });
                    }
                  }}
                >
                  Reset tour progress
                </button>
              </div>
            </section>
            <section
              aria-label="Report a bug"
              className={`${helpCard} lg:col-start-3`}
              data-tutorial="help.reportBug"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-zinc-500">Support</p>
                  <h2 className="mt-1.5 text-base font-semibold tracking-tight text-white">Report a bug</h2>
                  <p className="mt-2 text-xs leading-relaxed text-zinc-400">
                    Found something broken? Admin will review and you’ll get a bell notification when it’s closed.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setBugOpen(true)}
                  className="rounded-full border border-zinc-700/55 bg-zinc-900/40 px-3.5 py-2 text-xs font-semibold text-zinc-100 shadow-[inset_0_1px_0_0_rgba(63,63,70,0.28)] transition hover:border-zinc-500/50 hover:bg-zinc-800/50"
                >
                  Submit bug
                </button>
              </div>
            </section>
            <section
              aria-label="Request a feature"
              className={`${helpCard} lg:col-start-3`}
              data-tutorial="help.featureRequest"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-zinc-500">Feedback</p>
                  <h2 className="mt-1.5 text-base font-semibold tracking-tight text-white">Feature request</h2>
                  <p className="mt-2 text-xs leading-relaxed text-zinc-400">
                    Have an idea for the dashboard or bot? Tell us what you want and why it matters to you.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setFeatureOpen(true)}
                  className="rounded-full border border-violet-400/35 bg-gradient-to-r from-violet-600/25 to-fuchsia-600/20 px-3.5 py-2 text-xs font-semibold text-violet-100 shadow-[inset_0_1px_0_0_rgba(63,63,70,0.32)] transition hover:border-violet-300/45 hover:from-violet-500/30 hover:to-fuchsia-500/25"
                >
                  Submit idea
                </button>
              </div>
            </section>
          </div>

          <section aria-label="Documentation for your role" data-tutorial="help.docs">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-zinc-500">
                  Docs
                </span>
                <span className="hidden h-4 w-px bg-zinc-700/60 sm:block" aria-hidden />
                <span
                  className={`rounded-full border px-3 py-1 text-[11px] font-semibold shadow-[inset_0_1px_0_0_rgba(63,63,70,0.28)] ${
                    tier === "admin"
                      ? "border-amber-400/35 bg-amber-500/15 text-amber-100"
                      : tier === "mod"
                        ? "border-sky-400/35 bg-sky-500/12 text-sky-100"
                        : "border-zinc-600/50 bg-zinc-800/50 text-zinc-200"
                  }`}
                >
                  {tier === "admin" ? "Admin" : tier === "mod" ? "Moderator" : "Caller"}
                </span>
              </div>
              <p className="max-w-md text-right text-[11px] leading-relaxed text-zinc-500 sm:text-xs">
                Guides match your role — deeper runbooks unlock for staff.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-5">
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
                    "shadow-[inset_0_1px_0_0_rgba(63,63,70,0.2)]",
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

          <div className="relative py-2" aria-hidden>
            <div className="h-px w-full bg-gradient-to-r from-transparent via-zinc-600/35 to-transparent" />
          </div>

          <section
            className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(280px,320px)] lg:items-start"
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
              className={terminalUi.modalBackdropZ100}
              role="dialog"
              aria-modal="true"
              aria-label="Submit bug report"
              onMouseDown={(e) => {
                if (e.target === e.currentTarget) setBugOpen(false);
              }}
            >
              <div className={terminalUi.modalPanelXl}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-base font-semibold tracking-tight text-white">Submit bug</h3>
                    <p className="mt-1 text-xs text-zinc-500">Short and specific is best.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setBugOpen(false)}
                    className={terminalUi.modalCloseIconBtn}
                    aria-label="Close"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden>
                      <path d="M18 6 6 18M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <div className="mt-4 space-y-3">
                  <div>
                    <label className="text-xs font-medium text-zinc-400">Title</label>
                    <input
                      value={bugTitle}
                      onChange={(e) => setBugTitle(e.target.value)}
                      className={`mt-1 ${terminalUi.formInput} text-zinc-100 ring-emerald-500/20`}
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
                      className={`mt-1 w-full resize-none ${terminalUi.formInput} text-zinc-100 ring-emerald-500/20`}
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
                      className={`mt-1 w-full resize-none ${terminalUi.formInput} text-zinc-100 ring-emerald-500/20`}
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
                      className="mt-1 block w-full rounded-lg border border-zinc-800/90 bg-[color:var(--mcg-page)] px-3 py-2 text-xs text-zinc-300 outline-none ring-emerald-500/20 focus:ring-2 file:mr-3 file:rounded-md file:border-0 file:bg-zinc-900 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-zinc-200 hover:file:bg-zinc-800 disabled:opacity-60"
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
                      className={terminalUi.secondaryButtonSm}
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
              className={terminalUi.modalBackdropZ100}
              role="dialog"
              aria-modal="true"
              aria-label="Submit feature request"
              onMouseDown={(e) => {
                if (e.target === e.currentTarget) setFeatureOpen(false);
              }}
            >
              <div className={terminalUi.modalPanelXl}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-base font-semibold tracking-tight text-white">Feature request</h3>
                    <p className="mt-1 text-xs text-zinc-500">One clear idea per submission works best.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFeatureOpen(false)}
                    className={terminalUi.modalCloseIconBtn}
                    aria-label="Close"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden>
                      <path d="M18 6 6 18M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <div className="mt-4 space-y-3">
                  <div>
                    <label className="text-xs font-medium text-zinc-400">Title</label>
                    <input
                      value={featureTitle}
                      onChange={(e) => setFeatureTitle(e.target.value)}
                      className={`mt-1 ${terminalUi.formInput} text-zinc-100 ring-violet-500/20`}
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
                      className={`mt-1 w-full resize-none ${terminalUi.formInput} text-zinc-100 ring-violet-500/20`}
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
                      className={`mt-1 w-full resize-none ${terminalUi.formInput} text-zinc-100 ring-violet-500/20`}
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
                      className="mt-1 block w-full rounded-lg border border-zinc-800/90 bg-[color:var(--mcg-page)] px-3 py-2 text-xs text-zinc-300 outline-none ring-violet-500/20 focus:ring-2 file:mr-3 file:rounded-md file:border-0 file:bg-zinc-900 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-zinc-200 hover:file:bg-zinc-800 disabled:opacity-60"
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
                      className={terminalUi.secondaryButtonSm}
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
    </div>
  );
}

export default function HelpPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto flex min-h-[40vh] w-full max-w-6xl items-center justify-center px-4 py-16 text-sm text-zinc-500">
          Loading Help…
        </div>
      }
    >
      <HelpPageContent />
    </Suspense>
  );
}
