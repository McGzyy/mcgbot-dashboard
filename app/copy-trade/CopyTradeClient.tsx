"use client";

import { terminalChrome, terminalSurface, terminalUi } from "@/lib/terminalDesignTokens";
import { formatRelativeTime } from "@/lib/modUiUtils";
import { useCallback, useEffect, useLayoutEffect, useState } from "react";

const COPY_TRADE_GUIDE_COLLAPSED_KEY = "mcgbot.copyTrade.howItWorksCollapsed";

function persistGuideCollapsed(collapsed: boolean) {
  try {
    if (collapsed) localStorage.setItem(COPY_TRADE_GUIDE_COLLAPSED_KEY, "1");
    else localStorage.removeItem(COPY_TRADE_GUIDE_COLLAPSED_KEY);
  } catch {
    /* ignore quota / private mode */
  }
}
import type { CopySellRule } from "@/lib/copyTrade/sellRules";

type Strategy = {
  id: string;
  enabled: boolean;
  mirror_bot_calls_only: boolean;
  max_buy_lamports: string;
  max_buy_sol?: string;
  max_slippage_bps: number;
  min_call_mcap_usd: number | null;
  min_bot_win_rate_2x_pct: number | null;
  sell_rules: CopySellRule[] | unknown;
};

type IntentRow = {
  id: string;
  status: string;
  created_at: string;
  call_ca: string | null;
  detail: unknown;
  buy_signature?: string | null;
  buy_input_lamports?: string | number | null;
  error_message?: string | null;
  executor_wallet?: string | null;
  completed_at?: string | null;
};

type PositionRow = {
  id: string;
  intent_id: string;
  status: string;
  mint: string;
  next_rule_index: number;
  created_at: string;
  updated_at?: string | null;
  detail: unknown;
};

type Bot7dTier = { label: string; hitPct: number };

const BOT7D_PILL_STYLES = [
  {
    wrap: "border-emerald-500/45 bg-emerald-950/55",
    text: "text-emerald-300",
  },
  {
    wrap: "border-amber-400/50 bg-amber-950/45",
    text: "text-amber-200",
  },
  {
    wrap: "border-cyan-400/45 bg-cyan-950/40",
    text: "text-cyan-200",
  },
  {
    wrap: "border-sky-400/45 bg-sky-950/45",
    text: "text-sky-200",
  },
] as const;

function asSellRules(v: unknown): CopySellRule[] {
  if (!Array.isArray(v)) return [{ multiple: 2, sell_fraction: 1 }];
  const out: CopySellRule[] = [];
  for (const item of v) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const m = Number(o.multiple);
    const f = Number(o.sell_fraction);
    if (Number.isFinite(m) && Number.isFinite(f)) out.push({ multiple: m, sell_fraction: f });
  }
  return out.length ? out : [{ multiple: 2, sell_fraction: 1 }];
}

