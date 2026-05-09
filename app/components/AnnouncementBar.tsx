"use client";

import { useEffect, useState } from "react";

export type AnnouncementBarVariant = "inset" | "bare";

export function AnnouncementBar({ variant = "inset" }: { variant?: AnnouncementBarVariant }) {
  const [payload, setPayload] = useState<{
    message: string;
    ctaLabel: string | null;
    ctaUrl: string | null;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/public/site-flags");
        const j = (await res.json().catch(() => null)) as {
          announcement_enabled?: boolean;
          announcement_message?: string | null;
          announcement_cta_label?: string | null;
          announcement_cta_url?: string | null;
        } | null;
        if (cancelled || !j) return;
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
      } catch {
        if (!cancelled) setPayload(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!payload) return null;

  const shell =
    variant === "bare"
      ? "shrink-0 border-b border-sky-500/25 bg-gradient-to-r from-sky-950/90 via-sky-900/35 to-zinc-950 px-4 py-2.5 text-center text-[13px] leading-snug text-sky-100/95 shadow-[inset_0_1px_0_0_rgba(56,189,248,0.12)]"
      : "relative z-[1] -mt-0.5 mb-3 shrink-0 overflow-hidden rounded-xl border border-emerald-500/20 bg-gradient-to-r from-emerald-950/55 via-zinc-950/90 to-zinc-950/95 px-4 py-2.5 text-center text-[13px] leading-snug text-emerald-50/95 shadow-[inset_0_1px_0_0_rgba(16,185,129,0.14),0_8px_28px_-18px_rgba(0,0,0,0.65)] sm:mb-4";

  const dotClass =
    variant === "bare"
      ? "mt-0.5 hidden h-1.5 w-1.5 shrink-0 rounded-full bg-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.75)] sm:inline"
      : "mt-0.5 hidden h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.55)] sm:inline";

  const ctaClass =
    variant === "bare"
      ? "ml-1 inline-flex shrink-0 items-center rounded-full border border-sky-300/25 bg-black/25 px-3 py-1 text-[12px] font-semibold text-sky-100/95 transition hover:border-sky-200/40 hover:bg-black/35"
      : "ml-1 inline-flex shrink-0 items-center rounded-full border border-emerald-400/30 bg-black/30 px-3 py-1 text-[12px] font-semibold text-emerald-100/95 transition hover:border-emerald-300/45 hover:bg-black/40";

  return (
    <div role="status" className={shell}>
      <span className="inline-flex max-w-4xl items-start justify-center gap-3">
        <span className={dotClass} aria-hidden />
        <span className="text-pretty">{payload.message}</span>
        {payload.ctaLabel && payload.ctaUrl ? (
          <a href={payload.ctaUrl} target="_blank" rel="noopener noreferrer" className={ctaClass}>
            {payload.ctaLabel}
          </a>
        ) : null}
      </span>
    </div>
  );
}
