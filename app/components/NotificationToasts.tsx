"use client";

import { useNotifications } from "@/app/contexts/NotificationsContext";
import type {
  DashboardNotification,
  NotificationPriority,
} from "@/app/contexts/NotificationsContext";
import { useEffect, useState } from "react";

function toastDismissMs(priority: NotificationPriority): number {
  if (priority === "high") return 8000;
  if (priority === "medium") return 6000;
  return 4000;
}

function priorityAccentClass(priority: NotificationPriority): string {
  if (priority === "high") return "bg-emerald-500";
  if (priority === "medium") return "bg-cyan-500";
  return "bg-zinc-600";
}

function prioritySurfaceClass(priority: NotificationPriority): string {
  if (priority === "high") {
    return [
      "border border-emerald-500",
      "shadow-[0_8px_32px_-8px_rgba(16,185,129,0.3)]",
    ].join(" ");
  }
  if (priority === "medium") {
    return "border border-cyan-500/30 shadow-lg";
  }
  return "border border-zinc-700 shadow-lg";
}

function ToastItem({
  id,
  text,
  type,
  priority,
  exiting,
  onDismiss,
}: {
  id: string;
  text: string;
  type: "win" | "call";
  priority: DashboardNotification["priority"];
  exiting?: boolean;
  onDismiss: (id: string) => void;
}) {
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setEntered(true);
      return;
    }
    const raf = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    if (exiting) return;
    const ms = toastDismissMs(priority);
    const t = window.setTimeout(() => onDismiss(id), ms);
    return () => window.clearTimeout(t);
  }, [id, onDismiss, exiting, priority]);

  const icon = type === "win" ? "🔥" : "⚡";
  const surface = prioritySurfaceClass(priority);
  const accent = priorityAccentClass(priority);
  const scaleInner =
    priority === "high" && !exiting
      ? "motion-safe:origin-right motion-safe:scale-105"
      : "";

  const motionShell = [
    "transition-all duration-200 ease-out",
    "motion-reduce:transition-none motion-reduce:duration-0",
    exiting
      ? "pointer-events-none translate-x-5 translate-y-0 opacity-0 motion-reduce:translate-x-0"
      : entered
        ? "translate-x-0 translate-y-0 opacity-100"
        : "-translate-y-2.5 translate-x-0 opacity-0 motion-reduce:translate-y-0 motion-reduce:opacity-100",
  ].join(" ");

  return (
    <div className={motionShell}>
      <div className={scaleInner}>
        <div
          role="status"
          className={`flex max-w-sm overflow-hidden rounded-lg bg-zinc-900 ${surface}`}
        >
          <div
            className={`w-1 shrink-0 self-stretch rounded-l-lg ${accent}`}
            aria-hidden
          />
          <div className="flex min-w-0 flex-1 items-start gap-3 px-4 py-3">
            <span className="shrink-0 text-lg leading-none" aria-hidden>
              {icon}
            </span>
            <p className="text-sm leading-snug text-zinc-100">{text}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function NotificationToasts() {
  const { notifications, removeNotification } = useNotifications();

  return (
    <div
      className="pointer-events-none fixed right-4 top-4 z-50 flex flex-col gap-3"
      aria-live="polite"
      aria-relevant="additions"
    >
      {notifications.map((n) => (
        <div key={n.id} className="pointer-events-auto">
          <ToastItem
            id={n.id}
            text={n.text}
            type={n.type}
            priority={n.priority}
            exiting={n.exiting}
            onDismiss={removeNotification}
          />
        </div>
      ))}
    </div>
  );
}
