"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type DashboardNotification = {
  id: string;
  text: string;
  type: "win" | "call";
  createdAt: number;
  /** ATH / call multiple when known (used for highlight at high multiples). */
  multiple?: number;
};

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
  const [notifications, setNotifications] = useState<DashboardNotification[]>(
    []
  );

  const addNotification = useCallback((notif: DashboardNotification) => {
    setNotifications((prev) => [notif, ...prev].slice(0, 5));
  }, []);

  const removeNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
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
