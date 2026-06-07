"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/** Blur focused inputs after route changes so iOS Safari drops post-login zoom. */
export function MobileViewportFix() {
  const pathname = usePathname();

  useEffect(() => {
    const active = document.activeElement;
    if (active instanceof HTMLElement) {
      active.blur();
    }
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}
