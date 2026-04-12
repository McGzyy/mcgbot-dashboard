"use client";

import { useNotifications } from "@/app/contexts/NotificationsContext";
import type { DashboardNotification } from "@/app/contexts/NotificationsContext";
import { useEffect } from "react";

const TOAST_DISMISS_MS = 5500;
const HIGH_MULTIPLE_MIN = 5;

function toastSurfaceClass(n: Pick<DashboardNotification, "type" | "multiple">): string {
  const m = n.multiple;
  const highMultiple =
    typeof m === "number" && Number.isFinite(m) && m >= HIGH_MULTIPLE_MIN;

  if (n.type === "win") {
    return [
      "border border-emerald-500/30",
      highMultiple ? "notification-toast-glow-win-strong" : "notification-toast-glow-win",
    ].join(" ");
  }

  const base = "border border-cyan-500/20";
  return highMultiple
    ? `${base} notification-toast-glow-call-strong`
    : `${base} shadow-lg`;
}

function ToastItem({
  id,
  text,
  type,
  multiple,
  onDismiss,
}: {
  id: string;
  text: string;
  type: "win" | "call";
  multiple?: number;
  onDismiss: (id: string) => void;
}) {
  useEffect(() => {
    const t = window.setTimeout(() => onDismiss(id), TOAST_DISMISS_MS);
    return () => window.clearTimeout(t);
  }, [id, onDismiss]);

  const icon = type === "win" ? "🔥" : "⚡";
  const surface = toastSurfaceClass({ type, multiple });

  return (
    <div
      role="status"
      className={`notification-toast flex max-w-sm items-start gap-3 rounded-lg bg-zinc-900 px-4 py-3 ${surface}`}
    >
      <span className="shrink-0 text-lg leading-none" aria-hidden>
        {icon}
      </span>
      <p className="text-sm leading-snug text-zinc-100">{text}</p>
    </div>
  );
}

export function NotificationToasts() {
  const { notifications, removeNotification } = useNotifications();

  return (
    <div
      className="pointer-events-none fixed right-4 top-4 z-50 flex flex-col gap-2"
      aria-live="polite"
      aria-relevant="additions"
    >
      {notifications.map((n) => (
        <div key={n.id} className="pointer-events-auto">
          <ToastItem
            id={n.id}
            text={n.text}
            type={n.type}
            multiple={n.multiple}
            onDismiss={removeNotification}
          />
        </div>
      ))}
    </div>
  );
}
