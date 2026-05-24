"use client";

import { useNotifications } from "@/app/contexts/NotificationsContext";
import { normalizeAlertPrefs } from "@/lib/dashboardAlertPrefs";
import { useSession } from "next-auth/react";
import { useEffect, useRef } from "react";

type InboxRow = {
  id: string;
  title: string;
  body: string;
  kind: string;
};

/**
 * When enabled, polls bell inbox for new dashboard alerts and shows a home toast
 * for followed-caller hits (cron-evaluated; complements live activity toasts).
 */
export function useDashboardAlertInboxToasts(enabled: boolean): void {
  const { status } = useSession();
  const { addNotification } = useNotifications();
  const seenIdsRef = useRef<Set<string>>(new Set());
  const bootstrappedRef = useRef(false);
  const followedCallersRef = useRef(true);

  useEffect(() => {
    if (status !== "authenticated") return;

    let cancelled = false;
    void fetch("/api/me/alert-preferences", { credentials: "same-origin" })
      .then((res) => res.json().catch(() => null))
      .then((j) => {
        if (cancelled || !j || typeof j !== "object") return;
        const prefs = normalizeAlertPrefs((j as { prefs?: unknown }).prefs);
        followedCallersRef.current = prefs.general.followed_callers;
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [status]);

  useEffect(() => {
    if (!enabled || status !== "authenticated") return;

    let cancelled = false;

    const poll = async () => {
      try {
        const res = await fetch("/api/me/inbox-notifications", {
          credentials: "same-origin",
        });
        const j = (await res.json().catch(() => null)) as
          | { items?: InboxRow[] }
          | null;
        if (!res.ok || cancelled || !j) return;

        const items = Array.isArray(j.items) ? j.items : [];

        if (!bootstrappedRef.current) {
          for (const row of items) {
            if (row?.id) seenIdsRef.current.add(row.id);
          }
          bootstrappedRef.current = true;
          return;
        }

        if (!followedCallersRef.current) return;

        for (const row of items) {
          if (!row?.id || seenIdsRef.current.has(row.id)) continue;
          seenIdsRef.current.add(row.id);
          if (row.kind !== "alert") continue;

          const title = typeof row.title === "string" ? row.title.trim() : "";
          if (title !== "Followed caller posted") continue;

          const firstLine =
            typeof row.body === "string" && row.body.trim()
              ? row.body.trim().split("\n")[0]
              : "Someone you follow posted a new call.";
          addNotification({
            id: crypto.randomUUID(),
            text: firstLine.slice(0, 280),
            type: "call",
            createdAt: Date.now(),
            priority: "high",
          });
        }
      } catch {
        /* ignore */
      }
    };

    void poll();
    const id = window.setInterval(() => void poll(), 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [enabled, status, addNotification]);
}