export function CopyTradeClient() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [strategy, setStrategy] = useState<Strategy | null>(null);
  const [intents, setIntents] = useState<IntentRow[]>([]);
  const [positions, setPositions] = useState<PositionRow[]>([]);

  const [enabled, setEnabled] = useState(false);
  const [mirrorBotOnly, setMirrorBotOnly] = useState(true);
  const [maxBuySol, setMaxBuySol] = useState("0");
  const [slippageBps, setSlippageBps] = useState(800);
  const [minMcap, setMinMcap] = useState("");
  const [minWin2x, setMinWin2x] = useState("");
  const [sellRules, setSellRules] = useState<CopySellRule[]>([{ multiple: 2, sell_fraction: 1 }]);
  const [wallet, setWallet] = useState<{ publicKey: string; balanceLamports: string } | null>(null);
  const [platformFeeOnSellBps, setPlatformFeeOnSellBps] = useState<number | null>(null);
  const [openPositionsCount, setOpenPositionsCount] = useState(0);
  const [walletBusy, setWalletBusy] = useState(false);
  const [withdrawDest, setWithdrawDest] = useState("");
  const [withdrawSol, setWithdrawSol] = useState("");
  const [bot7d, setBot7d] = useState<{ totalCalls: number; tiers: Bot7dTier[] } | null>(null);
  const [bot7dErr, setBot7dErr] = useState<string | null>(null);
  const [guideCollapsed, setGuideCollapsed] = useState(false);

  useLayoutEffect(() => {
    try {
      if (localStorage.getItem(COPY_TRADE_GUIDE_COLLAPSED_KEY) === "1") {
        setGuideCollapsed(true);
      }
    } catch {
      /* ignore */
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    setOkMsg(null);
    try {
      const res = await fetch("/api/me/copy-trade-strategy", { credentials: "same-origin", cache: "no-store" });
      const j = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        strategy?: Strategy;
        intents?: IntentRow[];
        positions?: PositionRow[];
        wallet?: { publicKey: string; balanceLamports: string } | null;
        platformFeeOnSellBps?: number;
        openPositionsCount?: number;
      };
      if (!res.ok) {
        setErr(typeof j.error === "string" ? j.error : "Could not load copy trade settings.");
        return;
      }
      const s = j.strategy;
      if (s) {
        setStrategy(s);
        setEnabled(s.enabled === true);
        setMirrorBotOnly(s.mirror_bot_calls_only !== false);
        setMaxBuySol(typeof s.max_buy_sol === "string" ? s.max_buy_sol : "0");
        setSlippageBps(s.max_slippage_bps ?? 800);
        setMinMcap(s.min_call_mcap_usd != null ? String(s.min_call_mcap_usd) : "");
        setMinWin2x(s.min_bot_win_rate_2x_pct != null ? String(s.min_bot_win_rate_2x_pct) : "");
        setSellRules(asSellRules(s.sell_rules));
      }
      setIntents(Array.isArray(j.intents) ? j.intents : []);
      setPositions(Array.isArray(j.positions) ? j.positions : []);
      setWallet(j.wallet && typeof j.wallet.publicKey === "string" ? j.wallet : null);
      setPlatformFeeOnSellBps(typeof j.platformFeeOnSellBps === "number" ? j.platformFeeOnSellBps : null);
      setOpenPositionsCount(typeof j.openPositionsCount === "number" ? j.openPositionsCount : 0);
    } catch {
      setErr("Could not load copy trade settings.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setBot7dErr(null);
      try {
        const res = await fetch("/api/copy-trade/bot-7d", { credentials: "same-origin", cache: "no-store" });
        const j = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          totalCalls?: number;
          tiers?: Bot7dTier[];
          error?: string;
        };
        if (cancelled) return;
        if (!res.ok || !j.ok) {
          setBot7d(null);
          setBot7dErr(typeof j.error === "string" ? j.error : "Could not load 7D bot stats.");
          return;
        }
        setBot7d({
          totalCalls: typeof j.totalCalls === "number" ? j.totalCalls : 0,
          tiers: Array.isArray(j.tiers) ? j.tiers : [],
        });
      } catch {
        if (!cancelled) {
          setBot7d(null);
          setBot7dErr("Could not load 7D bot stats.");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const save = useCallback(async () => {
    setSaving(true);
    setErr(null);
    setOkMsg(null);
    try {
      const minMcapN = minMcap.trim() === "" ? null : Number(minMcap);
      const minWrN = minWin2x.trim() === "" ? null : Number(minWin2x);
      const maxBuy = Number(maxBuySol);
      const res = await fetch("/api/me/copy-trade-strategy", {
        method: "PUT",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled,
          mirror_bot_calls_only: mirrorBotOnly,
          max_buy_sol: Number.isFinite(maxBuy) ? maxBuy : 0,
          max_slippage_bps: slippageBps,
          min_call_mcap_usd: minMcapN != null && Number.isFinite(minMcapN) ? minMcapN : null,
          min_bot_win_rate_2x_pct: minWrN != null && Number.isFinite(minWrN) ? minWrN : null,
          sell_rules: sellRules,
        }),
      });
      const j = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok) {
        setErr(typeof j.error === "string" ? j.error : "Save failed.");
        return;
      }
      setOkMsg("Saved.");
      await load();
    } catch {
      setErr("Save failed.");
    } finally {
      setSaving(false);
    }
  }, [enabled, mirrorBotOnly, maxBuySol, slippageBps, minMcap, minWin2x, sellRules, load]);

  const createWallet = useCallback(async () => {
    setWalletBusy(true);
    setErr(null);
    setOkMsg(null);
    try {
      const res = await fetch("/api/me/copy-trade-wallet", { method: "POST", credentials: "same-origin" });
      const j = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; publicKey?: string };
      if (!res.ok || !j.ok) {
        setErr(typeof j.error === "string" ? j.error : "Could not create wallet.");
        return;
      }
      setOkMsg("Copy trade wallet created. Send SOL to the address shown, then wait for confirmations.");
      await load();
    } catch {
      setErr("Could not create wallet.");
    } finally {
      setWalletBusy(false);
    }
  }, [load]);

  const withdraw = useCallback(async () => {
    setWalletBusy(true);
    setErr(null);
    setOkMsg(null);
    try {
      const sol = Number(withdrawSol);
      const res = await fetch("/api/me/copy-trade-withdraw", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ destination: withdrawDest.trim(), sol }),
      });
      const j = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; signature?: string };
      if (!res.ok || !j.ok) {
        setErr(typeof j.error === "string" ? j.error : "Withdraw failed.");
        return;
      }
      setOkMsg(j.signature ? `Withdraw sent. Tx ${j.signature.slice(0, 10)}…` : "Withdraw sent.");
      setWithdrawSol("");
      await load();
    } catch {
      setErr("Withdraw failed.");
    } finally {
      setWalletBusy(false);
    }
  }, [withdrawDest, withdrawSol, load]);

  const updateRule = (i: number, field: keyof CopySellRule, val: string) => {
    setSellRules((prev) => {
      const next = [...prev];
      const cur = { ...next[i] };
      if (field === "multiple") cur.multiple = Number(val);
      if (field === "sell_fraction") cur.sell_fraction = Number(val);
      next[i] = cur;
      return next;
    });
  };

  const addRule = () => setSellRules((p) => [...p, { multiple: 2, sell_fraction: 0.25 }]);
  const removeRule = (i: number) => setSellRules((p) => (p.length <= 1 ? p : p.filter((_, j) => j !== i)));

  const toggleGuideCollapsed = () => {
    setGuideCollapsed((prev) => {
      const next = !prev;
      persistGuideCollapsed(next);
      return next;
    });
  };

  return (
    <div className="mx-auto max-w-6xl px-4 pb-20 pt-4 sm:px-6 lg:px-8">
      <header className={`${terminalChrome.headerRule} pb-6 sm:pb-8`}>
        <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-amber-300/85">Workspace</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-50 sm:text-3xl">Copy trade</h1>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-zinc-400">
          Fund your personal copy-trade wallet, save rules, then enable matching. Buys and sells sign from{" "}
          <span className="text-zinc-200">your</span> custodial address—only SOL on that address can be spent. Details below.
        </p>
      </header>

      {err ? <p className="mt-4 text-sm text-red-300/90">{err}</p> : null}
      {okMsg ? <p className="mt-4 text-sm text-emerald-300/90">{okMsg}</p> : null}

      <div className={`mt-6 rounded-xl border border-amber-500/25 bg-amber-950/15 px-4 py-3 text-sm text-amber-100/95 sm:px-5`}>
        <p className="font-semibold text-amber-50">Risk &amp; legal</p>
        <p className="mt-1 text-xs leading-relaxed text-amber-100/85">
          Trading can result in total loss. Nothing here is investment advice or a promise of returns. By enabling copy trade you acknowledge
          experimental software, custody of funds on your copy-trade wallet, and market risk.
        </p>
      </div>

      <section
        className={`mt-6 rounded-2xl ${terminalSurface.panelCard} ${guideCollapsed ? "px-4 py-2.5 sm:px-5" : "relative p-5 sm:p-6"}`}
        aria-labelledby="copy-trade-guide-heading"
      >
        {guideCollapsed ? (
          <button
            type="button"
            onClick={toggleGuideCollapsed}
            className="flex w-full items-center justify-between gap-3 text-left"
            aria-expanded={false}
          >
            <span id="copy-trade-guide-heading" className="text-sm font-semibold text-zinc-100">
              How copy trade works
            </span>
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-zinc-700/80 bg-zinc-900/50 text-zinc-400">
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </span>
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={toggleGuideCollapsed}
              className="absolute right-4 top-4 rounded-md border border-transparent p-1.5 text-zinc-500 hover:border-zinc-700/60 hover:bg-zinc-900/40 hover:text-zinc-300 sm:right-5 sm:top-5"
              aria-expanded
              aria-controls="copy-trade-guide-content"
              aria-label="Collapse how copy trade works"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
              </svg>
            </button>
            <div id="copy-trade-guide-content">
              <h2 id="copy-trade-guide-heading" className="pr-10 text-sm font-semibold text-zinc-100 sm:pr-11">
                How copy trade works
              </h2>
              <p className="mt-2 text-xs leading-relaxed text-zinc-500">
                Nothing runs from the wallet you connect in the browser header. Buys and sells use McGBot&apos;s server-side execution wallet when
                automation is enabled for this deployment. You only edit and save your personal limits here.
              </p>

              <ol className="mt-5 space-y-3 text-sm leading-relaxed text-zinc-300">
                <li className="flex gap-3">
                  <span
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-[11px] font-bold text-amber-200/90 ring-1 ring-zinc-700/80"
                    aria-hidden
                  >
                    1
                  </span>
                  <span>
                    <span className="font-medium text-zinc-200">Create your wallet</span> (button in the panel below when you&apos;re ready), then{" "}
                    <span className="font-medium text-zinc-200">send SOL</span> to that address so buys can execute up to your max size.
                  </span>
                </li>
                <li className="flex gap-3">
                  <span
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-[11px] font-bold text-amber-200/90 ring-1 ring-zinc-700/80"
                    aria-hidden
                  >
                    2
                  </span>
                  <span>
                    <span className="font-medium text-zinc-200">Set your strategy</span>: max buy, slippage, optional filters, and{" "}
                    <span className="text-zinc-200">sell milestones</span>. Click <span className="font-medium text-zinc-200">Save strategy</span> after
                    changes. Turn <span className="font-medium text-zinc-200">Enabled</span> when you want matching; with{" "}
                    <span className="font-medium text-zinc-200">mirrored bot calls only</span> (recommended), only official bot signals count.
                  </span>
                </li>
                <li className="flex gap-3">
                  <span
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-[11px] font-bold text-amber-200/90 ring-1 ring-zinc-700/80"
                    aria-hidden
                  >
                    3
                  </span>
                  <span>
                    When a call passes your filters, a row appears under <span className="font-medium text-zinc-200">Recent intents</span>. The worker
                    spends <span className="text-zinc-200">only SOL in your copy-trade wallet</span> (up to your max buy and what balance allows after
                    buffers). <span className="text-zinc-200">Skipped</span> or <span className="text-zinc-200">failed</span> explains why no buy ran.
                  </span>
                </li>
                <li className="flex gap-3">
                  <span
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-[11px] font-bold text-amber-200/90 ring-1 ring-zinc-700/80"
                    aria-hidden
                  >
                    4
                  </span>
                  <span>
                    After a successful buy, an <span className="font-medium text-zinc-200">open position</span> shows under{" "}
                    <span className="font-medium text-zinc-200">Positions</span>. A background job compares live multiples to your milestones and may send
                    token→SOL sells over time (typically at most one sell action per position per run—exact timing is not guaranteed).
                  </span>
                </li>
                <li className="flex gap-3">
                  <span
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-[11px] font-bold text-amber-200/90 ring-1 ring-zinc-700/80"
                    aria-hidden
                  >
                    5
                  </span>
                  <span>
                    A <span className="font-medium text-zinc-200">platform fee on sells</span> (basis points) is set by the operator via server config,
                    not in the form. After qualifying milestone sells, a small SOL transfer may go to the configured fee recipient when rules allow.
                  </span>
                </li>
              </ol>

              <div className="mt-6 grid gap-4 border-t border-zinc-800/80 pt-5 sm:grid-cols-2">
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">What you should do</h3>
                  <ul className="mt-2 list-disc space-y-1.5 pl-4 text-xs leading-relaxed text-zinc-400">
                    <li>Save after every edit; confirm you see a success message.</li>
                    <li>Enable only when you accept the risk box above.</li>
                    <li>Use intents to confirm buys; use positions to confirm open size and sell progress.</li>
                    <li>Withdraw free SOL from your copy-trade wallet only when you have no open positions (use the withdraw form).</li>
                  </ul>
                </div>
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">What you can expect</h3>
                  <ul className="mt-2 list-disc space-y-1.5 pl-4 text-xs leading-relaxed text-zinc-400">
                    <li>No trades while the strategy is disabled or filters block a call.</li>
                    <li>Not every intent becomes a buy; rows can stay queued briefly, then complete or stop with a status.</li>
                    <li>Sells follow your milestone table in order; partial fills and market conditions can differ from a backtest.</li>
                    <li>On-chain links (Solscan) appear when the worker records a signature.</li>
                  </ul>
                </div>
              </div>
            </div>
          </>
        )}
      </section>

      {loading ? (
        <div className="mt-8 animate-pulse space-y-3">
          <div className="h-48 rounded-2xl bg-zinc-800/40" />
          <div className="h-32 rounded-2xl bg-zinc-800/30" />
        </div>
      ) : (
        <div className="mt-8 flex flex-col gap-8 lg:grid lg:grid-cols-12 lg:items-start lg:gap-10">
          <div className="min-w-0 space-y-6 lg:col-span-7">
            <div className={`rounded-2xl ${terminalSurface.panelCard} p-5 sm:p-6`}>
              <h2 className="text-sm font-semibold text-zinc-100">Your copy trade wallet</h2>
              <p className="mt-2 text-xs leading-relaxed text-zinc-500">
                One custodial Solana address per account. Deposits credit on-chain here; buys and milestone sells sign from this address only.
              </p>
              {!wallet ? (
                <div className="mt-4">
                  <button
                    type="button"
                    disabled={walletBusy}
                    onClick={() => void createWallet()}
                    className="rounded-xl border border-sky-500/35 bg-sky-950/25 px-4 py-2.5 text-sm font-semibold text-sky-100 hover:bg-sky-900/30 disabled:opacity-50"
                  >
                    {walletBusy ? "Working…" : "Create my copy trade wallet"}
                  </button>
                </div>
              ) : (
                <div className="mt-4 space-y-3">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Deposit address</p>
                    <p className="mt-1 break-all font-mono text-xs text-zinc-200">{wallet.publicKey}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">SOL balance (RPC)</p>
                    <p className="mt-1 text-sm tabular-nums text-zinc-100">
                      {(Number(wallet.balanceLamports) / 1e9).toLocaleString(undefined, { maximumFractionDigits: 6 })} SOL
                    </p>
                  </div>
                  <div className="border-t border-zinc-800/80 pt-4">
                    <p className="text-xs font-semibold text-zinc-300">Withdraw SOL</p>
                    <p className="mt-1 text-[10px] text-zinc-500">
                      Open positions: {openPositionsCount}. Withdraw is available only when this is 0.
                    </p>
                    <label className="mt-3 block text-[11px] font-semibold text-zinc-500">
                      Destination address
                      <input
                        value={withdrawDest}
                        onChange={(e) => setWithdrawDest(e.target.value)}
                        className={`mt-1 w-full ${terminalUi.formInput}`}
                        placeholder="Solana address"
                        disabled={openPositionsCount > 0 || walletBusy}
                      />
                    </label>
                    <label className="mt-2 block text-[11px] font-semibold text-zinc-500">
                      Amount (SOL)
                      <input
                        value={withdrawSol}
                        onChange={(e) => setWithdrawSol(e.target.value)}
                        className={`mt-1 w-full ${terminalUi.formInput}`}
                        inputMode="decimal"
                        placeholder="0.1"
                        disabled={openPositionsCount > 0 || walletBusy}
                      />
                    </label>
                    <button
                      type="button"
                      disabled={openPositionsCount > 0 || walletBusy || !withdrawDest.trim() || !withdrawSol.trim()}
                      onClick={() => void withdraw()}
                      className="mt-3 rounded-xl border border-amber-500/30 bg-amber-950/20 px-4 py-2 text-sm font-semibold text-amber-100 hover:bg-amber-900/25 disabled:opacity-40"
                    >
                      {walletBusy ? "Working…" : "Withdraw"}
                    </button>
                  </div>
                </div>
              )}
            </div>

        <div className={`space-y-6 rounded-2xl ${terminalSurface.panelCard} p-5 sm:p-6`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-zinc-100">Strategy</h2>
            <label className="flex items-center gap-2 text-sm text-zinc-300">
              <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="rounded border-zinc-600" />
              Enabled
            </label>
          </div>
          <p className="text-xs leading-relaxed text-zinc-500">
            Edit fields, then <span className="font-medium text-zinc-300">Save strategy</span>. Matching and execution use the saved snapshot—
            unsaved changes do not apply.
          </p>

          <label className="flex items-center gap-2 text-xs text-zinc-400">
            <input type="checkbox" checked={mirrorBotOnly} onChange={(e) => setMirrorBotOnly(e.target.checked)} className="rounded border-zinc-600" />
            Only react to mirrored <span className="text-zinc-200">bot</span> calls (recommended)
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-xs font-semibold text-zinc-400">
              Max buy (SOL)
              <input
                value={maxBuySol}
                onChange={(e) => setMaxBuySol(e.target.value)}
                className={`mt-1 ${terminalUi.formInput}`}
                inputMode="decimal"
                placeholder="0.05"
              />
            </label>
            <label className="block text-xs font-semibold text-zinc-400">
              Max slippage (bps)
              <input
                type="number"
                value={slippageBps}
                onChange={(e) => setSlippageBps(Number(e.target.value) || 0)}
                className={`mt-1 ${terminalUi.formInput}`}
              />
            </label>
            <label className="block text-xs font-semibold text-zinc-400">
              Min call mcap (USD, optional)
              <input
                value={minMcap}
                onChange={(e) => setMinMcap(e.target.value)}
                className={`mt-1 ${terminalUi.formInput}`}
                placeholder="e.g. 50000"
              />
            </label>
            <label className="block text-xs font-semibold text-zinc-400">
              Min bot 2× win rate % (optional)
              <input
                value={minWin2x}
                onChange={(e) => setMinWin2x(e.target.value)}
                className={`mt-1 ${terminalUi.formInput}`}
                placeholder="e.g. 40 — bot calls only, rolling 90d"
              />
            </label>
            <p className="sm:col-span-2 text-[10px] text-zinc-600">
              Uses the same ATH ≥ 2× definition as the dashboard. Only enforced on <span className="text-zinc-400">bot</span> signals;
              needs at least five eligible bot calls in the window before the threshold applies.
            </p>
            <p className="sm:col-span-2 text-[10px] text-zinc-500">
              Platform fee on milestone sells:{" "}
              <span className="font-mono text-zinc-400">{platformFeeOnSellBps != null ? `${platformFeeOnSellBps} bps` : "—"}</span>{" "}
              (operator-controlled, not editable here).
            </p>
          </div>

          <div>
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Sell milestones (from entry)</h3>
              <button type="button" onClick={addRule} className="text-xs font-semibold text-emerald-300/90 hover:underline">
                + Add step
              </button>
            </div>
            <p className="mt-1 text-[10px] leading-relaxed text-zinc-600">
              Steps run in list order. When price (via the worker&apos;s pricing source) reaches each multiple, it can sell the fraction of the
              remaining position for that step—see <span className="text-zinc-500">Positions</span> for what fired last.
            </p>
            <ul className="mt-2 space-y-2">
              {sellRules.map((r, i) => (
                <li key={i} className="flex flex-wrap items-end gap-2 rounded-lg border border-zinc-800/80 bg-zinc-950/50 p-3">
                  <label className="text-[11px] text-zinc-500">
                    Multiple (×)
                    <input
                      type="number"
                      step="0.01"
                      value={r.multiple}
                      onChange={(e) => updateRule(i, "multiple", e.target.value)}
                      className={`mt-0.5 w-24 ${terminalUi.formInput}`}
                    />
                  </label>
                  <label className="text-[11px] text-zinc-500">
                    Sell fraction (0–1]
                    <input
                      type="number"
                      step="0.05"
                      value={r.sell_fraction}
                      onChange={(e) => updateRule(i, "sell_fraction", e.target.value)}
                      className={`mt-0.5 w-24 ${terminalUi.formInput}`}
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => removeRule(i)}
                    disabled={sellRules.length <= 1}
                    className="ml-auto text-xs text-zinc-500 hover:text-red-300 disabled:opacity-30"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <button
            type="button"
            disabled={saving}
            onClick={() => void save()}
            className="rounded-xl border border-emerald-500/35 bg-emerald-950/30 px-4 py-2.5 text-sm font-semibold text-emerald-100 hover:bg-emerald-900/35 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save strategy"}
          </button>

          {strategy?.id ? (
            <p className="text-[10px] text-zinc-600">
              Strategy id <span className="font-mono text-zinc-500">{strategy.id}</span>
            </p>
          ) : null}
        </div>
          </div>

          <aside className="min-w-0 space-y-6 lg:col-span-5">
            <div className={`rounded-2xl ${terminalSurface.panelCard} p-4`}>
              <p className="text-[11px] font-medium text-zinc-400">
                7D Bot Hitrate
                {bot7d != null ? (
                  <>
                    {" "}
                    <span className="text-zinc-600">·</span> {bot7d.totalCalls} call{bot7d.totalCalls === 1 ? "" : "s"}
                  </>
                ) : null}
              </p>
              {bot7dErr ? (
                <p className="mt-2 text-[11px] text-amber-200/85">{bot7dErr}</p>
              ) : bot7d && bot7d.tiers.length > 0 ? (
                <div className="mt-2.5 flex flex-wrap gap-2">
                  {bot7d.tiers.map((t, i) => {
                    const st = BOT7D_PILL_STYLES[i % BOT7D_PILL_STYLES.length];
                    return (
                      <span
                        key={t.label}
                        className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold tabular-nums ${st.wrap} ${st.text}`}
                      >
                        {t.label} {t.hitPct}%
                      </span>
                    );
                  })}
                </div>
              ) : (
                <p className="mt-2 text-[11px] text-zinc-500">Loading rolling 7-day hit rates…</p>
              )}
              <p className="mt-2 text-[10px] leading-relaxed text-zinc-600">
                Eligible bot calls in the last 7 days: share that reached each ATH multiple. Backlogged calls age out of this window; use this as
                a rough risk lens, not a guarantee.
              </p>
            </div>

            <div className={`rounded-2xl ${terminalSurface.panelCard} p-5`}>
        <h2 className="text-sm font-semibold text-zinc-100">Positions</h2>
        <p className="mt-1 text-xs leading-relaxed text-zinc-500">
          Each row is a live or closed leg after a buy. <span className="text-zinc-400">Open</span> means size is still on-chain; the worker
          compares multiples to your milestones and may submit sells over time. Links appear when a sell or fee transfer lands.
        </p>
        {positions.length === 0 ? (
          <p className="mt-4 text-sm text-zinc-500">No positions yet.</p>
        ) : (
          <ul className="mt-4 space-y-2 text-sm">
            {positions.map((p) => {
              const d = p.detail && typeof p.detail === "object" && !Array.isArray(p.detail) ? (p.detail as Record<string, unknown>) : {};
              const lastSig = typeof d.last_sell_signature === "string" ? d.last_sell_signature : null;
              const feeSig = typeof d.last_fee_signature === "string" ? d.last_fee_signature : null;
              return (
                <li
                  key={p.id}
                  className="flex flex-col gap-1 rounded-lg border border-zinc-800/70 bg-zinc-950/40 px-3 py-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs text-zinc-400">
                      {p.mint ? `${p.mint.slice(0, 6)}…${p.mint.slice(-4)}` : "—"}
                    </span>
                    <span className="text-xs text-zinc-200">{p.status}</span>
                    {p.status === "open" ? (
                      <span className="text-[10px] text-zinc-500">next rule #{p.next_rule_index + 1}</span>
                    ) : null}
                  </div>
                  <div className="flex flex-col gap-0.5 text-[10px] text-zinc-500 sm:items-end sm:text-right">
                    {lastSig ? (
                      <a
                        className="font-mono text-sky-400/90 hover:underline"
                        href={`https://solscan.io/tx/${encodeURIComponent(lastSig)}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        last sell tx
                      </a>
                    ) : (
                      <span className="text-zinc-600">no sells yet</span>
                    )}
                    {feeSig ? (
                      <a
                        className="font-mono text-amber-400/85 hover:underline"
                        href={`https://solscan.io/tx/${encodeURIComponent(feeSig)}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        fee tx
                      </a>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
            </div>

            <div className={`rounded-2xl ${terminalSurface.panelCard} p-5`}>
        <h2 className="text-sm font-semibold text-zinc-100">Recent intents</h2>
        <p className="mt-1 text-xs leading-relaxed text-zinc-500">
          One row per matched call: <span className="text-zinc-400">queued</span> then <span className="text-zinc-400">processing</span>, then a
          terminal status. <span className="text-emerald-200/80">Completed</span> usually includes a Solscan buy link;{" "}
          <span className="text-amber-200/80">skipped</span> or <span className="text-red-200/80">failed</span> explains why no position opened.
        </p>
        {intents.length === 0 ? (
          <p className="mt-4 text-sm text-zinc-500">No intents yet.</p>
        ) : (
          <ul className="mt-4 space-y-2 text-sm">
            {intents.map((it) => (
              <li
                key={it.id}
                className="flex flex-col gap-1 rounded-lg border border-zinc-800/70 bg-zinc-950/40 px-3 py-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs text-zinc-400">
                    {it.call_ca ? `${it.call_ca.slice(0, 6)}…${it.call_ca.slice(-4)}` : "—"}
                  </span>
                  <span
                    className={`text-xs font-medium ${
                      it.status === "completed"
                        ? "text-emerald-200/90"
                        : it.status === "failed"
                          ? "text-red-300/90"
                          : it.status === "skipped"
                            ? "text-amber-200/85"
                            : "text-zinc-300"
                    }`}
                  >
                    {it.status}
                  </span>
                  <span className="text-[10px] text-zinc-500">{formatRelativeTime(it.created_at)}</span>
                </div>
                <div className="flex min-w-0 flex-col gap-0.5 text-[10px] text-zinc-500 sm:items-end sm:text-right">
                  {it.buy_signature ? (
                    <a
                      className="truncate font-mono text-emerald-400/90 hover:underline"
                      href={`https://solscan.io/tx/${encodeURIComponent(it.buy_signature)}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      tx {it.buy_signature.slice(0, 8)}…
                    </a>
                  ) : null}
                  {it.error_message ? (
                    <span className="line-clamp-2 max-w-[280px] text-red-300/80" title={it.error_message}>
                      {it.error_message}
                    </span>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
