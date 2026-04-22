"use client";

import { TokenChartModal, type TokenChartModalPayload } from "@/app/components/TokenChartModal";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type Ctx = {
  openTokenChart: (payload: TokenChartModalPayload) => void;
  closeTokenChart: () => void;
};

const TokenChartModalContext = createContext<Ctx | null>(null);

const URL_PARAM = "chart";

function readChartFromUrl(): string {
  if (typeof window === "undefined") return "";
  try {
    const u = new URL(window.location.href);
    return (u.searchParams.get(URL_PARAM) ?? "").trim();
  } catch {
    return "";
  }
}

function writeChartToUrl(contractAddress: string | null) {
  if (typeof window === "undefined") return;
  try {
    const u = new URL(window.location.href);
    if (contractAddress && contractAddress.trim()) {
      u.searchParams.set(URL_PARAM, contractAddress.trim());
    } else {
      u.searchParams.delete(URL_PARAM);
    }
    window.history.replaceState({}, "", u.toString());
  } catch {
    // ignore
  }
}

export function TokenChartModalProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [payload, setPayload] = useState<TokenChartModalPayload | null>(null);

  const openTokenChart = useCallback((p: TokenChartModalPayload) => {
    const ca = String(p.contractAddress ?? "").trim();
    if (!ca) return;
    setPayload({
      chain: p.chain?.trim() || "solana",
      contractAddress: ca,
      symbolLabel: p.symbolLabel?.trim() || undefined,
      tokenName: p.tokenName ?? null,
      tokenTicker: p.tokenTicker ?? null,
      tokenImageUrl: p.tokenImageUrl ?? null,
      tradingViewSymbol: p.tradingViewSymbol ?? null,
    });
    setOpen(true);
    writeChartToUrl(ca);
  }, []);

  const closeTokenChart = useCallback(() => {
    setOpen(false);
    setPayload(null);
    writeChartToUrl(null);
  }, []);

  // Deep link / back-forward support.
  useEffect(() => {
    const syncFromUrl = () => {
      const ca = readChartFromUrl();
      if (!ca) return;
      setPayload((prev) => {
        if (prev?.contractAddress === ca) return prev;
        return {
          chain: prev?.chain ?? "solana",
          contractAddress: ca,
          symbolLabel: prev?.symbolLabel,
          tokenName: prev?.tokenName ?? null,
          tokenTicker: prev?.tokenTicker ?? null,
          tokenImageUrl: prev?.tokenImageUrl ?? null,
          tradingViewSymbol: prev?.tradingViewSymbol ?? null,
        };
      });
      setOpen(true);
    };

    syncFromUrl();
    window.addEventListener("popstate", syncFromUrl);
    return () => window.removeEventListener("popstate", syncFromUrl);
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
