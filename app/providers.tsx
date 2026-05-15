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
    {/* Default NextAuth refetch is 0 (off). ~3m balances fresh gates vs hammering JWT on flaky networks. */}
    <SessionProvider refetchInterval={180} session={session ?? undefined}>
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
