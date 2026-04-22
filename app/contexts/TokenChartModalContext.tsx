"use client";

import { TokenChartModal, type TokenChartModalPayload } from "@/app/components/TokenChartModal";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type Ctx = {
  openTokenChart: (payload: TokenChartModalPayload) => void;
  closeTokenChart: () => void;
};

const TokenChartModalContext = createContext<Ctx | null>(null);

export function TokenChartModalProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [payload, setPayload] = useState<TokenChartModalPayload | null>(null);

  const openTokenChart = useCallback((p: TokenChartModalPayload) => {
    const ca = String(p.contractAddress ?? "").trim();
    if (!ca) return;
    setPayload({
      chain: p.chain?.trim() || "solana",
      contractAddress: ca,
      symbolLabel: p.symbolLabel?.trim() || ca.slice(0, 8),
      tokenImageUrl: p.tokenImageUrl ?? null,
      tradingViewSymbol: p.tradingViewSymbol ?? null,
    });
    setOpen(true);
  }, []);

  const closeTokenChart = useCallback(() => {
    setOpen(false);
    setPayload(null);
  }, []);

  const value = useMemo(
    () => ({ openTokenChart, closeTokenChart }),
    [openTokenChart, closeTokenChart]
  );

  return (
    <TokenChartModalContext.Provider value={value}>
      {children}
      <TokenChartModal open={open} payload={payload} onClose={closeTokenChart} />
    </TokenChartModalContext.Provider>
  );
}

export function useTokenChartModal(): Ctx {
  const ctx = useContext(TokenChartModalContext);
  if (!ctx) {
    throw new Error("useTokenChartModal must be used within TokenChartModalProvider");
  }
  return ctx;
}
