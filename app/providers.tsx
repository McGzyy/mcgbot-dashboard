"use client";

import { HelpHotkey } from "@/app/components/HelpHotkey";
import { SessionGateRecovery } from "@/app/components/SessionGateRecovery";
import { SolanaWalletProviders } from "@/app/components/SolanaWalletProviders";
import { NotificationToasts } from "@/app/components/NotificationToasts";
import { DashboardWalletProvider } from "@/app/contexts/DashboardWalletContext";
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
      <SessionGateRecovery />
      <SolanaWalletProviders>
        <DashboardWalletProvider>
          <VoiceSessionProvider>
            <NotificationsProvider>
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
