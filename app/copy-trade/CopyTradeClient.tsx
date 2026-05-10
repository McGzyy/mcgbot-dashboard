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
    <div className="mx-auto max-w-3xl px-4 pb-20 pt-4 sm:px-6">
      <header className={`${terminalChrome.headerRule} pb-8`}>
        <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-amber-300/85">Workspace</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-50">Copy trade (bot calls)</h1>
        <p className="mt-2 text-sm leading-relaxed text-zinc-400">
          Phase 1 records when you <span className="text-zinc-200">would</span> follow a mirrored bot call under your rules. Deposits, vaults, and on-chain swaps are{" "}
          <span className="font-medium text-amber-200/90">not live</span> yet — this builds the strategy + intent ledger first.
        </p>
      </header>

      <div className={`rounded-xl border border-amber-500/25 bg-amber-950/15 px-4 py-3 text-sm text-amber-100/95`}>
        <p className="font-semibold text-amber-50">Risk &amp; legal</p>
        <p className="mt-1 text-xs leading-relaxed text-amber-100/85">
          Trading can result in total loss. Nothing here is investment advice or a promise of returns. By enabling rules you acknowledge
          experimental software and market risk.
        </p>
      </div>

      {err ? <p className="mt-4 text-sm text-red-300/90">{err}</p> : null}
      {okMsg ? <p className="mt-4 text-sm text-emerald-300/90">{okMsg}</p> : null}

      {loading ? (
        <div className="mt-8 animate-pulse space-y-3">
          <div className="h-40 rounded-xl bg-zinc-800/40" />
        </div>
      ) : (
        <div className={`mt-8 space-y-6 rounded-2xl ${terminalSurface.panelCard} p-5`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-zinc-100">Strategy</h2>
            <label className="flex items-center gap-2 text-sm text-zinc-300">
              <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="rounded border-zinc-600" />
              Enabled
            </label>
          </div>

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
              Min bot 2× win rate % (optional, reserved)
              <input
                value={minWin2x}
                onChange={(e) => setMinWin2x(e.target.value)}
                className={`mt-1 ${terminalUi.formInput}`}
                placeholder="e.g. 90 — wiring later"
              />
            </label>
            <label className="block text-xs font-semibold text-zinc-400">
              Platform fee on sells (bps)
              <input
                type="number"
                value={feeBps}
                onChange={(e) => setFeeBps(Number(e.target.value) || 0)}
                className={`mt-1 ${terminalUi.formInput}`}
              />
            </label>
          </div>

          <div>
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Sell milestones (from entry)</h3>
              <button type="button" onClick={addRule} className="text-xs font-semibold text-emerald-300/90 hover:underline">
                + Add step
              </button>
            </div>
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
      )}

      <div className={`mt-8 rounded-2xl ${terminalSurface.panelCard} p-5`}>
        <h2 className="text-sm font-semibold text-zinc-100">Recent intents</h2>
        <p className="mt-1 text-xs text-zinc-500">Queued rows mean your filters matched a new bot call signal (execution still pending in later phase).</p>
        {intents.length === 0 ? (
          <p className="mt-4 text-sm text-zinc-500">No intents yet.</p>
        ) : (
          <ul className="mt-4 space-y-2 text-sm">
            {intents.map((it) => (
              <li key={it.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-zinc-800/70 bg-zinc-950/40 px-3 py-2">
                <span className="font-mono text-xs text-zinc-400">{it.call_ca ? `${it.call_ca.slice(0, 6)}…${it.call_ca.slice(-4)}` : "—"}</span>
                <span className="text-xs text-emerald-200/90">{it.status}</span>
                <span className="text-[10px] text-zinc-500">{formatRelativeTime(it.created_at)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
