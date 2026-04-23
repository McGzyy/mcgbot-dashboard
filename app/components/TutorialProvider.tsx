"use client";

import type { HelpTier } from "@/lib/helpRole";
import {
  availableTutorialTracks,
  getTutorialSections,
  getTutorialSteps,
  type TutorialSection,
  type TutorialStep,
  type TutorialStepContext,
} from "@/lib/tutorial/tutorialRegistry";
import type { TutorialTrackId } from "@/lib/tutorial/tutorialVersions";
import { TUTORIAL_LATEST_VERSIONS } from "@/lib/tutorial/tutorialVersions";
import { userProfileHref } from "@/lib/userProfileHref";
import { Joyride, ACTIONS, EVENTS, STATUS, type EventHandler } from "react-joyride";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";

type TrackState = {
  seenAt: string | null;
  version: number;
  completedSections: string[];
};

function tierFromSessionUser(user: unknown): HelpTier | null {
  if (!user || typeof user !== "object") return null;
  const t = (user as { helpTier?: unknown }).helpTier;
  return t === "admin" || t === "mod" || t === "user" ? t : null;
}

function normalizeTrackState(raw: unknown): TrackState {
  const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const seenAt = typeof o.seenAt === "string" ? o.seenAt : null;
  const vr = Number(o.version);
  const version = Number.isFinite(vr) && vr > 0 ? vr : 1;
  const cs = o.completedSections;
  const completedSections = Array.isArray(cs) ? cs.filter((x): x is string => typeof x === "string") : [];
  return { seenAt, version, completedSections };
}

