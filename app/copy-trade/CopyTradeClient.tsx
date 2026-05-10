"use client";

import { terminalChrome, terminalSurface, terminalUi } from "@/lib/terminalDesignTokens";
import { formatRelativeTime } from "@/lib/modUiUtils";
import { useCallback, useEffect, useState } from "react";
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
  fee_on_sell_bps: number;
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
  const [feeBps, setFeeBps] = useState(100);
  const [sellRules, setSellRules] = useState<CopySellRule[]>([{ multiple: 2, sell_fraction: 1 }]);

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
        setFeeBps(s.fee_on_sell_bps ?? 100);
        setSellRules(asSellRules(s.sell_rules));
      }
      setIntents(Array.isArray(j.intents) ? j.intents : []);
      setPositions(Array.isArray(j.positions) ? j.positions : []);
    } catch {
      setErr("Could not load copy trade settings.");
    } finally {
      setLoading(false);
    }
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
          fee_on_sell_bps: feeBps,
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
  }, [enabled, mirrorBotOnly, maxBuySol, slippageBps, minMcap, minWin2x, feeBps, sellRules, load]);

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

  return (
    <div className="mx-auto max-w-6xl px-4 pb-20 pt-4 sm:px-6 lg:px-8">
      <header className={`${terminalChrome.headerRule} pb-6 sm:pb-8`}>
        <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-amber-300/85">Workspace</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-50 sm:text-3xl">Copy trade</h1>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-zinc-400">
          Save rules for size, risk, and exits. Eligible <span className="text-zinc-200">bot</span> calls become <span className="text-zinc-200">intents</span>; the
          server may execute buys and later sells when automation is enabled. Details below.
        </p>
      </header>

      {err ? <p className="mt-4 text-sm text-red-300/90">{err}</p> : null}
      {okMsg ? <p className="mt-4 text-sm text-emerald-300/90">{okMsg}</p> : null}

      <div className={`mt-6 rounded-xl border border-amber-500/25 bg-amber-950/15 px-4 py-3 text-sm text-amber-100/95 sm:px-5`}>
        <p className="font-semibold text-amber-50">Risk &amp; legal</p>
        <p className="mt-1 text-xs leading-relaxed text-amber-100/85">
          Trading can result in total loss. Nothing here is investment advice or a promise of returns. By enabling copy trade you acknowledge
          experimental software, custody of funds on the execution wallet, and market risk.
        </p>
      </div>

      <section
        className={`mt-6 rounded-2xl ${terminalSurface.panelCard} p-5 sm:p-6`}
        aria-labelledby="copy-trade-guide-heading"
      >
        <h2 id="copy-trade-guide-heading" className="text-sm font-semibold text-zinc-100">
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
              <span className="font-medium text-zinc-200">Set your strategy</span> on the left: max buy, slippage, optional filters (mcap, bot
              2× win rate), and <span className="text-zinc-200">sell milestones</span> (for example sell 50% at 2× from entry). Click{" "}
              <span className="font-medium text-zinc-200">Save strategy</span> after changes. Rules are not active until they are saved.
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
              Turn <span className="font-medium text-zinc-200">Enabled</span> on when you want matching to run. With{" "}
              <span className="font-medium text-zinc-200">Only react to mirrored bot calls</span> (recommended), only official{" "}
              <span className="text-zinc-200">bot</span> signals count—not every feed item.
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
              When a call passes your filters, a row appears under <span className="font-medium text-zinc-200">Recent intents</span>{" "}
              (queued → processing → completed, failed, or skipped). <span className="text-zinc-200">Skipped</span> usually means the worker
              decided not to trade (limits, liquidity, or safety checks). <span className="text-zinc-200">Failed</span> shows an error hint when
              one is available.
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
              If you set a <span className="font-medium text-zinc-200">platform fee on sells</span>, a separate small SOL transfer may run after
              qualifying sells when a fee recipient is configured on the server. If none is configured, that fee step is skipped.
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
              <li>Automated buys use SOL on the server&apos;s execution wallet, not the wallet you connect in the header—those balances are separate.</li>
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
      </section>

      {loading ? (
        <div className="mt-8 animate-pulse space-y-3">
          <div className="h-48 rounded-2xl bg-zinc-800/40" />
          <div className="h-32 rounded-2xl bg-zinc-800/30" />
        </div>
      ) : (
        <div className="mt-8 flex flex-col gap-8 lg:grid lg:grid-cols-12 lg:items-start lg:gap-10">
          <div className="min-w-0 space-y-6 lg:col-span-7">
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
            <label className="block text-xs font-semibold text-zinc-400">
              Platform fee on sells (bps)
              <input
                type="number"
                value={feeBps}
                onChange={(e) => setFeeBps(Number(e.target.value) || 0)}
                className={`mt-1 ${terminalUi.formInput}`}
              />
              <span className="mt-1 block text-[10px] font-normal text-zinc-600">
                After each milestone sell, a separate SOL transfer may send this share to the platform fee recipient configured on the server
                (minimum transfer rules apply). If no recipient is configured, the fee transfer is skipped.
              </span>
            </label>
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
