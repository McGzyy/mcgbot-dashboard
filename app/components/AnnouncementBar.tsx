"use client";

import { useCallback, useEffect, useState } from "react";

export type AnnouncementBarVariant = "inset" | "bare";

const REFETCH_MS = 45_000;
const DISMISS_STORAGE_KEY = "mcg_ann_dismiss_v1";

type SiteFlagsAnnouncement = {
  announcement_enabled?: boolean;
  announcement_global?: boolean;
  announcement_message?: string | null;
  announcement_message_mobile?: string | null;
  announcement_hide_on_mobile?: boolean;
  announcement_allow_user_dismiss?: boolean;
  announcement_content_version?: string | null;
  announcement_cta_label?: string | null;
  announcement_cta_url?: string | null;
};

type BarPayload = {
  message: string;
  messageMobile: string | null;
  hideOnMobile: boolean;
  allowUserDismiss: boolean;
  contentVersion: string;
  ctaLabel: string | null;
  ctaUrl: string | null;
};

export function AnnouncementBar({
  variant = "inset",
  /** When true (dashboard shell), sticky is applied outside `mainStage` so it is not broken by `overflow-x-hidden`. */
  stickyBelowTopBar = false,
  /** Only show when admin enabled "Global (all pages)". */
  requireGlobal = false,
}: {
  variant?: AnnouncementBarVariant;
  stickyBelowTopBar?: boolean;
  requireGlobal?: boolean;
}) {
  const [payload, setPayload] = useState<BarPayload | null>(null);
  const [userDismissed, setUserDismissed] = useState(false);

  const loadFlags = useCallback(async (signal?: AbortSignal) => {
    try {
      const res = await fetch("/api/public/site-flags", { signal });
      const j = (await res.json().catch(() => null)) as SiteFlagsAnnouncement | null;
      if (!j) {
        setPayload(null);
        return;
      }
      if (requireGlobal && j.announcement_global !== true) {
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
        const mobileRaw =
          typeof j.announcement_message_mobile === "string" ? j.announcement_message_mobile.trim() : "";
        const contentVersion =
          typeof j.announcement_content_version === "string" && j.announcement_content_version.trim()
            ? j.announcement_content_version.trim().slice(0, 32)
            : "";
        setPayload({
          message: j.announcement_message.trim(),
          messageMobile: mobileRaw ? mobileRaw.slice(0, 2000) : null,
          hideOnMobile: j.announcement_hide_on_mobile === true,
          allowUserDismiss: j.announcement_allow_user_dismiss === true,
          contentVersion,
          ctaLabel: label,
          ctaUrl: safeUrl,
        });
      } else {
        setPayload(null);
      }
    } catch (e) {
      if ((e as { name?: string }).name === "AbortError") return;
      setPayload(null);
    }
  }, [requireGlobal]);

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

  useEffect(() => {
    if (!payload?.allowUserDismiss || !payload.contentVersion) {
      setUserDismissed(false);
      return;
    }
    try {
      setUserDismissed(localStorage.getItem(DISMISS_STORAGE_KEY) === payload.contentVersion);
    } catch {
      setUserDismissed(false);
    }
  }, [payload?.allowUserDismiss, payload?.contentVersion]);

  if (!payload || userDismissed) return null;

  const mobileShellClass = payload.hideOnMobile ? "hidden sm:block" : "";

  const onDismiss = () => {
    if (!payload.allowUserDismiss || !payload.contentVersion) return;
    try {
      localStorage.setItem(DISMISS_STORAGE_KEY, payload.contentVersion);
    } catch {
      /* ignore quota / private mode */
    }
    setUserDismissed(true);
  };

  const bareShell =
    "sticky top-0 z-40 shrink-0 border-b border-sky-500/25 bg-gradient-to-r from-sky-950/95 via-sky-900/40 to-zinc-950 px-4 py-2.5 text-center text-[13px] leading-snug text-sky-100/95 shadow-[inset_0_1px_0_0_rgba(56,189,248,0.12),0_8px_24px_-12px_rgba(0,0,0,0.45)] backdrop-blur-md";

  const insetInnerShell =
    "relative z-[1] w-full min-w-0 overflow-hidden rounded-md border border-red-500/35 bg-gradient-to-r from-red-950/85 via-red-950/40 to-zinc-950/90 py-1.5 pl-2.5 pr-2 text-red-50/95 shadow-[inset_0_1px_0_0_rgba(248,113,113,0.2),0_0_28px_-8px_rgba(220,38,38,0.32),0_8px_22px_-12px_rgba(0,0,0,0.5)] backdrop-blur-md";

  const dotClass =
    variant === "bare"
      ? "mt-0.5 hidden h-1.5 w-1.5 shrink-0 rounded-full bg-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.75)] sm:inline"
      : "h-1.5 w-1.5 shrink-0 rounded-full bg-red-400 shadow-[0_0_10px_rgba(248,113,113,0.85)]";

  const ctaClass =
    variant === "bare"
      ? "ml-1 inline-flex shrink-0 items-center rounded-full border border-sky-300/25 bg-black/25 px-3 py-1 text-[12px] font-semibold text-sky-100/95 transition hover:border-sky-200/40 hover:bg-black/35"
      : "inline-flex shrink-0 items-center rounded-full border border-red-300/35 bg-black/35 px-3 py-1 text-[12px] font-semibold text-red-50 transition hover:border-red-200/50 hover:bg-black/45";

  const dismissBtnClass =
    variant === "bare"
      ? "ml-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-sky-400/30 bg-black/30 text-sky-100/90 transition hover:border-sky-200/50 hover:bg-black/40 hover:text-white"
      : "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-red-400/35 bg-black/35 text-red-50/90 transition hover:border-red-200/55 hover:bg-black/45 hover:text-white";

  const dismissControl =
    payload.allowUserDismiss && payload.contentVersion ? (
      <button
        type="button"
        onClick={onDismiss}
        className={dismissBtnClass}
        aria-label="Dismiss announcement"
        title="Dismiss"
      >
        <span className="text-lg font-light leading-none" aria-hidden>
          ×
        </span>
      </button>
    ) : null;

  const desktopMessage = payload.message;
  const mobileMessage = payload.messageMobile?.trim() ? payload.messageMobile.trim() : payload.message;

  const messageBlock =
    variant === "bare" ? (
      <span title={payload.message} className="inline text-pretty text-[14px] leading-snug">
        <span className="sm:hidden">{mobileMessage}</span>
        <span className="hidden sm:inline">{desktopMessage}</span>
      </span>
    ) : (
      <>
        <div className="announcement-marquee min-w-0 flex-1 sm:hidden" aria-label={mobileMessage}>
          <div className="announcement-marquee-track">
            <span className="announcement-marquee-gap text-[14px] font-medium leading-none tracking-tight">
              {mobileMessage}
            </span>
            <span className="announcement-marquee-gap text-[14px] font-medium leading-none tracking-tight" aria-hidden>
              {mobileMessage}
            </span>
          </div>
        </div>
        <div
          className="announcement-marquee hidden min-w-0 flex-1 sm:block"
          title={payload.message}
          aria-label={payload.message}
        >
          <div className="announcement-marquee-track">
            <span className="announcement-marquee-gap text-[14px] font-medium leading-none tracking-tight">
              {desktopMessage}
            </span>
            <span className="announcement-marquee-gap text-[14px] font-medium leading-none tracking-tight" aria-hidden>
              {desktopMessage}
            </span>
          </div>
        </div>
      </>
    );

  const body = (
    <div
      className={
        variant === "bare"
          ? "inline-flex max-w-4xl items-start justify-center gap-3"
          : "flex w-full min-w-0 items-center gap-2 sm:gap-2.5"
      }
    >
      <span className={dotClass} aria-hidden />
      {messageBlock}
      {dismissControl}
      {payload.ctaLabel && payload.ctaUrl ? (
        <a href={payload.ctaUrl} target="_blank" rel="noopener noreferrer" className={ctaClass}>
          {payload.ctaLabel}
        </a>
      ) : null}
    </div>
  );

  if (variant === "bare") {
    return (
      <div role="status" className={`${bareShell} ${mobileShellClass}`}>
        {body}
      </div>
    );
  }

  if (stickyBelowTopBar) {
    return (
      <div
        className={`sticky top-[var(--dashboard-topbar-height,6rem)] z-[45] w-full shrink-0 bg-[color:var(--mcg-stage)]/30 shadow-[0_6px_20px_-14px_rgba(0,0,0,0.4)] backdrop-blur-[2px] ${mobileShellClass}`}
      >
        <div className="mx-auto w-full max-w-[1680px] px-3 pb-1 pt-0.5 min-[480px]:px-5 sm:px-8 sm:pb-1.5 sm:pt-1">
          <div role="status" className={insetInnerShell}>
            {body}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div role="status" className={`${insetInnerShell} mb-3 sm:mb-4 ${mobileShellClass}`}>
      {body}
    </div>
  );
}
