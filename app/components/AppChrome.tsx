"use client";

import { AnnouncementBar } from "@/app/components/AnnouncementBar";
import { MainShell } from "@/app/components/MainShell";
import { Sidebar } from "@/app/components/Sidebar";
import { TutorialProvider } from "@/app/components/TutorialProvider";
import { MobileSidebarProvider } from "@/app/contexts/MobileSidebarContext";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

export function AppChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "";
  const bareLayout = pathname.startsWith("/subscribe") || pathname.startsWith("/auth");

  return (
    <div className="flex min-h-screen flex-col">
      <AnnouncementBar />
      {bareLayout ? (
        <div className="flex min-h-0 flex-1 flex-col">{children}</div>
      ) : (
        <MobileSidebarProvider>
          <div className="flex min-h-0 flex-1">
            <Sidebar />
            <TutorialProvider>
              <MainShell>{children}</MainShell>
            </TutorialProvider>
          </div>
        </MobileSidebarProvider>
      )}
    </div>
  );
}
