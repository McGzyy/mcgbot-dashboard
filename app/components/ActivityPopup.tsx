"use client";

import { useEffect } from "react";

export type ActivityPopupItem = {
  text: string;
  link_chart: string | null;
  link_post: string | null;
};

export function ActivityPopup({
  item,
  onClose,
}: {
  item: ActivityPopupItem | null;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!item) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [item, onClose]);

  if (!item) return null;

  return (
    <div
      className="activity-popup-backdrop fixed inset-0 z-[200] flex items-center justify-center bg-black/55 p-4 backdrop-blur-[2px]"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="activity-popup-title"
        className="activity-popup-panel relative w-full max-w-md rounded-xl border border-zinc-800 bg-zinc-900 p-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 rounded-md p-1 text-zinc-500 transition hover:bg-zinc-800 hover:text-zinc-200"
          aria-label="Close"
        >
          ✕
        </button>
        <h2
          id="activity-popup-title"
          className="pr-10 text-base font-semibold leading-snug text-zinc-100"
        >
          {item.text}
        </h2>
        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          {item.link_chart ? (
            <a
              href={item.link_chart}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex flex-1 justify-center rounded-lg bg-sky-600 px-4 py-2.5 text-center text-sm font-semibold text-white transition hover:bg-sky-500"
            >
              View Chart
            </a>
          ) : null}
          {item.link_post ? (
            <a
              href={item.link_post}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex flex-1 justify-center rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-center text-sm font-semibold text-zinc-100 transition hover:bg-zinc-700"
            >
              View Post
            </a>
          ) : null}
          {!item.link_chart && !item.link_post ? (
            <p className="text-sm text-zinc-500">No links available for this activity.</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
