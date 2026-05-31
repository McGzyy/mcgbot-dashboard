"use client";

import { queueHighlightKeysMatch } from "@/lib/mod/modQueueHighlight";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";

const FLASH_MS = 2500;
const SCROLL_RETRY_MS = 150;
const SCROLL_MAX_ATTEMPTS = 12;

function scrollToHighlightAttr(highlight: string, attr: string): boolean {
  const target = highlight.trim();
  if (!target) return false;
  const els = document.querySelectorAll(`[${attr}]`);
  for (const el of els) {
    const key = el.getAttribute(attr);
    if (key && queueHighlightKeysMatch(key, target)) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      return true;
    }
  }
  return false;
}

type Options = {
  /** When false, skip scroll until queue data finished loading. */
  ready?: boolean;
  /** DOM attribute holding the highlight key (default: data-mod-queue-highlight). */
  attr?: string;
};

/**
 * Reads `?highlight=` from the URL, scrolls to the matching row, and flashes it briefly.
 */
export function useModQueueHighlight(options: Options = {}) {
  const { ready = true, attr = "data-mod-queue-highlight" } = options;
  const searchParams = useSearchParams();
  const highlightParam = useMemo(() => {
    const v = searchParams.get("highlight")?.trim();
    return v || null;
  }, [searchParams]);
  const [flashing, setFlashing] = useState<string | null>(null);

  useLayoutEffect(() => {
    if (!highlightParam || !ready) return;
    setFlashing(highlightParam);
    let attempts = 0;
    let timer: number | undefined;
    const tryScroll = () => {
      if (scrollToHighlightAttr(highlightParam, attr)) return;
      attempts += 1;
      if (attempts < SCROLL_MAX_ATTEMPTS) {
        timer = window.setTimeout(tryScroll, SCROLL_RETRY_MS);
      }
    };
    tryScroll();
    return () => {
      if (timer != null) window.clearTimeout(timer);
    };
  }, [highlightParam, ready, attr]);

  useEffect(() => {
    if (!flashing) return;
    const t = window.setTimeout(() => setFlashing(null), FLASH_MS);
    return () => window.clearTimeout(t);
  }, [flashing]);

  useEffect(() => {
    if (!highlightParam || flashing) return;
    const url = new URL(window.location.href);
    if (!url.searchParams.has("highlight")) return;
    url.searchParams.delete("highlight");
    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
  }, [highlightParam, flashing]);

  const isHighlighted = useCallback(
    (key: string) => {
      if (!flashing) return false;
      return queueHighlightKeysMatch(key, flashing);
    },
    [flashing]
  );

  return { highlight: flashing, isHighlighted };
}
