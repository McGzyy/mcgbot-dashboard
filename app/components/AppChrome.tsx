"use client";

import { AnnouncementBar } from "@/app/components/AnnouncementBar";
import { DiscordChatDock } from "@/app/components/DiscordChatDock";
import { FixItTicketLauncher } from "@/app/components/FixItTicketLauncher";
import { MainShell } from "@/app/components/MainShell";
import { Sidebar } from "@/app/components/Sidebar";
import { TutorialProvider } from "@/app/components/TutorialProvider";
import { MobileSidebarProvider } from "@/app/contexts/MobileSidebarContext";
import { usePathname } from "next/navigation";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import type { ReactNode } from "react";
import { useEffect } from "react";

export function AppChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "";
  const router = useRouter();
  const { data: session, status } = useSession();
  const bareLayout =
    pathname.startsWith("/subscribe") ||
    pathname.startsWith("/membership") ||
    pathname.startsWith("/join/verify") ||
    pathname.startsWith("/auth");

  // If the user is signed in but Discord marks them unverified, route them to the verify-required page.
  useEffect(() => {
    if (status !== "authenticated") return;
    const needs = Boolean((session?.user as any)?.discordNeedsVerification);
    if (!needs) return;
    if (pathname.startsWith("/join/verify")) return;
    router.replace("/join/verify");
  }, [pathname, router, session?.user, status]);

  return (
    <div className="flex min-h-screen flex-col">
      {bareLayout ? (
        <div className="flex min-h-0 flex-1 flex-col bg-[color:var(--mcg-page)]">
          <AnnouncementBar variant="bare" />
          {children}
        </div>
      ) : (
        <MobileSidebarProvider>
          <div className="flex min-h-0 flex-1">
            <Sidebar />
            <TutorialProvider>
              <MainShell>{children}</MainShell>
            </TutorialProvider>
            <DiscordChatDock />
            <FixItTicketLauncher />
          </div>
        </MobileSidebarProvider>
      )}
    </div>
  );
}
