"use client";

import Link from "next/link";
import type { ReactNode } from "react";

type DashboardWidgetEmptyProps = {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  actionHref?: string;
  badge?: string;
  icon?: ReactNode;
};

export function DashboardWidgetEmpty({
  title,
  description,
  actionLabel,
  onAction,
  actionHref,
  badge = "Desk",
  icon,
}: DashboardWidgetEmptyProps) {
  const actionClass =
    "mt-4 inline-flex items-center justify-center rounded-lg border border-[color:var(--accent)]/40 bg-[color:var(--accent)]/10 px-3 py-1.5 text-xs font-semibold text-[color:var(--accent)] transition hover:bg-[color:var(--accent)]/20";

  return (
    <div className="flex h-full min-h-[12rem] flex-col items-center justify-center px-4 py-10 text-center">
      {icon ? (
        <div className="mb-3 text-2xl opacity-80" aria-hidden>
          {icon}
        </div>
      ) : (
        <div className="rounded-full border border-zinc-800 bg-zinc-900/40 px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
          {badge}
        </div>
      )}
      <p className="mt-3 text-sm font-semibold text-zinc-200">{title}</p>
      <p className="mt-1 max-w-xs text-xs leading-relaxed text-zinc-500">{description}</p>
      {actionLabel && onAction ? (
        <button type="button" onClick={onAction} className={actionClass}>
          {actionLabel}
        </button>
      ) : null}
      {actionLabel && actionHref && !onAction ? (
        <Link href={actionHref} className={actionClass}>
          {actionLabel}
        </Link>
      ) : null}
    </div>
  );
}
