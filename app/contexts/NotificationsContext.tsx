"use client";

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
  /** When true, item is fading out before removal from the stack. */
  exiting?: boolean;
};

const MAX_VISIBLE = 4;
const FADE_OUT_MS = 200;

let lastSoundTime = 0;

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
        })
        .catch(() => {});
    };

    loadSoundPref();
    window.addEventListener("focus", loadSoundPref);
    return () => {
      cancelled = true;
      window.removeEventListener("focus", loadSoundPref);
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
      if (sessionStatus === "authenticated" && soundEnabled) {
        const now = Date.now();

        if (now - lastSoundTime > 500) {
          const audio = new Audio("/sounds/ping.mp3");
          audio.volume = 0.3;
          void audio.play().catch(() => {});

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
    [sessionStatus, soundEnabled]
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
