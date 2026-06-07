"use client";

import { useEffect } from "react";

/** Register minimal service worker for PWA install eligibility. */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    void navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
      /* unsupported or blocked */
    });
  }, []);

  return null;
}
