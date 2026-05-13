"use client";

import type { CaAnalyzeCallRow, CaAnalyzeIntel, CaOutsideRow } from "@/lib/caAnalyzeIntel";
import { milestonesFromAthMultiple } from "@/lib/caAnalyzeIntel";
import { terminalUi } from "@/lib/terminalDesignTokens";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

function fmtUsd(n: number | null | undefined): string {
  const v = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(v) || v < 0) return "—";
  if (v === 0) return "$0";
  if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(2)}M`;
  if (v >= 1e3) return `$${(v / 1e3).toFixed(1)}k`;
  return `$${v.toFixed(0)}`;
}

function fmtMult(n: number | null | undefined): string {
  const v = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(v) || v <= 0) return "—";
  return `${v >= 10 ? v.toFixed(1) : v.toFixed(2)}×`;
}

/** Human-readable token age (FaSol `ageMinutes`). */
function fmtAgeFromMinutes(minutes: number | null | undefined): string {
  const m = typeof minutes === "number" ? minutes : Number(minutes);
  if (!Number.isFinite(m) || m < 0) return "—";
  if (m >= 1440 * 2) return `${Math.round(m / 1440)}d`;
  if (m >= 120) return `${Math.round(m / 60)}h`;
  if (m >= 60) {
    const h = m / 60;
    return Number.isInteger(h) ? `${h}h` : `${h.toFixed(1)}h`;
  }
  return `${Math.round(m)}m`;
}

function fmtTxCount(n: number | null | undefined): string {
  if (n == null) return "—";
  const v = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(v) || v < 0) return "—";
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1000) return `${(v / 1000).toFixed(2)}k`;
  return String(Math.round(v));
}

function fmtWhen(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function callKindLabel(kind: CaAnalyzeCallRow["callKind"]): string {
  if (kind === "bot") return "Bot";
  if (kind === "trusted_pro") return "Trusted Pro";
  return "User";
}

function callKindBadgeClass(kind: CaAnalyzeCallRow["callKind"]): string {
  if (kind === "bot") return "border-violet-500/40 bg-violet-500/10 text-violet-100";
  if (kind === "trusted_pro") return "border-amber-500/40 bg-amber-500/10 text-amber-100";
  return "border-sky-500/35 bg-sky-500/10 text-sky-100";
}

type FaSolParsed = {
  ticker?: string | null;
  tokenName?: string | null;
  stats?: {
    marketCap?: number | null;
    ath?: number | null;
    liquidity?: number | null;
    ageMinutes?: number | null;
    volume?: number | null;
    fiveMinChangePct?: number | null;
    fiveMinChangeIsInfinity?: boolean;
    fiveMinVol?: number | null;
    makers?: number | null;
    txBuys?: number | null;
    txSells?: number | null;
  };
  holders?: {
    holders?: number | null;
    top10Pct?: number | null;
    botsCount?: number | null;
    snipersCount?: number | null;
    freshCount?: number | null;
    freshPct?: number | null;
    bundlersCount?: number | null;
    bundlersPct?: number | null;
    devHoldPct?: number | null;
  };
  security?: { lpPct?: number | null; dexUnpaid?: boolean; dexPaid?: boolean; taxPct?: number | null };
};

function FaSolStatsCard({ parsed }: { parsed: FaSolParsed }) {
  const s = parsed.stats ?? {};
  const h = parsed.holders ?? {};
  const sec = parsed.security ?? {};
  const ageLabel = fmtAgeFromMinutes(s.ageMinutes ?? null);
  const fiveMinPctLabel =
    s.fiveMinChangeIsInfinity === true
      ? "+∞%"
      : s.fiveMinChangePct != null && Number.isFinite(s.fiveMinChangePct)
        ? `${s.fiveMinChangePct >= 0 ? "+" : ""}${s.fiveMinChangePct.toFixed(1)}%`
        : "—";
  const tiles: { label: string; value: string }[] = [
    { label: "Market cap", value: fmtUsd(s.marketCap ?? null) },
    { label: "ATH", value: fmtUsd(s.ath ?? null) },
    { label: "Liquidity", value: fmtUsd(s.liquidity ?? null) },
    { label: "24h vol (est.)", value: fmtUsd(s.volume ?? null) },
    { label: "5m Δ%", value: fiveMinPctLabel },
    { label: "5m vol", value: fmtUsd(s.fiveMinVol ?? null) },
    { label: "Makers", value: s.makers != null ? String(s.makers) : "—" },
    { label: "Buys / sells (TX)", value: `${fmtTxCount(s.txBuys ?? null)} / ${fmtTxCount(s.txSells ?? null)}` },
    { label: "Holders", value: h.holders != null ? String(h.holders) : "—" },
    { label: "Top 10%", value: h.top10Pct != null ? `${h.top10Pct.toFixed(1)}%` : "—" },
    { label: "Bots", value: h.botsCount != null ? String(h.botsCount) : "—" },
    { label: "Snipers", value: h.snipersCount != null ? String(h.snipersCount) : "—" },
    {
      label: "Fresh",
      value:
        h.freshCount != null
          ? h.freshPct != null
            ? `${h.freshCount} (${h.freshPct.toFixed(2)}%)`
            : String(h.freshCount)
          : "—",
    },
    {
      label: "Bundlers",
      value:
        h.bundlersCount != null
          ? h.bundlersPct != null
            ? `${h.bundlersCount} (${h.bundlersPct.toFixed(2)}%)`
            : String(h.bundlersCount)
          : "—",
    },
    { label: "Dev H %", value: h.devHoldPct != null ? `${h.devHoldPct.toFixed(2)}%` : "—" },
    { label: "LP %", value: sec.lpPct != null ? `${sec.lpPct.toFixed(1)}%` : "—" },
    { label: "Tax %", value: sec.taxPct != null ? `${sec.taxPct.toFixed(2)}%` : "—" },
    {
      label: "DEX",
      value: sec.dexUnpaid === true ? "Unpaid" : sec.dexPaid === true ? "Paid" : "—",
    },
  ];
  return (
    <div className="mt-4 rounded-xl border border-zinc-800/80 bg-gradient-to-b from-zinc-900/50 to-black/30 p-4 shadow-[inset_0_1px_0_0_rgba(63,63,70,0.2)]">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-400/80">FaSol scan</p>
          <div className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <p className="text-lg font-semibold tracking-tight text-white">
              {parsed.ticker ? `$${parsed.ticker}` : "Token"}{" "}
              {parsed.tokenName ? (
                <span className="text-sm font-normal text-zinc-400">— {parsed.tokenName}</span>
              ) : null}
            </p>
            {ageLabel !== "—" ? (
              <span className="shrink-0 rounded-md border border-amber-500/35 bg-amber-500/10 px-2 py-0.5 text-[11px] font-bold tabular-nums tracking-wide text-amber-100/95">
                Age {ageLabel}
              </span>
            ) : null}
          </div>
        </div>
        <span className="rounded-md border border-zinc-700/80 bg-zinc-950/80 px-2 py-1 text-[10px] font-medium text-zinc-500">
          Telegram relay
        </span>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {tiles.map((t) => (
          <div
            key={t.label}
            className="rounded-lg border border-zinc-800/70 bg-zinc-950/40 px-2.5 py-2 shadow-[inset_0_1px_0_0_rgba(63,63,70,0.12)]"
          >
            <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">{t.label}</p>
            <p className="mt-0.5 font-mono text-sm font-semibold tabular-nums text-zinc-100">{t.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function MilestoneStrip({ ath }: { ath: number | null }) {
  const hit = milestonesFromAthMultiple(ath);
  if (!hit.length) {
    return <p className="text-[11px] text-zinc-500">No milestone multiples recorded from ATH yet.</p>;
  }
  return (
    <div className="flex flex-wrap gap-1">
      {hit.map((m) => (
        <span
          key={m}
          className="rounded border border-[color:var(--accent)]/35 bg-[color:var(--accent)]/10 px-1.5 py-0.5 text-[10px] font-bold text-[color:var(--accent)]"
        >
          {m}
        </span>
      ))}
    </div>
  );
}

export function CaAnalyzerModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [ca, setCa] = useState("");
  const [loading, setLoading] = useState(false);
  const [intel, setIntel] = useState<CaAnalyzeIntel | null>(null);
  const [faSolParsed, setFaSolParsed] = useState<FaSolParsed | null>(null);
  const [faSolNote, setFaSolNote] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const closeModal = useCallback(() => {
    if (typeof document !== "undefined") {
      const a = document.activeElement;
      if (a instanceof HTMLElement && a.closest('[role="dialog"]')) {
        a.blur();
      }
    }
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (open) {
      setCa("");
      setIntel(null);
      setFaSolParsed(null);
      setFaSolNote(null);
      setErr(null);
      setLoading(false);
    }
  }, [open]);

  const runAnalyze = useCallback(async () => {
    const trimmed = ca.trim();
    if (!trimmed || loading) return;
    setLoading(true);
    setErr(null);
    setIntel(null);
    setFaSolParsed(null);
    setFaSolNote(null);
    try {
      const res = await fetch("/api/me/ca-analyze", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ca: trimmed }),
      });
      const j = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        intel?: CaAnalyzeIntel;
        faSol?: { ok: true; parsed: unknown } | { ok: false; error: string } | { ok: null; skipped: true; reason: string };
      };
      if (!res.ok || !j.ok) {
        setErr(typeof j.error === "string" ? j.error : `Request failed (${res.status})`);
        return;
      }
      if (j.intel) setIntel(j.intel);
      const fs = j.faSol;
      if (fs && "skipped" in fs && fs.skipped) {
        setFaSolNote(fs.reason);
      } else if (fs && "ok" in fs && fs.ok === true && fs.parsed && typeof fs.parsed === "object") {
        setFaSolParsed(fs.parsed as FaSolParsed);
      } else if (fs && "ok" in fs && fs.ok === false) {
        setFaSolNote(fs.error);
      }
    } catch {
      setErr("Network error.");
    } finally {
      setLoading(false);
    }
  }, [ca, loading]);

  if (!open) return null;

  const dexUrl = intel?.mint
    ? `https://dexscreener.com/solana/${encodeURIComponent(intel.mint)}`
    : ca.trim()
      ? `https://dexscreener.com/solana/${encodeURIComponent(ca.trim())}`
      : null;

  return (
    <div
      className={terminalUi.modalBackdropZ100}
      role="dialog"
      aria-modal="true"
      aria-label="CA Analyzer"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) closeModal();
      }}
    >
      <div className={terminalUi.modalPanel3xlWide}>
        <div className="flex items-start justify-between gap-3 border-b border-zinc-800/70 pb-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-cyan-400/85">McGBot Terminal</p>
            <h2 className="mt-1 text-lg font-semibold tracking-tight text-white">CA Analyzer</h2>
            <p className="mt-1 max-w-2xl text-xs leading-relaxed text-zinc-500">
              Inspect a mint with a FaSol-style snapshot (posted to the dedicated analyzer Telegram channel) plus every
              dashboard call, outside signal, and your watchlist flags — without submitting a call.
            </p>
          </div>
          <button type="button" onClick={closeModal} className={terminalUi.modalCloseIconBtn} aria-label="Close">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-4 w-4"
              aria-hidden
            >
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1">
            <label htmlFor="ca-analyzer-input" className="sr-only">
              Contract address
            </label>
            <input
              id="ca-analyzer-input"
              type="text"
              value={ca}
              onChange={(e) => setCa(e.target.value)}
              placeholder="Solana mint or DexScreener Solana URL…"
              className={terminalUi.formInput}
              autoFocus
              disabled={loading}
              onKeyDown={(e) => {
                if (e.key === "Enter") void runAnalyze();
              }}
            />
          </div>
          <div className="flex shrink-0 justify-end gap-2">
            <button type="button" onClick={closeModal} className={terminalUi.secondaryButtonSm} disabled={loading}>
              Close
            </button>
            <button
              type="button"
              onClick={() => void runAnalyze()}
              disabled={loading || !ca.trim()}
              className="rounded-md bg-[color:var(--accent)] px-4 py-2 text-xs font-semibold text-black shadow-lg shadow-black/40 transition hover:bg-green-500 disabled:opacity-50"
            >
              {loading ? "Analyzing…" : "Analyze"}
            </button>
          </div>
        </div>

        {err ? (
          <p className="mt-4 rounded-lg border border-red-500/35 bg-red-950/30 px-3 py-2 text-sm text-red-200">{err}</p>
        ) : null}

        {intel || faSolParsed || faSolNote ? (
          <div className="mt-5 max-h-[min(68vh,720px)] space-y-5 overflow-y-auto pr-1">
            {intel ? (
              <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-400">
                <span className="font-mono text-[11px] text-zinc-200">{intel.mint}</span>
                {intel.onUserPrivateWatchlist ? (
                  <span className="rounded-full border border-zinc-600 bg-zinc-900/60 px-2 py-0.5 font-semibold text-zinc-200">
                    On your private watchlist
                  </span>
                ) : null}
                {intel.onUserPublicWatchlist ? (
                  <span className="rounded-full border border-zinc-600 bg-zinc-900/60 px-2 py-0.5 font-semibold text-zinc-200">
                    On your public board list
                  </span>
                ) : null}
                {dexUrl ? (
                  <Link
                    href={dexUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-auto font-semibold text-cyan-400/90 underline-offset-2 hover:underline"
                  >
                    Dexscreener →
                  </Link>
                ) : null}
              </div>
            ) : null}

            {faSolParsed ? <FaSolStatsCard parsed={faSolParsed} /> : null}
            {faSolNote && !faSolParsed ? (
              <p className="rounded-lg border border-amber-500/30 bg-amber-950/25 px-3 py-2 text-xs text-amber-100/90">
                {faSolNote}
              </p>
            ) : null}

            {intel && intel.outsideCalls.length > 0 ? (
              <section>
                <h3 className="text-sm font-semibold text-white">Outside calls</h3>
                <p className="mt-0.5 text-[11px] text-zinc-500">Monitored X sources that posted this mint.</p>
                <ul className="mt-2 space-y-2">
                  {intel.outsideCalls.map((o: CaOutsideRow) => (
                    <li
                      key={o.id}
                      className="rounded-lg border border-emerald-500/25 bg-emerald-500/[0.07] px-3 py-2 text-xs text-zinc-200"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-semibold text-emerald-100/95">Outside</span>
                        <span className="text-[10px] uppercase tracking-wide text-zinc-500">{o.callRole}</span>
                      </div>
                      <p className="mt-1 text-[11px] text-zinc-400">
                        {o.sourceDisplayName ?? "Source"}{" "}
                        {o.sourceHandle ? (
                          <span className="font-mono text-zinc-500">@{o.sourceHandle}</span>
                        ) : null}
                        {" · "}
                        {fmtWhen(o.postedAt)}
                      </p>
                      {o.xPostUrl ? (
                        <a
                          href={o.xPostUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-1 inline-block text-[11px] font-semibold text-cyan-400/90 hover:underline"
                        >
                          Open post →
                        </a>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {intel && intel.calls.length > 0 ? (
              <section>
                <h3 className="text-sm font-semibold text-white">Dashboard call history</h3>
                <p className="mt-0.5 text-[11px] text-zinc-500">
                  {intel.calls.length} row{intel.calls.length === 1 ? "" : "s"} on McGBot call performance for this mint.
                </p>
                <div className="mt-2 overflow-x-auto rounded-xl border border-zinc-800/80">
                  <table className="w-full min-w-[640px] border-collapse text-left text-xs">
                    <thead>
                      <tr className="border-b border-zinc-800 bg-black/35 text-[10px] font-bold uppercase tracking-wide text-zinc-500">
                        <th className="px-3 py-2">Type</th>
                        <th className="px-3 py-2">When</th>
                        <th className="px-3 py-2">Caller</th>
                        <th className="px-3 py-2">Call MC</th>
                        <th className="px-3 py-2">ATH ×</th>
                        <th className="px-3 py-2">Live ×</th>
                        <th className="px-3 py-2">Milestones</th>
                        <th className="px-3 py-2">Flags</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/70">
                      {intel.calls.map((c: CaAnalyzeCallRow) => (
                        <tr key={c.id} className="bg-zinc-950/30">
                          <td className="px-3 py-2 align-top">
                            <span
                              className={`inline-flex rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${callKindBadgeClass(c.callKind)}`}
                            >
                              {callKindLabel(c.callKind)}
                            </span>
                          </td>
                          <td className="px-3 py-2 align-top text-zinc-400">{fmtWhen(c.callTime)}</td>
                          <td className="px-3 py-2 align-top">
                            <div className="font-medium text-zinc-100">{c.displayName ?? c.username}</div>
                            {c.displayName && c.username && c.displayName !== c.username ? (
                              <div className="text-[10px] text-zinc-500">@{c.username.replace(/^@/, "")}</div>
                            ) : null}
                            <div className="font-mono text-[10px] text-zinc-600">{c.discordId}</div>
                          </td>
                          <td className="px-3 py-2 align-top font-mono tabular-nums text-zinc-200">
                            {fmtUsd(c.callMarketCapUsd)}
                          </td>
                          <td className="px-3 py-2 align-top font-mono tabular-nums text-[color:var(--accent)]">
                            {fmtMult(c.athMultiple)}
                          </td>
                          <td className="px-3 py-2 align-top font-mono tabular-nums text-zinc-300">
                            {fmtMult(c.spotMultiple)}
                          </td>
                          <td className="max-w-[140px] px-3 py-2 align-top">
                            <MilestoneStrip ath={c.athMultiple} />
                          </td>
                          <td className="px-3 py-2 align-top text-[10px] text-zinc-500">
                            {c.excludedFromStats ? <div>Excluded from stats</div> : null}
                            {c.hiddenFromDashboard ? <div>Hidden from dashboard</div> : null}
                            {!c.excludedFromStats && !c.hiddenFromDashboard && !c.messageUrl ? (
                              <span className="text-zinc-600">—</span>
                            ) : null}
                            {c.messageUrl ? (
                              <a
                                href={c.messageUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={`inline-block font-semibold text-cyan-400/90 hover:underline ${
                                  c.excludedFromStats || c.hiddenFromDashboard ? "mt-1" : ""
                                }`}
                              >
                                Jump →
                              </a>
                            ) : null}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            ) : intel && intel.calls.length === 0 && intel.outsideCalls.length === 0 ? (
              <p className="text-sm text-zinc-500">
                No dashboard call rows or outside signals for this mint yet. FaSol data (if available) still applies
                above.
              </p>
            ) : null}
          </div>
        ) : null}

        <p className="mt-4 text-[11px] leading-relaxed text-zinc-600">
          Press <kbd className="rounded border border-zinc-700 bg-zinc-900 px-1 font-mono text-zinc-400">/</kbd> from
          anywhere on the dashboard to open this module.
        </p>
      </div>
    </div>
  );
}
