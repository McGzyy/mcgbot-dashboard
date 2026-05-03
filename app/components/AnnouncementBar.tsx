"use client";

import { useEffect, useState } from "react";

export function AnnouncementBar() {
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

  return (
    <div
      role="status"
      className="shrink-0 border-b border-sky-500/25 bg-gradient-to-r from-sky-950/90 via-sky-900/35 to-zinc-950 px-4 py-2.5 text-center text-[13px] leading-snug text-sky-100/95 shadow-[inset_0_1px_0_0_rgba(56,189,248,0.12)]"
    >
      <span className="inline-flex max-w-4xl items-start justify-center gap-3">
        <span
          className="mt-0.5 hidden h-1.5 w-1.5 shrink-0 rounded-full bg-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.75)] sm:inline"
          aria-hidden
        />
        <span className="text-pretty">{payload.message}</span>
        {payload.ctaLabel && payload.ctaUrl ? (
          <a
            href={payload.ctaUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-1 inline-flex shrink-0 items-center rounded-full border border-sky-300/25 bg-black/25 px-3 py-1 text-[12px] font-semibold text-sky-100/95 transition hover:border-sky-200/40 hover:bg-black/35"
          >
            {payload.ctaLabel}
          </a>
        ) : null}
      </span>
    </div>
  );
}
