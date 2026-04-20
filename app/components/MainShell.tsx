"use client";

import { dashboardChrome } from "@/lib/roleTierStyles";
import type { ReactNode } from "react";
import { TopBar } from "./TopBar";

export function MainShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen min-w-0 flex-1 flex-col">
      <TopBar />
      <div className={dashboardChrome.mainStage}>
        <div className={`${dashboardChrome.mainGlow} absolute inset-0`} aria-hidden />
        <div className={`${dashboardChrome.mainGrid} absolute inset-0`} aria-hidden />
        <div className={dashboardChrome.contentWell}>{children}</div>
      </div>
    </div>
  );
}
