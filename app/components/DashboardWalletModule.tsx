"use client";

import PanelCard from "@/components/PanelCard";
import { terminalSurface } from "@/lib/terminalDesignTokens";
import { useCallback, useState } from "react";
import { WalletAccountPanel } from "@/app/components/WalletAccountPanel";
import { WalletBalanceHistoryChart } from "@/app/components/WalletBalanceHistoryChart";

const TABS = ["Home", "PnL", "TXs", "Send"] as const;
type TabId = (typeof TABS)[number];

export default function DashboardWalletModule() {
  const [tab, setTab] = useState<TabId>("Home");

  const tabBtnClass = useCallback((active: boolean) => {
    return `flex-1 rounded-md px-2 py-1.5 text-center text-[11px] font-semibold transition sm:text-xs ${
      active
        ? "bg-zinc-700 text-zinc-50 shadow-sm"
        : "text-zinc-400 hover:bg-zinc-800/80 hover:text-zinc-200"
    }`;
  }, []);

  return (
    <PanelCard title="Wallet" titleClassName="normal-case">
      <div
        className={`mt-2 flex gap-0.5 rounded-lg border border-zinc-800/80 bg-zinc-950/50 p-0.5 ${terminalSurface.insetEdgeSoft}`}
        role="tablist"
        aria-label="Wallet sections"
      >
        {TABS.map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={tabBtnClass(tab === id)}
          >
            {id}
          </button>
        ))}
      </div>

      <div className="mt-3 min-h-[12rem]" role="tabpanel">
        {tab === "Home" ? (
          <>
            <p className="mb-3 text-[11px] leading-snug text-zinc-500">
              Linked address used for verification and dashboard wallet tools (balances shown on the header when closed).
            </p>
            <WalletAccountPanel showHeading={false} />
          </>
        ) : tab === "PnL" ? (
          <WalletBalanceHistoryChart chartWidth={260} chartHeight={56} />
        ) : (
          <div className="flex min-h-[10rem] flex-col items-center justify-center rounded-xl border border-zinc-800/70 bg-zinc-950/30 px-4 py-8 text-center">
            <p className="text-sm font-semibold text-zinc-300">Coming soon</p>
            <p className="mt-1 text-xs text-zinc-500">
              {tab === "TXs" ? "Transaction history will appear here." : "Send flows will be available here."}
            </p>
          </div>
        )}
      </div>
    </PanelCard>
  );
}
