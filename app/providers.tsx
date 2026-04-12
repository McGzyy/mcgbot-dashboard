"use client";

import { NotificationToasts } from "@/app/components/NotificationToasts";
import { NotificationsProvider } from "@/app/contexts/NotificationsContext";
import { SessionProvider } from "next-auth/react";
import type { ReactNode } from "react";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <NotificationsProvider>
        {children}
        <NotificationToasts />
      </NotificationsProvider>
    </SessionProvider>
  );
}
