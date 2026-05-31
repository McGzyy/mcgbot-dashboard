"use client";

import { useNotifications } from "@/app/contexts/NotificationsContext";
import { normalizeAlertPrefs } from "@/lib/dashboardAlertPrefs";
import { inboxBodyForDisplay } from "@/lib/userInboxNotifications";
import { useSession } from "next-auth/react";
import { useEffect, useRef } from "react";

type InboxRow = {
  id: string;
  title: string;
  body: string;
  kind: string;
};

/**
 * When enabled, polls bell inbox and shows home toasts for dashboard alerts
 * (followed-caller hits) and mod escalation notices (admin inbox only).
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
        const res = await fetch("/api/me/inbox?limit=30", {
          credentials: "same-origin",
        });
        const j = (await res.json().catch(() => null)) as
          | {
              rows?: InboxRow[];
              unread?: number;
            }
          | null;
        if (!res.ok || cancelled || !j) return;

        const items = (Array.isArray(j.rows) ? j.rows : []).map((r) => ({
          id: String(r?.id ?? ""),
          title: String(r?.title ?? ""),
          body: String(r?.body ?? ""),
          kind: String(r?.kind ?? "info"),
        }));

        if (!bootstrappedRef.current) {
          for (const row of items) {
            if (row?.id) seenIdsRef.current.add(row.id);
          }
          bootstrappedRef.current = true;
          return;
        }

        for (const row of items) {
          if (!row?.id || seenIdsRef.current.has(row.id)) continue;
          seenIdsRef.current.add(row.id);

          const title = typeof row.title === "string" ? row.title.trim() : "";
          const bodyText = inboxBodyForDisplay(typeof row.body === "string" ? row.body : "");
          const firstLine = bodyText.split("\n")[0]?.trim() || title || "Notice";

          if (row.kind === "alert") {
            if (title === "Followed caller posted" && !followedCallersRef.current) continue;

            const toastText =
              title && title !== firstLine ? `${title} — ${firstLine}` : firstLine;

            addNotification({
              id: crypto.randomUUID(),
              text: toastText.slice(0, 280),
              type: "call",
              createdAt: Date.now(),
              priority: title === "Followed caller posted" ? "high" : "medium",
            });
            continue;
          }

          if (row.kind === "mod_escalation") {
            const toastText =
              title && title !== firstLine ? `${title} — ${firstLine}` : firstLine;

            addNotification({
              id: crypto.randomUUID(),
              text: toastText.slice(0, 280),
              type: "call",
              createdAt: Date.now(),
              priority: "high",
            });
          }
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
