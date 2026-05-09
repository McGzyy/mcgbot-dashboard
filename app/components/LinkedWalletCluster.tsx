"use client";

import { WalletAccountPanel } from "@/app/components/WalletAccountPanel";
import { WalletBalanceHistoryChart } from "@/app/components/WalletBalanceHistoryChart";
import { useWallet } from "@solana/wallet-adapter-react";
import { useSession } from "next-auth/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useDashboardWallet } from "@/app/contexts/DashboardWalletContext";
import { terminalSurface } from "@/lib/terminalDesignTokens";

const WALLET_TABS = ["Home", "PnL", "TXs", "Send"] as const;
type WalletTabId = (typeof WALLET_TABS)[number];

function shortenPk(pk: string): string {
  const t = pk.trim();
  if (t.length <= 12) return t;
  return `${t.slice(0, 4)}…${t.slice(-4)}`;
}

function formatSol(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return "—";
  if (n >= 1000) return `${(n / 1000).toFixed(2)}k`;
  if (n >= 1) return n.toFixed(3).replace(/\.?0+$/, "");
  return n.toFixed(4).replace(/\.?0+$/, "");
}

type Balances = { sol: number | null; usdc: number | null };

export function LinkedWalletCluster() {
  const { status } = useSession();
  const { linked, loading: linkLoading } = useDashboardWallet();
  const { publicKey, connected } = useWallet();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<WalletTabId>("Home");
  const [balances, setBalances] = useState<Balances | null>(null);
  const [balLoading, setBalLoading] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const loadBalances = useCallback(async () => {
    if (status !== "authenticated" || !linked) {
      setBalances(null);
      return;
    }
    setBalLoading(true);
    try {
      const res = await fetch("/api/me/wallet/balances", { credentials: "same-origin" });
      const j = (await res.json().catch(() => null)) as {
        linked?: boolean;
        sol?: number | null;
        usdc?: number | null;
      } | null;
      if (!res.ok || !j) {
        setBalances(null);
        return;
      }
      setBalances({
        sol: typeof j.sol === "number" ? j.sol : null,
        usdc: typeof j.usdc === "number" ? j.usdc : null,
      });
    } catch {
      setBalances(null);
    } finally {
      setBalLoading(false);
    }
  }, [linked, status]);

  useEffect(() => {
    if (open) return;
    void loadBalances();
    const id = window.setInterval(() => void loadBalances(), 30_000);
    return () => window.clearInterval(id);
  }, [open, loadBalances]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target;
      if (t instanceof Element) {
        if (
          t.closest(".wallet-adapter-modal-wrapper") ||
          t.closest(".wallet-adapter-modal")
        ) {
          return;
        }
      }
      const el = wrapRef.current;
      if (el && !el.contains(t as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const adapterPk = publicKey?.toBase58() ?? null;

  if (status !== "authenticated") return null;

  const stripLabel = linked
    ? shortenPk(linked.walletPubkey)
    : connected && adapterPk
      ? shortenPk(adapterPk)
      : "Wallet";

  const stripSol =
    linked && balances && !balLoading ? formatSol(balances.sol) : null;

  return (
    <div className="relative shrink-0" ref={wrapRef}>
      <button
        type="button"
        onClick={() => {
          setOpen((o) => {
            const next = !o;
            if (next) setTab("Home");
            return next;
          });
        }}
        className={`flex max-w-[11rem] items-center gap-2 rounded-lg border border-zinc-800/70 bg-zinc-950/40 px-2 py-1 text-left transition hover:border-zinc-600 hover:bg-zinc-900/50 sm:max-w-[14rem] sm:px-2.5 ${terminalSurface.insetEdge}`}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <span
          className="h-1.5 w-1.5 shrink-0 rounded-full bg-violet-400/80 shadow-[0_0_8px_rgba(167,139,250,0.35)]"
          aria-hidden
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
            {linkLoading ? "…" : linked ? "Wallet" : "Solana"}
          </p>
          <p className="truncate text-[11px] font-semibold tabular-nums text-zinc-100 sm:text-xs">
            {stripSol != null && !open ? (
              <>
                <span className="text-zinc-300">{stripLabel}</span>
                <span className="mx-1 text-zinc-600">·</span>
                <span className="text-emerald-200/95">{stripSol} SOL</span>
              </>
            ) : (
              <span className="text-zinc-200">{stripLabel}</span>
            )}
          </p>
        </div>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="h-3.5 w-3.5 shrink-0 text-zinc-500"
          aria-hidden
        >
          <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open ? (
        <div
          className="absolute right-0 z-[130] mt-2 w-[min(20rem,calc(100vw-1.25rem))] rounded-xl border border-zinc-800/90 bg-zinc-950 p-4 shadow-xl shadow-black/50 ring-1 ring-zinc-800/40"
          role="dialog"
          aria-label="Linked wallet"
        >
          <div
            className={`flex gap-0.5 rounded-lg border border-zinc-800/80 bg-zinc-950/50 p-0.5 ${terminalSurface.insetEdgeSoft}`}
            role="tablist"
            aria-label="Wallet sections"
          >
            {WALLET_TABS.map((id) => {
              const active = tab === id;
              return (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setTab(id)}
                  className={`flex-1 rounded-md px-2 py-1.5 text-center text-[11px] font-semibold transition ${
                    active
                      ? "bg-zinc-700 text-zinc-50 shadow-sm"
                      : "text-zinc-400 hover:bg-zinc-800/80 hover:text-zinc-200"
                  }`}
                >
                  {id}
                </button>
              );
            })}
          </div>

          <div className="mt-3" role="tabpanel">
            {tab === "Home" ? (
              <WalletAccountPanel
                onBeforeWalletModal={() => setOpen(false)}
                onDisconnected={() => setOpen(false)}
              />
            ) : tab === "PnL" ? (
              <WalletBalanceHistoryChart chartWidth={260} chartHeight={56} />
            ) : (
              <div className="flex min-h-[10rem] flex-col items-center justify-center rounded-xl border border-zinc-800/70 bg-zinc-950/30 px-4 py-8 text-center">
                <p className="text-sm font-semibold text-zinc-300">Coming soon</p>
                <p className="mt-1 text-xs text-zinc-500">
                  {tab === "TXs"
                    ? "Transaction history will appear here."
                    : "Send flows will be available here."}
                </p>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
