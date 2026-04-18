"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

function isTypingContext(target: EventTarget | null): boolean {
  const el = target instanceof HTMLElement ? target : null;
  if (!el) return false;
  if (el.isContentEditable) return true;
  const tag = el.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (el.closest("[role=textbox]") != null) return true;
  return el.closest('[role="searchbox"]') != null;
}

/** Shift+/ → `?`: open Help when not typing in a field. */
export function HelpHotkey() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (isTypingContext(e.target)) return;

      const isQuestion =
        e.key === "?" || (e.code === "Slash" && e.shiftKey);
      if (!isQuestion) return;

      if (pathname === "/help") return;

      e.preventDefault();
      router.push("/help");
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [pathname, router]);

  return null;
}
