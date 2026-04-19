"use client";

import { HelpHotkey } from "@/app/components/HelpHotkey";
import { NotificationToasts } from "@/app/components/NotificationToasts";
import { NotificationsProvider } from "@/app/contexts/NotificationsContext";
import { SessionProvider } from "next-auth/react";
import type { ReactNode } from "react";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <SessionProvider refetchInterval={45}>
      <NotificationsProvider>
        <HelpHotkey />
        {children}
        <NotificationToasts />
      </NotificationsProvider>
    </SessionProvider>
  );
}
