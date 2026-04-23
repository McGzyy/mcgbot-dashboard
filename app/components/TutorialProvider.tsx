"use client";



import type { HelpTier } from "@/lib/helpRole";

import {

  getTutorialSections,

  getTutorialSteps,

  normalizeTutorialTier,

  type TutorialSection,

  type TutorialStep,

  type TutorialStepContext,

} from "@/lib/tutorial/tutorialRegistry";

import { userProfileHref } from "@/lib/userProfileHref";

import { Joyride, ACTIONS, EVENTS, STATUS, type EventHandler } from "react-joyride";

import { usePathname, useRouter } from "next/navigation";

import { useSession } from "next-auth/react";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";



function tierFromSessionUser(user: unknown): HelpTier | null {

  if (!user || typeof user !== "object") return null;

  const t = (user as { helpTier?: unknown }).helpTier;

  return t === "admin" || t === "mod" || t === "user" ? t : null;

}



export function TutorialProvider({ children }: { children: ReactNode }) {

  const { data: session, status } = useSession();

  const router = useRouter();

  const pathname = usePathname() ?? "/";



  const [helpTier, setHelpTier] = useState<HelpTier>("user");

  const [tourOpen, setTourOpen] = useState(false);

  const [stepIndex, setStepIndex] = useState(0);

  const [completedSections, setCompletedSections] = useState<string[]>([]);

  const [seenAt, setSeenAt] = useState<string | null>(null);

  const [latestVersion, setLatestVersion] = useState<number>(1);

  const [stateLoading, setStateLoading] = useState(false);

  const [helpRoleLoaded, setHelpRoleLoaded] = useState(false);



  const sessionTier = useMemo(() => tierFromSessionUser(session?.user ?? null), [session?.user]);



  const viewerTier = useMemo(() => {

    if (sessionTier) return normalizeTutorialTier(sessionTier);

    return normalizeTutorialTier(helpTier);

  }, [sessionTier, helpTier]);



  const stepCtx = useMemo<TutorialStepContext>(() => {

    const id = session?.user?.id?.trim();

    if (!id) return {};

    return {

      ownProfilePath: userProfileHref({

        discordId: id,

        displayName: session?.user?.name,

      }),

    };

  }, [session?.user?.id, session?.user?.name]);



  const sections = useMemo<TutorialSection[]>(() => getTutorialSections(viewerTier, stepCtx), [viewerTier, stepCtx]);

  const steps = useMemo<TutorialStep[]>(() => getTutorialSteps(viewerTier, stepCtx), [viewerTier, stepCtx]);



  const pendingRouteRef = useRef<string | null>(null);

  const openAccountMenu = useCallback(async () => {
    const wrap = document.querySelector('[data-tutorial="nav.userMenu"]');
    const btn = wrap?.querySelector('button[aria-haspopup="menu"]');
    if (!(btn instanceof HTMLButtonElement)) return;
    if (btn.getAttribute("aria-expanded") === "true") return;
    btn.click();
    await new Promise((r) => setTimeout(r, 160));
  }, []);

  const closeAccountMenu = useCallback(async () => {
    const wrap = document.querySelector('[data-tutorial="nav.userMenu"]');
    const btn = wrap?.querySelector('button[aria-haspopup="menu"]');
    if (!(btn instanceof HTMLButtonElement)) return;
    if (btn.getAttribute("aria-expanded") !== "true") return;
    btn.click();
    await new Promise((r) => setTimeout(r, 90));
  }, []);



  const loadHelpTier = useCallback(async () => {

    try {

      const res = await fetch("/api/me/help-role", { credentials: "same-origin" });

      const json = (await res.json().catch(() => ({}))) as { role?: HelpTier };

      if (res.ok && (json.role === "user" || json.role === "mod" || json.role === "admin")) {

        setHelpTier(json.role);

      }

    } catch {

    } finally {

      setHelpRoleLoaded(true);

    }

  }, []);



  const loadTutorialState = useCallback(async () => {

    setStateLoading(true);

    try {

      const res = await fetch("/api/me/tutorial", { credentials: "same-origin" });

      const json = (await res.json().catch(() => ({}))) as any;

      if (!res.ok || json.success !== true) return;



      const latest = Number(json.latestVersion);

      const ver = Number(json.version);

      if (Number.isFinite(latest) && Number.isFinite(ver) && ver < latest) {

        await fetch("/api/me/tutorial", {

          method: "PATCH",

          credentials: "same-origin",

          headers: { "content-type": "application/json" },

          body: JSON.stringify({ action: "reset" }),

        });

        setSeenAt(null);

        setCompletedSections([]);

        if (Number.isFinite(latest) && latest > 0) setLatestVersion(latest);

        return;

      }



      setSeenAt(typeof json.seenAt === "string" ? json.seenAt : json.seenAt ?? null);

      setCompletedSections(Array.isArray(json.completedSections) ? json.completedSections : []);

      const lv = Number(json.latestVersion);

      if (Number.isFinite(lv) && lv > 0) setLatestVersion(lv);

    } finally {

      setStateLoading(false);

    }

  }, []);



  const patchTutorial = useCallback(async (body: Record<string, unknown>) => {

    try {

      await fetch("/api/me/tutorial", {

        method: "PATCH",

        credentials: "same-origin",

        headers: { "content-type": "application/json" },

        body: JSON.stringify(body),

      });

    } catch {}

  }, []);



  const startTour = useCallback(

    async (opts?: { sectionId?: string }) => {

      const sectionId = opts?.sectionId?.trim() ?? "";

      let idx = 0;

      if (sectionId) {

        const found = steps.findIndex((s) => s.section === sectionId);

        if (found >= 0) idx = found;

      }

      setStepIndex(idx);

      setTourOpen(true);

      if (!seenAt) {

        setSeenAt(new Date().toISOString());

        void patchTutorial({ action: "seen" });

      }

    },

    [patchTutorial, seenAt, steps]

  );



  useEffect(() => {

    const w = window as any;

    w.__mcgbotTutorial = {

      start: (sectionId?: string) => void startTour({ sectionId }),

      reset: async () => {

        await patchTutorial({ action: "reset" });

        setSeenAt(null);

        setCompletedSections([]);

        setStepIndex(0);

      },

      sections: () => sections,

    };

    return () => {

      if ((window as any).__mcgbotTutorial) delete (window as any).__mcgbotTutorial;

    };

  }, [patchTutorial, sections, startTour]);



  useEffect(() => {

    if (status !== "authenticated" || !session?.user?.id?.trim()) return;

    void loadHelpTier();

    void loadTutorialState();

  }, [loadHelpTier, loadTutorialState, session?.user?.id, status]);



  useEffect(() => {

    if (status !== "authenticated") {

      setHelpRoleLoaded(false);

    }

  }, [status]);



  useEffect(() => {

    if (status !== "authenticated") return;

    if (stateLoading) return;

    if (!helpRoleLoaded && !sessionTier) return;

    if (tourOpen) return;

    if (seenAt) return;

    if (steps.length === 0) return;

    setStepIndex(0);

    setTourOpen(true);

    setSeenAt(new Date().toISOString());

    void patchTutorial({ action: "seen" });

  }, [

    helpRoleLoaded,

    patchTutorial,

    seenAt,

    sessionTier,

    stateLoading,

    status,

    steps.length,

    tourOpen,

  ]);



  /** Keep the URL aligned with the active step so targets exist before Joyride measures. */

  useEffect(() => {

    if (!tourOpen) return;

    const r = steps[stepIndex]?.route;

    if (!r || r === pathname) return;

    pendingRouteRef.current = r;

    router.push(r);

  }, [tourOpen, stepIndex, pathname, router, steps]);



  useEffect(() => {

    const pending = pendingRouteRef.current;

    if (!pending || pending !== pathname) return;

    const target = steps[stepIndex]?.target;

    if (!tourOpen || !target) return;



    let tries = 0;

    const t = window.setInterval(() => {

      tries += 1;

      if (document.querySelector(target)) {

        pendingRouteRef.current = null;

        window.clearInterval(t);

        return;

      }

      if (tries > 30) {

        pendingRouteRef.current = null;

        window.clearInterval(t);

      }

    }, 120);



    return () => window.clearInterval(t);

  }, [pathname, stepIndex, steps, tourOpen]);



  /** Nudge targets into view (complements Joyride scroll; helps tall pages and sticky chrome). */

  useEffect(() => {

    if (!tourOpen) return;

    const sel = steps[stepIndex]?.target;

    if (!sel) return;

    const id = window.setTimeout(() => {

      const el = document.querySelector(sel);

      if (el instanceof HTMLElement) {

        el.scrollIntoView({ block: "center", behavior: "smooth", inline: "nearest" });

      }

    }, 200);

    return () => window.clearTimeout(id);

  }, [tourOpen, stepIndex, pathname, steps]);



  const onJoyrideEvent = useCallback<EventHandler>(

    (data) => {

      const { type, action, index: eventIndex, status: st } = data;

      const index = typeof eventIndex === "number" ? eventIndex : 0;



      if (type === EVENTS.TOUR_END) {

        setTourOpen(false);

        return;

      }

      if (st === STATUS.FINISHED || st === STATUS.SKIPPED) {

        setTourOpen(false);

        return;

      }



      if (type === EVENTS.TARGET_NOT_FOUND) {

        const next = Math.min(steps.length - 1, index + 1);

        setStepIndex(next);

        return;

      }



      if (type !== EVENTS.STEP_AFTER) return;



      if (action === ACTIONS.CLOSE || action === ACTIONS.SKIP) {

        setTourOpen(false);

        return;

      }



      const curr = steps[index];



      if (action === ACTIONS.PREV) {

        setStepIndex((i) => Math.max(0, i - 1));

        return;

      }



      if (curr) {

        const currSection = curr.section;

        const hasMoreInSection = steps.some((s, i) => i > index && s.section === currSection);

        if (!hasMoreInSection) {

          setCompletedSections((prev) => {

            if (prev.includes(currSection)) return prev;

            void patchTutorial({ action: "completeSection", sectionId: currSection });

            return [...prev, currSection];

          });

        }

      }



      if (index >= steps.length - 1) {

        setTourOpen(false);

        return;

      }



      setStepIndex(index + 1);

    },

    [patchTutorial, steps]

  );



  const joyrideSteps = useMemo(() => {

    return steps.map((s) => {

      const row: Record<string, unknown> = {

        target: s.target,

        title: s.title,

        content: s.content,

        placement: s.placement ?? "auto",

        skipBeacon: true,

      };

      if (typeof s.scrollOffset === "number") row.scrollOffset = s.scrollOffset;

      if (s.openAccountMenu || s.closeAccountMenu) {

        row.before = async () => {

          if (s.openAccountMenu) await openAccountMenu();

          if (s.closeAccountMenu) await closeAccountMenu();

        };

      }

      return row;

    });

  }, [closeAccountMenu, openAccountMenu, steps]);



  return (

    <>

      {children}

      {status === "authenticated" ? (

        <Joyride

          steps={joyrideSteps as any}

          run={tourOpen}

          continuous

          scrollToFirstStep

          stepIndex={stepIndex}

          onEvent={onJoyrideEvent}

          options={{

            zIndex: 10050,

            showProgress: true,

            buttons: ["back", "close", "primary", "skip"],

            scrollOffset: 112,

            scrollDuration: 480,

          }}

        />

      ) : null}

    </>

  );

}


