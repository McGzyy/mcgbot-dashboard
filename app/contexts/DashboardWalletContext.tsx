"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useSession } from "next-auth/react";

export type LinkedWalletInfo = {
  chain: string;
  walletPubkey: string;
  verifiedAt: string | null;
} | null;

type DashboardWalletContextValue = {
  linked: LinkedWalletInfo;
  loading: boolean;
  refresh: () => Promise<void>;
};

const DashboardWalletContext = createContext<DashboardWalletContextValue | null>(
  null
);

export function useDashboardWallet(): DashboardWalletContextValue {
  const ctx = useContext(DashboardWalletContext);
  if (!ctx) {
    throw new Error("useDashboardWallet must be used within DashboardWalletProvider");
  }
  return ctx;
}

export function DashboardWalletProvider({ children }: { children: ReactNode }) {
  const { status } = useSession();
  const [linked, setLinked] = useState<LinkedWalletInfo>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (status !== "authenticated") {
      setLinked(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/me/wallet", { credentials: "same-origin" });
      const j = (await res.json().catch(() => null)) as {
        wallet?: {
          chain?: string;
          walletPubkey?: string;
          verifiedAt?: string | null;
        } | null;
      } | null;
      if (!res.ok || !j || typeof j !== "object") {
        setLinked(null);
        return;
      }
      const w = j.wallet;
      if (w && typeof w === "object" && typeof w.walletPubkey === "string") {
        setLinked({
          chain: typeof w.chain === "string" ? w.chain : "solana",
          walletPubkey: w.walletPubkey,
          verifiedAt: typeof w.verifiedAt === "string" ? w.verifiedAt : null,
        });
      } else {
        setLinked(null);
      }
    } catch {
      setLinked(null);
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value: DashboardWalletContextValue = { linked, loading, refresh };

  return (
    <DashboardWalletContext.Provider value={value}>
      {children}
    </DashboardWalletContext.Provider>
  );
}
