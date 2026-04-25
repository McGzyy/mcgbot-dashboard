"use client";

import { HelpHotkey } from "@/app/components/HelpHotkey";
import { NotificationToasts } from "@/app/components/NotificationToasts";
import { NotificationsProvider } from "@/app/contexts/NotificationsContext";
import { TokenChartModalProvider } from "@/app/contexts/TokenChartModalContext";
import { VoiceSessionProvider } from "@/app/contexts/VoiceSessionContext";
import type { Session } from "next-auth";
import { SessionProvider } from "next-auth/react";
import type { ReactNode } from "react";

export function Providers({
  children,
  session,
}: {
  children: ReactNode;
  session: Session | null;
}) {
  return (
    <SessionProvider refetchInterval={45} session={session ?? undefined}>
      <VoiceSessionProvider>
        <NotificationsProvider>
          <TokenChartModalProvider>
            <HelpHotkey />
            {children}
            <NotificationToasts />
          </TokenChartModalProvider>
        </NotificationsProvider>
      </VoiceSessionProvider>
    </SessionProvider>
  );
}
