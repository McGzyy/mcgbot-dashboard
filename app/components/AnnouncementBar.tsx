"use client";

import { useCallback, useEffect, useState } from "react";

export type AnnouncementBarVariant = "inset" | "bare";

const REFETCH_MS = 45_000;

export function AnnouncementBar({ variant = "inset" }: { variant?: AnnouncementBarVariant }) {
  const [payload, setPayload] = useState<{
    message: string;
    ctaLabel: string | null;
    ctaUrl: string | null;
  } | null>(null);

  const loadFlags = useCallback(async (signal?: AbortSignal) => {
    try {
      const res = await fetch("/api/public/site-flags", { signal });
      const j = (await res.json().catch(() => null)) as {
        announcement_enabled?: boolean;
        announcement_message?: string | null;
        announcement_cta_label?: string | null;
        announcement_cta_url?: string | null;
      } | null;
      if (!j) {
        setPayload(null);
        return;
      }
      if (
        j.announcement_enabled &&
        typeof j.announcement_message === "string" &&
        j.announcement_message.trim()
      ) {
        const label =
          typeof j.announcement_cta_label === "string" && j.announcement_cta_label.trim()
            ? j.announcement_cta_label.trim().slice(0, 32)
            : null;
        const url =
          typeof j.announcement_cta_url === "string" && j.announcement_cta_url.trim()
            ? j.announcement_cta_url.trim().slice(0, 500)
            : null;
        const safeUrl = (() => {
          if (!url) return null;
          try {
            const u = new URL(url);
            if (u.protocol !== "https:" && u.protocol !== "http:") return null;
            return u.toString();
          } catch {
            return null;
          }
        })();
        setPayload({ message: j.announcement_message.trim(), ctaLabel: label, ctaUrl: safeUrl });
      } else {
        setPayload(null);
      }
    } catch (e) {
      if ((e as { name?: string }).name === "AbortError") return;
      setPayload(null);
    }
  }, []);

  useEffect(() => {
    const ac = new AbortController();
    void loadFlags(ac.signal);
    const id = window.setInterval(() => {
      void loadFlags();
    }, REFETCH_MS);
    return () => {
      ac.abort();
      window.clearInterval(id);
    };
  }, [loadFlags]);

  if (!payload) return null;

  const shell =
    variant === "bare"
      ? "sticky top-0 z-40 shrink-0 border-b border-sky-500/25 bg-gradient-to-r from-sky-950/95 via-sky-900/40 to-zinc-950 px-4 py-2.5 text-center text-[13px] leading-snug text-sky-100/95 shadow-[inset_0_1px_0_0_rgba(56,189,248,0.12),0_8px_24px_-12px_rgba(0,0,0,0.45)] backdrop-blur-md"
      : "sticky top-[var(--dashboard-topbar-height,6rem)] z-[45] -mt-0.5 mb-3 w-full min-w-0 shrink-0 overflow-hidden rounded-lg border border-red-500/35 bg-gradient-to-r from-red-950/90 via-red-950/45 to-zinc-950/95 py-2.5 pl-3 pr-3 text-[13px] leading-none text-red-50/95 shadow-[inset_0_1px_0_0_rgba(248,113,113,0.2),0_0_32px_-8px_rgba(220,38,38,0.35),0_10px_28px_-12px_rgba(0,0,0,0.55)] backdrop-blur-md sm:mb-4";

  const dotClass =
    variant === "bare"
      ? "mt-0.5 hidden h-1.5 w-1.5 shrink-0 rounded-full bg-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.75)] sm:inline"
      : "h-2 w-2 shrink-0 rounded-full bg-red-400 shadow-[0_0_12px_rgba(248,113,113,0.85)]";

  const ctaClass =
    variant === "bare"
      ? "ml-1 inline-flex shrink-0 items-center rounded-full border border-sky-300/25 bg-black/25 px-3 py-1 text-[12px] font-semibold text-sky-100/95 transition hover:border-sky-200/40 hover:bg-black/35"
      : "inline-flex shrink-0 items-center rounded-full border border-red-300/35 bg-black/35 px-3 py-1 text-[12px] font-semibold text-red-50 transition hover:border-red-200/50 hover:bg-black/45";

  return (
    <div role="status" className={shell}>
      <span
        className={
          variant === "bare"
            ? "inline-flex max-w-4xl items-start justify-center gap-3"
            : "flex w-full min-w-0 items-center justify-center gap-2.5 sm:gap-3"
        }
      >
        <span className={dotClass} aria-hidden />
        <span
          title={payload.message}
          className={
            variant === "bare"
              ? "text-pretty"
              : "min-w-0 flex-1 overflow-x-auto whitespace-nowrap text-center [scrollbar-width:thin] [scrollbar-color:rgba(248,113,113,0.35)_transparent] [&::-webkit-scrollbar]:h-1"
          }
        >
          {payload.message}
        </span>
        {payload.ctaLabel && payload.ctaUrl ? (
          <a href={payload.ctaUrl} target="_blank" rel="noopener noreferrer" className={ctaClass}>
            {payload.ctaLabel}
          </a>
        ) : null}
      </span>
    </div>
  );
}
