"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type MouseEvent } from "react";
import { formatRelativeTime } from "@/lib/modUiUtils";
import { terminalPage, terminalSurface } from "@/lib/terminalDesignTokens";

type ActivityToken = {
  mint: string;
  found: boolean;
  symbol: string | null;
  name: string | null;
  imageUrl: string | null;
};

type ActivityRow = {
  signature: string;
  blockTime: number | null;
  tokens: ActivityToken[];
  explorerUrl: string;
};

type ActivityPayload = {
  linked: boolean;
  walletPubkey?: string;
  rows: ActivityRow[];
  hint?: string;
};

function blockTimeIso(blockTime: number | null): string | null {
  if (blockTime == null || !Number.isFinite(blockTime)) return null;
  return new Date(blockTime * 1000).toISOString();
}

function formatBlockLocal(blockTime: number | null): string {
  if (blockTime == null || !Number.isFinite(blockTime)) return "—";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "short",
    timeStyle: "medium",
  }).format(new Date(blockTime * 1000));
}

function tokenLabel(t: ActivityToken): string {
  const sym = (t.symbol || "").trim();
  const name = (t.name || "").trim();
  if (sym) return sym;
  if (name) return name;
  return `${t.mint.slice(0, 4)}…${t.mint.slice(-4)}`;
}

function ExternalLinkIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M14 3h7v7M10 14L21 3M21 14v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export type TradeJournalWalletActivityProps = {
  onStartDraft: (args: { mint: string; label: string }) => void;
};

