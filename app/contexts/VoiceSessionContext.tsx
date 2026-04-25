"use client";

import { PersistentVoiceDock } from "@/app/components/voice/PersistentVoiceDock";
import {
  useVoiceLobbySession,
  type VoiceLobbySessionApi,
} from "@/app/hooks/useVoiceLobbySession";
import { useDashboardHelpRole } from "@/app/hooks/useDashboardHelpRole";
import { createContext, useContext, useMemo, useRef, type ReactNode } from "react";

export type VoiceSessionContextValue = VoiceLobbySessionApi & { helpTierLoading: boolean };

const VoiceSessionContext = createContext<VoiceSessionContextValue | null>(null);

export function useVoiceSession(): VoiceSessionContextValue {
  const ctx = useContext(VoiceSessionContext);
  if (!ctx) {
    throw new Error("useVoiceSession must be used within VoiceSessionProvider");
  }
  return ctx;
}

export function VoiceSessionProvider({ children }: { children: ReactNode }) {
  const { helpTier, loading: helpTierLoading } = useDashboardHelpRole();
  const audioMountRef = useRef<HTMLDivElement | null>(null);
  const sessionApi = useVoiceLobbySession(helpTier, audioMountRef);

  const value = useMemo(
    () => ({ ...sessionApi, helpTierLoading }),
    [sessionApi, helpTierLoading]
  );

  return (
    <VoiceSessionContext.Provider value={value}>
      {children}
      <div
        ref={audioMountRef}
        className="pointer-events-none fixed bottom-0 left-0 h-px w-px overflow-hidden opacity-0"
        aria-hidden
      />
      <PersistentVoiceDock />
    </VoiceSessionContext.Provider>
  );
}
