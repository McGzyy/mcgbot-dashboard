"use client";

import { useEffect, useState } from "react";

export function AnnouncementBar() {
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/public/site-flags");
        const j = (await res.json().catch(() => null)) as {
          announcement_enabled?: boolean;
          announcement_message?: string | null;
        } | null;
        if (cancelled || !j) return;
        if (
          j.announcement_enabled &&
          typeof j.announcement_message === "string" &&
          j.announcement_message.trim()
        ) {
          setMessage(j.announcement_message.trim());
        } else {
          setMessage(null);
        }
      } catch {
        if (!cancelled) setMessage(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!message) return null;

  return (
    <div
      role="status"
      className="shrink-0 border-b border-violet-500/25 bg-gradient-to-r from-violet-950/90 via-violet-900/35 to-zinc-950 px-4 py-2.5 text-center text-[13px] leading-snug text-violet-100/95 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)]"
    >
      <span className="inline-flex max-w-4xl items-start justify-center gap-2">
        <span
          className="mt-0.5 hidden h-1.5 w-1.5 shrink-0 rounded-full bg-violet-400 shadow-[0_0_8px_rgba(167,139,250,0.8)] sm:inline"
          aria-hidden
        />
        <span className="text-pretty">{message}</span>
      </span>
    </div>
  );
}
