"use client";

import { MCBGOT_PREFERENCES_UPDATED } from "@/lib/preferencesEvents";
import { useSession } from "next-auth/react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

export type NotificationPriority = "low" | "medium" | "high";

export type DashboardNotification = {
  id: string;
  text: string;
  type: "win" | "call";
  createdAt: number;
  priority: NotificationPriority;
  /** When true, do not play the ping sound for this toast. */
  silent?: boolean;
  /** When true, item is fading out before removal from the stack. */
  exiting?: boolean;
};

const MAX_VISIBLE = 4;
const FADE_OUT_MS = 200;

let lastSoundTime = 0;
let audioCtx: AudioContext | null = null;

type NotificationSoundType = "classic" | "soft_pop" | "soft_chime";

function safeAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AC = (window.AudioContext || (window as any).webkitAudioContext) as
    | (new () => AudioContext)
    | undefined;
  if (!AC) return null;
  if (!audioCtx) audioCtx = new AC();
  return audioCtx;
}

function parseSoundType(raw: unknown): NotificationSoundType {
  const s = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  if (s === "soft_chime") return "soft_chime";
  if (s === "soft_pop" || s === "ping") return "soft_pop";
  if (s === "classic") return "classic";
  return "soft_pop";
}

function playWebAudioSound(type: NotificationSoundType): void {
  const ctx = safeAudioContext();
  if (!ctx) return;

  // Some browsers require user gesture; resume is best-effort.
  if (ctx.state === "suspended") {
    void ctx.resume().catch(() => {});
  }

  const now = ctx.currentTime;

  // Master gain keeps everything quiet by default.
  const master = ctx.createGain();
  master.gain.setValueAtTime(0.0, now);
  master.gain.linearRampToValueAtTime(0.18, now + 0.008);
  master.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);
  master.connect(ctx.destination);

  if (type === "soft_pop") {
    // A tiny sine "pop": fast pitch drop + very short envelope.
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(520, now);
    o.frequency.exponentialRampToValueAtTime(220, now + 0.09);
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(0.85, now + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
    o.connect(g);
    g.connect(master);
    o.start(now);
    o.stop(now + 0.18);
    return;
  }

  if (type === "soft_chime") {
    // Soft chime: two harmonics + longer decay.
    master.gain.setValueAtTime(0.0, now);
    master.gain.linearRampToValueAtTime(0.14, now + 0.01);
    master.gain.exponentialRampToValueAtTime(0.0001, now + 0.6);

    const mk = (freq: number, detune: number) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.setValueAtTime(freq, now);
      o.detune.setValueAtTime(detune, now);
      g.gain.setValueAtTime(0.0001, now);
      g.gain.exponentialRampToValueAtTime(0.65, now + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.55);
      o.connect(g);
      g.connect(master);
      o.start(now);
      o.stop(now + 0.62);
    };

    mk(660, -8);
    mk(990, 6);
    return;
  }
}

type NotificationsContextValue = {
  notifications: DashboardNotification[];
  addNotification: (notif: DashboardNotification) => void;
  removeNotification: (id: string) => void;
};

const NotificationsContext =
  createContext<NotificationsContextValue | null>(null);

export function useNotifications(): NotificationsContextValue {
  const ctx = useContext(NotificationsContext);
  if (!ctx) {
    throw new Error("useNotifications must be used within NotificationsProvider");
  }
  return ctx;
}

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { status: sessionStatus } = useSession();
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [soundType, setSoundType] = useState<NotificationSoundType>("soft_pop");
  const [notifications, setNotifications] = useState<DashboardNotification[]>(
    []
  );
  const fadeScheduledRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (sessionStatus !== "authenticated") {
      setSoundEnabled(true);
      return;
    }

    let cancelled = false;

    const loadSoundPref = () => {
      fetch("/api/preferences")
        .then((res) => res.json().then((data) => ({ ok: res.ok, data })))
        .then(({ ok, data }) => {
          if (cancelled) return;
          if (
            !ok ||
            !data ||
            typeof data !== "object" ||
            ("error" in data && (data as { error?: unknown }).error)
          ) {
            return;
          }
          const d = data as Record<string, unknown>;
          setSoundEnabled(!!d.sound_enabled);
          setSoundType(parseSoundType((d as any).sound_type));
        })
        .catch(() => {});
    };

    loadSoundPref();
    window.addEventListener("focus", loadSoundPref);
    window.addEventListener(MCBGOT_PREFERENCES_UPDATED, loadSoundPref);
    const onVis = () => {
      if (document.visibilityState === "visible") loadSoundPref();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelled = true;
      window.removeEventListener("focus", loadSoundPref);
      window.removeEventListener(MCBGOT_PREFERENCES_UPDATED, loadSoundPref);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [sessionStatus]);

  useEffect(() => {
    for (const n of notifications) {
      if (!n.exiting) continue;
      if (fadeScheduledRef.current.has(n.id)) continue;
      fadeScheduledRef.current.add(n.id);
      window.setTimeout(() => {
        fadeScheduledRef.current.delete(n.id);
        setNotifications((prev) => prev.filter((x) => x.id !== n.id));
      }, FADE_OUT_MS);
    }
  }, [notifications]);

  const addNotification = useCallback(
    (notif: DashboardNotification) => {
      if (sessionStatus === "authenticated" && soundEnabled && notif.silent !== true) {
        const now = Date.now();

        if (now - lastSoundTime > 500) {
          if (soundType === "classic") {
            const audio = new Audio("/sounds/ping.mp3");
            audio.volume = 0.22;
            void audio.play().catch(() => {});
          } else {
            playWebAudioSound(soundType);
          }

          lastSoundTime = now;
        }
      }

      setNotifications((prev) => {
      const fading = prev.filter((n) => n.exiting);
      const active = prev.filter((n) => !n.exiting);
      const next: DashboardNotification[] = [
        { ...notif, exiting: false },
        ...active.map((n) => ({ ...n, exiting: false })),
      ];

      let head: DashboardNotification[];
      if (next.length > MAX_VISIBLE) {
        const keep = next.slice(0, MAX_VISIBLE);
        const victim = next[MAX_VISIBLE];
        head = [...keep, { ...victim, exiting: true }];
      } else {
        head = next;
      }

      return [...head, ...fading];
    });
    },
    [sessionStatus, soundEnabled, soundType]
  );

  const removeNotification = useCallback((id: string) => {
    setNotifications((prev) => {
      const target = prev.find((n) => n.id === id);
      if (!target) return prev;
      if (target.exiting) return prev;
      return prev.map((n) =>
        n.id === id ? { ...n, exiting: true } : n
      );
    });
  }, []);

  const value = useMemo(
    () => ({ notifications, addNotification, removeNotification }),
    [notifications, addNotification, removeNotification]
  );

  return (
    <NotificationsContext.Provider value={value}>
      {children}
    </NotificationsContext.Provider>
  );
}
