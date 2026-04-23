"use client";

import type { HelpTier } from "@/lib/helpRole";
import {
  getTutorialSections,
  getTutorialSteps,
  normalizeTutorialTier,
  type TutorialSection,
  type TutorialStep,
} from "@/lib/tutorial/tutorialRegistry";
import { Joyride, ACTIONS, EVENTS, STATUS } from "react-joyride";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

export function TutorialProvider({ children }: { children: ReactNode }) {
  const JoyrideAny = Joyride as any;
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

  const viewerTier = useMemo(() => normalizeTutorialTier(helpTier), [helpTier]);
  const sections = useMemo<TutorialSection[]>(() => getTutorialSections(viewerTier), [viewerTier]);
  const steps = useMemo<TutorialStep[]>(() => getTutorialSteps(viewerTier), [viewerTier]);

  const pendingRouteRef = useRef<string | null>(null);

  const loadHelpTier = useCallback(async () => {
    try {
      const res = await fetch("/api/me/help-role", { credentials: "same-origin" });
      const json = (await res.json().catch(() => ({}))) as { role?: HelpTier };
      if (res.ok && (json.role === "user" || json.role === "mod" || json.role === "admin")) {
        setHelpTier(json.role);
      }
    } catch {}
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

  // Expose global entry points (Help page will call these).
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

  // Auto-run on first successful login.
  useEffect(() => {
    if (status !== "authenticated" || !session?.user?.id?.trim()) return;
    void loadHelpTier();
    void loadTutorialState();
  }, [loadHelpTier, loadTutorialState, session?.user?.id, status]);

  useEffect(() => {
    if (status !== "authenticated") return;
    if (stateLoading) return;
    if (tourOpen) return;
    if (seenAt) return;
    if (steps.length === 0) return;
    // first successful login => auto start from beginning
    setStepIndex(0);
    setTourOpen(true);
    setSeenAt(new Date().toISOString());
    void patchTutorial({ action: "seen" });
  }, [patchTutorial, seenAt, stateLoading, status, steps.length, tourOpen]);

  // If we navigated for a step, wait until target exists before continuing.
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

  const handleJoyride = useCallback(
    (data: any) => {
      const { action, index, status: st, type } = data;
      const curr = steps[index];

      if (type === EVENTS.STEP_AFTER || type === EVENTS.TARGET_NOT_FOUND) {
        const delta = action === ACTIONS.PREV ? -1 : 1;
        const next = Math.max(0, Math.min(steps.length - 1, index + delta));
        const nextStep = steps[next];
        if (nextStep && nextStep.route && nextStep.route !== pathname) {
          pendingRouteRef.current = nextStep.route;
          router.push(nextStep.route);
        }
        setStepIndex(next);
      }

      if (st === STATUS.SKIPPED || st === STATUS.FINISHED) {
        setTourOpen(false);
      }

      // Mark section completed when user moves past the last step in that section.
      if (type === EVENTS.STEP_AFTER && curr) {
        const currSection = curr.section;
        const hasMoreInSection = steps.some(
          (s, i) => i > index && s.section === currSection
        );
        if (!hasMoreInSection && !completedSections.includes(currSection)) {
          const nextCompleted = [...completedSections, currSection];
          setCompletedSections(nextCompleted);
          void patchTutorial({ action: "completeSection", sectionId: currSection });
        }
      }
    },
    [completedSections, pathname, patchTutorial, router, steps]
  );

  return (
    <>
      {children}
      {status === "authenticated" ? (
        <JoyrideAny
          steps={steps.map((s) => ({
            target: s.target,
            title: s.title,
            content: s.content,
            disableBeacon: true,
            placement: "auto",
          }))}
          run={tourOpen}
          continuous
          scrollToFirstStep
          showSkipButton
          showProgress
          stepIndex={stepIndex}
          callback={handleJoyride}
          styles={{ options: { zIndex: 10050 } }}
        />
      ) : null}
    </>
  );
}

