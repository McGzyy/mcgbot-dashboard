"use client";

import { AnnouncementBar } from "@/app/components/AnnouncementBar";
import { dashboardChrome } from "@/lib/roleTierStyles";
import type { ReactNode } from "react";
import { TopBar } from "./TopBar";

export function MainShell({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex min-h-screen min-w-0 flex-1 flex-col">
      <TopBar />
      {/*
        Announcement must stay OUTSIDE mainStage: that region uses overflow-x-hidden, which breaks
        position:sticky in Chromium — the bar would scroll with content and overlap page headers.
      */}
      <AnnouncementBar variant="inset" stickyBelowTopBar />
      <div className={dashboardChrome.mainStage}>
        <div className={`${dashboardChrome.mainGlow} absolute inset-0`} aria-hidden />
        <div className={`${dashboardChrome.mainGrid} absolute inset-0`} aria-hidden />
        <div
          className={`${dashboardChrome.contentWell} pb-[calc(1rem+var(--mcg-dock-stack,0px))] sm:pb-[calc(1.25rem+var(--mcg-dock-stack,0px))]`}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
