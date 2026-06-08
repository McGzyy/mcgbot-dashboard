"use client";

import { HelpHotkey } from "@/app/components/HelpHotkey";
import { SessionGateRecovery } from "@/app/components/SessionGateRecovery";
import { SolanaWalletProviders } from "@/app/components/SolanaWalletProviders";
import { NotificationToasts } from "@/app/components/NotificationToasts";
import { OAuthErrorToastListener } from "@/app/components/OAuthErrorToastListener";
import { useNotifications } from "@/app/contexts/NotificationsContext";
import { DashboardWalletProvider } from "@/app/contexts/DashboardWalletContext";
import { NotificationsProvider } from "@/app/contexts/NotificationsContext";
import { TokenChartModalProvider } from "@/app/contexts/TokenChartModalContext";
import { VoiceSessionProvider } from "@/app/contexts/VoiceSessionContext";
import type { Session } from "next-auth";
import { SessionProvider } from "next-auth/react";
import type { ReactNode } from "react";
import { useCallback } from "react";

function OAuthErrorBridge() {
  const { addNotification } = useNotifications();
  const onError = useCallback(
    (message: string) => {
      addNotification({
        id: crypto.randomUUID(),
        text: message,
        type: "call",
        createdAt: Date.now(),
        priority: "medium",
      });
    },
    [addNotification]
  );
  return <OAuthErrorToastListener onError={onError} />;
}

export function Providers({
  children,
  session,
}: {
  children: ReactNode;
  session: Session | null;
}) {
  return (
    <SessionProvider
      refetchInterval={180}
      session={session ?? undefined}
    >
      <SessionGateRecovery />
      <SolanaWalletProviders>
        <DashboardWalletProvider>
          <VoiceSessionProvider>
            <NotificationsProvider>
              <OAuthErrorBridge />
              <TokenChartModalProvider>
                <HelpHotkey />
                {children}
                <NotificationToasts />
              </TokenChartModalProvider>
            </NotificationsProvider>
          </VoiceSessionProvider>
        </DashboardWalletProvider>
      </SolanaWalletProviders>
    </SessionProvider>
  );
}