export function TutorialProvider({ children }: { children: ReactNode }) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname() ?? "/";

  const [helpTier, setHelpTier] = useState<HelpTier>("user");
  const [tourOpen, setTourOpen] = useState(false);
  const [activeTrack, setActiveTrack] = useState<TutorialTrackId>("user");
  const [stepIndex, setStepIndex] = useState(0);
  const [trackStates, setTrackStates] = useState<Partial<Record<TutorialTrackId, TrackState>>>({});
  const [stateLoading, setStateLoading] = useState(false);
  const [helpRoleLoaded, setHelpRoleLoaded] = useState(false);
  const [navWait, setNavWait] = useState(false);

  const sessionTier = useMemo(() => tierFromSessionUser(session?.user ?? null), [session?.user]);
  const viewerTier: HelpTier = sessionTier ?? helpTier;

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

  const steps = useMemo<TutorialStep[]>(
    () => getTutorialSteps(activeTrack, viewerTier, stepCtx),
    [activeTrack, viewerTier, stepCtx]
  );

  const sections = useMemo<TutorialSection[]>(
    () => getTutorialSections(activeTrack, viewerTier, stepCtx),
    [activeTrack, viewerTier, stepCtx]
  );

  const openAccountMenu = useCallback(async () => {
    const wrap = document.querySelector('[data-tutorial="nav.userMenu"]');
    const btn = wrap?.querySelector('button[aria-haspopup="menu"]');
    if (!(btn instanceof HTMLButtonElement)) return;
    if (btn.getAttribute("aria-expanded") === "true") return;
    btn.click();
    await new Promise((r) => setTimeout(r, 260));
  }, []);

  const closeAccountMenu = useCallback(async () => {
    const wrap = document.querySelector('[data-tutorial="nav.userMenu"]');
    const btn = wrap?.querySelector('button[aria-haspopup="menu"]');
    if (!(btn instanceof HTMLButtonElement)) return;
    if (btn.getAttribute("aria-expanded") !== "true") return;
    btn.click();
    // Let the dropdown unmount and layout settle before Joyride measures the next target.
    await new Promise((r) => setTimeout(r, 240));
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

      const latest = (json.latestVersions ?? TUTORIAL_LATEST_VERSIONS) as Record<TutorialTrackId, number>;
      const tracksRaw = json.tracks && typeof json.tracks === "object" ? json.tracks : {};

      for (const t of ["user", "mod", "admin"] as const) {
        const st = tracksRaw[t];
        const lv = Number(latest[t]);
        if (!st || !Number.isFinite(lv) || lv <= 0) continue;
        const parsed = normalizeTrackState(st);
        if (parsed.version < lv) {
          await fetch("/api/me/tutorial", {
            method: "PATCH",
            credentials: "same-origin",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ action: "reset", track: t }),
          });
        }
      }

      const res2 = await fetch("/api/me/tutorial", { credentials: "same-origin" });
      const json2 = (await res2.json().catch(() => ({}))) as any;
      if (!res2.ok || json2.success !== true) return;
      const tr = json2.tracks && typeof json2.tracks === "object" ? json2.tracks : {};
      setTrackStates({
        user: normalizeTrackState(tr.user),
        mod: tr.mod ? normalizeTrackState(tr.mod) : undefined,
        admin: tr.admin ? normalizeTrackState(tr.admin) : undefined,
      });
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
    async (opts?: { sectionId?: string; track?: TutorialTrackId }) => {
      const track = opts?.track ?? "user";
      if (!availableTutorialTracks(viewerTier).includes(track)) return;

      const list = getTutorialSteps(track, viewerTier, stepCtx);
      const sectionId = opts?.sectionId?.trim() ?? "";
      let idx = 0;
      if (sectionId) {
        const found = list.findIndex((s) => s.section === sectionId);
        if (found >= 0) idx = found;
      }

      setActiveTrack(track);
      setStepIndex(idx);
      setTourOpen(true);

      const seen = trackStates[track]?.seenAt;
      if (!seen) {
        void patchTutorial({ action: "seen", track });
        setTrackStates((prev) => ({
          ...prev,
          [track]: {
            ...(prev[track] ?? { seenAt: null, version: 1, completedSections: [] }),
            seenAt: new Date().toISOString(),
            version: TUTORIAL_LATEST_VERSIONS[track],
          },
        }));
      }
    },
    [patchTutorial, stepCtx, trackStates, viewerTier]
  );

  useEffect(() => {
    const w = window as any;
    w.__mcgbotTutorial = {
      start: (arg?: string | { sectionId?: string; track?: TutorialTrackId }) => {
        if (typeof arg === "string") void startTour({ sectionId: arg });
        else void startTour(arg);
      },
      reset: async (track: TutorialTrackId = "user") => {
        if (!availableTutorialTracks(viewerTier).includes(track)) return;
        await patchTutorial({ action: "reset", track });
        setTrackStates((prev) => ({
          ...prev,
          [track]: { seenAt: null, version: TUTORIAL_LATEST_VERSIONS[track], completedSections: [] },
        }));
        setStepIndex(0);
      },
      sectionsForTrack: (track: TutorialTrackId) =>
        availableTutorialTracks(viewerTier).includes(track)
          ? getTutorialSections(track, viewerTier, stepCtx)
          : [],
      availableTracks: () => availableTutorialTracks(viewerTier),
      /** @deprecated use sectionsForTrack */
      sections: () => getTutorialSections(activeTrack, viewerTier, stepCtx),
    };
    return () => {
      if ((window as any).__mcgbotTutorial) delete (window as any).__mcgbotTutorial;
    };
  }, [activeTrack, patchTutorial, startTour, stepCtx, viewerTier]);

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
    if (viewerTier !== "user") return;
    const seen = trackStates.user?.seenAt;
    if (seen) return;
    const list = getTutorialSteps("user", viewerTier, stepCtx);
    if (list.length === 0) return;
    setActiveTrack("user");
    setStepIndex(0);
    setTourOpen(true);
    void patchTutorial({ action: "seen", track: "user" });
    setTrackStates((prev) => ({
      ...prev,
      user: {
        ...(prev.user ?? { seenAt: null, version: 1, completedSections: [] }),
        seenAt: new Date().toISOString(),
        version: TUTORIAL_LATEST_VERSIONS.user,
      },
    }));
  }, [
    helpRoleLoaded,
    patchTutorial,
    sessionTier,
    stateLoading,
    status,
    tourOpen,
    trackStates.user?.seenAt,
    viewerTier,
    stepCtx,
  ]);

  useEffect(() => {
    if (!tourOpen) {
      setNavWait(false);
      return;
    }
    const r = steps[stepIndex]?.route;
    if (!r) {
      setNavWait(false);
      return;
    }
    if (pathname === r) {
      setNavWait(false);
      return;
    }
    setNavWait(true);
    router.push(r);
  }, [tourOpen, stepIndex, pathname, router, steps]);

  useEffect(() => {
    if (!navWait) return;
    const t = window.setTimeout(() => setNavWait(false), 4000);
    return () => window.clearTimeout(t);
  }, [navWait]);

  /** Keep the caller on `/` during account-dropdown spotlight steps (links are real Next.js routes). */
  useEffect(() => {
    if (!tourOpen) {
      document.body.removeAttribute("data-mcgbot-tour-block-account-nav");
      return;
    }
    const run = tourOpen && !navWait;
    if (!run) {
      document.body.removeAttribute("data-mcgbot-tour-block-account-nav");
      return;
    }
    const target = steps[stepIndex]?.target ?? "";
    if (target.includes("nav.menu.")) {
      document.body.setAttribute("data-mcgbot-tour-block-account-nav", "1");
    } else {
      document.body.removeAttribute("data-mcgbot-tour-block-account-nav");
    }
    return () => document.body.removeAttribute("data-mcgbot-tour-block-account-nav");
  }, [tourOpen, navWait, stepIndex, steps]);

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
          void patchTutorial({ action: "completeSection", sectionId: currSection, track: activeTrack });
          setTrackStates((prev) => {
            const ts = prev[activeTrack] ?? { seenAt: null, version: 1, completedSections: [] };
            if (ts.completedSections.includes(currSection)) return prev;
            return {
              ...prev,
              [activeTrack]: {
                ...ts,
                completedSections: [...ts.completedSections, currSection],
              },
            };
          });
        }
      }

      if (index >= steps.length - 1) {
        setTourOpen(false);
        return;
      }

      setStepIndex(index + 1);
    },
    [activeTrack, patchTutorial, steps]
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
      if (s.skipScroll === true) row.skipScroll = true;
      if (s.openAccountMenu || s.closeAccountMenu) {
        row.before = async () => {
          if (s.openAccountMenu) await openAccountMenu();
          if (s.closeAccountMenu) await closeAccountMenu();
        };
      }
      return row;
    });
  }, [closeAccountMenu, openAccountMenu, steps]);

  const joyrideRun = tourOpen && !navWait;

  return (
    <>
      {children}
      {status === "authenticated" ? (
        <Joyride
          steps={joyrideSteps as any}
          run={joyrideRun}
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
            overlayClickAction: false,
          }}
        />
      ) : null}
    </>
  );
}