export function TradeJournalWalletActivity({ onStartDraft }: TradeJournalWalletActivityProps) {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [payload, setPayload] = useState<ActivityPayload | null>(null);
  const [copiedMint, setCopiedMint] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch("/api/me/wallet/token-activity", { credentials: "same-origin", cache: "no-store" });
      const json = (await res.json().catch(() => ({}))) as ActivityPayload & { error?: string };
      if (!res.ok) {
        setPayload(null);
        setErr(typeof json.error === "string" ? json.error : "Could not load activity.");
        return;
      }
      setPayload({
        linked: Boolean(json.linked),
        walletPubkey: typeof json.walletPubkey === "string" ? json.walletPubkey : undefined,
        rows: Array.isArray(json.rows) ? (json.rows as ActivityRow[]) : [],
        hint: typeof json.hint === "string" ? json.hint : undefined,
      });
    } catch {
      setPayload(null);
      setErr("Could not load activity.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const copyMint = useCallback((mint: string, ev: MouseEvent) => {
    ev.preventDefault();
    ev.stopPropagation();
    void navigator.clipboard.writeText(mint).then(() => {
      setCopiedMint(mint);
      window.setTimeout(() => setCopiedMint((m) => (m === mint ? null : m)), 1600);
    });
  }, []);

  return (
    <section
      className={`${terminalSurface.insetPanel} ${terminalSurface.insetEdgeSoft} px-4 py-4 sm:px-5 sm:py-5`}
      aria-label="Wallet activity"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold tracking-tight text-zinc-50">Wallet activity</h2>
          <p className={`${terminalPage.sectionHint} mt-1 max-w-[20rem] leading-relaxed`}>
            Recent SPL touches from your linked wallet. Tap a token to open a new entry with that mint.
          </p>
        </div>
        <span className="flex shrink-0 items-center gap-1.5 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-200/90">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-40 motion-reduce:animate-none" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
          </span>
          Live
        </span>
      </div>

      <div className="mt-4">
        {loading ? (
          <p className="py-6 text-center text-xs text-zinc-500">Loading…</p>
        ) : err ? (
          <p className="rounded-lg border border-red-500/25 bg-red-950/20 px-3 py-2 text-xs text-red-200/90">{err}</p>
        ) : !payload?.linked ? (
          <div className="rounded-lg border border-dashed border-zinc-700/60 bg-zinc-950/40 px-3 py-4 text-center">
            <p className="text-xs font-medium text-zinc-400">No linked wallet</p>
            <p className="mt-1 text-[11px] leading-snug text-zinc-600">
              Link a wallet from the dashboard to see touches here.
            </p>
            <Link
              href="/"
              className="mt-3 inline-block text-[11px] font-semibold text-[color:var(--accent)] hover:underline"
            >
              Go to dashboard
            </Link>
          </div>
        ) : payload.rows.length === 0 ? (
          <p className="py-6 text-center text-xs text-zinc-500">No recent SPL activity yet.</p>
        ) : (
          <ul className="space-y-2">
            {payload.rows.map((row) => {
              const iso = blockTimeIso(row.blockTime);
              const rel = formatRelativeTime(iso);
              return (
                <li
                  key={row.signature}
                  className="rounded-xl border border-zinc-800/50 bg-zinc-950/35 px-3 py-2.5 transition-colors hover:border-zinc-700/70 hover:bg-zinc-900/40"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800/40 pb-2">
                    <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
                      <span className="text-[11px] font-semibold tabular-nums text-emerald-400/95">{rel}</span>
                      <span className="truncate text-[10px] text-zinc-500">{formatBlockLocal(row.blockTime)}</span>
                    </div>
                    <a
                      href={row.explorerUrl}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold text-sky-400/95 transition hover:bg-sky-500/10 hover:text-sky-300"
                      onClick={(e) => e.stopPropagation()}
                      aria-label="View transaction on explorer"
                    >
                      Tx
                      <ExternalLinkIcon className="opacity-90" />
                    </a>
                  </div>
                  <div className="mt-2 flex flex-col gap-1.5">
                    {row.tokens.map((t) => {
                      const label = tokenLabel(t);
                      return (
                        <div key={t.mint} className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => onStartDraft({ mint: t.mint.trim(), label })}
                            className={`${terminalPage.denseInsetRowButton} min-w-0 flex-1 items-center gap-2.5 py-2 pl-2 pr-2`}
                          >
                            <span className="relative h-9 w-9 shrink-0 overflow-hidden rounded-lg border border-zinc-700/60 bg-zinc-900">
                              {t.imageUrl ? (
                                <img
                                  src={t.imageUrl}
                                  alt=""
                                  className="h-full w-full object-cover"
                                  loading="lazy"
                                  referrerPolicy="no-referrer"
                                  onError={(ev) => {
                                    (ev.target as HTMLImageElement).style.display = "none";
                                  }}
                                />
                              ) : (
                                <span className="flex h-full w-full items-center justify-center text-[10px] font-bold text-zinc-600">
                                  ?
                                </span>
                              )}
                            </span>
                            <span className="min-w-0 flex-1 text-left">
                              <span className="block truncate text-sm font-semibold text-zinc-100">{label}</span>
                              {(t.name || "").trim() && (t.symbol || "").trim() && (t.name || "").trim() !== label ? (
                                <span className="block truncate text-[10px] text-zinc-500">{t.name}</span>
                              ) : (
                                <span className="block truncate font-mono text-[10px] text-zinc-600">
                                  {t.mint.slice(0, 4)}…{t.mint.slice(-4)}
                                </span>
                              )}
                            </span>
                          </button>
                          <button
                            type="button"
                            title="Copy mint"
                            onClick={(e) => copyMint(t.mint, e)}
                            className="shrink-0 rounded-md border border-zinc-700/80 bg-zinc-900/50 px-2 py-1.5 text-[10px] font-bold uppercase tracking-wide text-zinc-400 transition hover:border-zinc-600 hover:bg-zinc-800/80 hover:text-zinc-200"
                          >
                            {copiedMint === t.mint ? "OK" : "CA"}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {payload?.hint ? <p className="mt-4 text-[10px] leading-relaxed text-zinc-600">{payload.hint}</p> : null}

      {!loading && payload?.linked ? (
        <button
          type="button"
          onClick={() => void load()}
          className="mt-3 w-full rounded-lg border border-zinc-800/80 py-1.5 text-[11px] font-medium text-zinc-500 transition hover:border-zinc-700 hover:bg-zinc-900/40 hover:text-zinc-300"
        >
          Refresh
        </button>
      ) : null}
    </section>
  );
}
