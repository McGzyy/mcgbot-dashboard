"use client";

import { PanelCard } from "@/app/components/PanelCard";
import { terminalSurface } from "@/lib/terminalDesignTokens";
import type { CSSProperties } from "react";
import { dexscreenerTokenUrl } from "@/lib/modUiUtils";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

type FeedRow = {
  id: string;
  discord_id: string;
  mint: string;
  status: string;
  hold_since: string | null;
  submitted_at: string;
  token_symbol: string | null;
  priceChangePctTf: number | null;
  price_change_pct: number | null;
};

/** Viewport wide enough for a fixed dock that sits only in the gutter past `max-w-[1200px]` home shell. */
const FIXED_HODL_MQ = "(min-width: 1536px)";

function shortMint(m: string): string {
  const s = m.trim();
  if (s.length <= 12) return s;
  return `${s.slice(0, 4)}…${s.slice(-4)}`;
}

function holdLabel(iso: string | null): string {
  if (!iso) return "—";
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "—";
  const days = Math.floor((Date.now() - t) / (24 * 60 * 60 * 1000));
  if (days < 1) return "<1d";
  if (days === 1) return "1d";
  return `${days}d`;
}

function formatPct(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  const abs = Math.abs(n);
  const d = abs >= 100 ? 0 : abs >= 10 ? 1 : 2;
  const s = n.toFixed(d);
  return n > 0 ? `+${s}%` : `${s}%`;
}

function pnlTone(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "text-zinc-400";
  if (n > 0) return "text-emerald-300/95";
  if (n < 0) return "text-red-400/90";
  return "text-zinc-300";
}

function useWideFixedHodlDock() {
  const [wide, setWide] = useState(
    () => typeof window !== "undefined" && window.matchMedia(FIXED_HODL_MQ).matches
  );

  useEffect(() => {
    const mq = window.matchMedia(FIXED_HODL_MQ);
    const apply = () => setWide(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  return wide;
}

export function HodlDashboardDock() {
  const { data: session, status } = useSession();
  const myId = session?.user?.id?.trim() ?? "";
  const [rows, setRows] = useState<FeedRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const wideFixedDock = useWideFixedHodlDock();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/hodl/feed?tf=24h", {
        credentials: "same-origin",
        cache: "no-store",
      });
      const j = (await res.json().catch(() => ({}))) as { rows?: FeedRow[] };
      if (!res.ok) {
        setRows([]);
        return;
      }
      setRows(Array.isArray(j.rows) ? j.rows : []);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (status !== "authenticated") return;
    if (session?.user?.hasDashboardAccess !== true) return;
    void load();
    const t = window.setInterval(() => void load(), 90_000);
    return () => window.clearInterval(t);
  }, [status, session?.user?.hasDashboardAccess, load]);

  const myRows = useMemo(() => {
    return rows.filter(
      (r) =>
        r.discord_id === myId &&
        (r.status === "live" || r.status === "pending_hold")
    );
  }, [rows, myId]);

  const count = myRows.length;

  if (!mounted || status !== "authenticated") return null;
  if (session?.user?.hasDashboardAccess !== true) return null;
  if (loading) return null;
  if (count === 0) return null;

  const panel = (
    <PanelCard
      title="HODL"
      titleClassName="normal-case"
      paddingClassName="px-3 py-2.5 sm:px-3.5 sm:py-3"
      titleRight={
        <span className="rounded-full border border-zinc-700/80 bg-zinc-900/60 px-2 py-0.5 text-[10px] font-bold tabular-nums text-zinc-300">
          {count} {count === 1 ? "coin" : "coins"}
        </span>
      }
      className={`border-zinc-800/90 bg-zinc-950/90 shadow-lg shadow-black/40 ${terminalSurface.insetEdgeSoft}`}
    >
      <p className="mt-1 text-[11px] leading-snug text-zinc-500">
        Live & pending positions · 24h move
      </p>
      <ul
        className="mt-2 space-y-2 overflow-y-auto pr-0.5 no-scrollbar"
        style={
          {
            ["--hodl-n" as string]: String(count),
            maxHeight:
              "min(calc(2.75rem + var(--hodl-n) * 4.35rem), min(46dvh, 26rem))",
          } as CSSProperties
        }
      >
        {myRows.map((r) => {
          const sym = (r.token_symbol ?? "").trim() || shortMint(r.mint);
          const pnl = r.priceChangePctTf ?? r.price_change_pct ?? null;
          const dex = dexscreenerTokenUrl("solana", r.mint);
          const pending = r.status === "pending_hold";
          return (
            <li
              key={r.id}
              className="rounded-lg border border-zinc-800/70 bg-zinc-900/35 px-2.5 py-2 sm:px-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="truncate text-sm font-semibold text-zinc-100">{sym}</span>
                    {pending ? (
                      <span className="shrink-0 rounded border border-amber-500/35 bg-amber-500/10 px-1.5 py-px text-[9px] font-bold uppercase tracking-wide text-amber-200/90">
                        Pending
                      </span>
                    ) : (
                      <span className="shrink-0 rounded border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-px text-[9px] font-bold uppercase tracking-wide text-emerald-200/90">
                        Live
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 font-mono text-[10px] text-zinc-500">{shortMint(r.mint)}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className={`text-sm font-bold tabular-nums ${pnlTone(pnl)}`}>{formatPct(pnl)}</p>
                  <p className="mt-0.5 text-[10px] font-medium text-zinc-500">24h</p>
                </div>
              </div>
              <div className="mt-1.5 flex flex-wrap items-center justify-between gap-x-2 gap-y-1 text-[10px] text-zinc-500">
                <span>
                  Holding <span className="font-semibold text-zinc-300">{holdLabel(r.hold_since)}</span>
                </span>
                <a
                  href={dex}
                  target="_blank"
                  rel="noreferrer"
                  className="font-semibold text-sky-400/90 hover:text-sky-300"
                >
                  Chart ↗
                </a>
              </div>
            </li>
          );
        })}
      </ul>
      <div className="mt-2 border-t border-zinc-800/60 pt-2">
        <Link
          href="/hodl"
          className="text-[11px] font-semibold text-zinc-300 underline-offset-2 hover:text-white hover:underline"
        >
          Open HODL page →
        </Link>
      </div>
    </PanelCard>
  );

  if (wideFixedDock) {
    return createPortal(
      <div
        className="pointer-events-none fixed inset-x-0 top-0 z-[22] hidden min-[1536px]:flex justify-end p-2 pt-[4.75rem] sm:p-3 sm:pt-[5rem]"
        aria-hidden={false}
      >
        <aside
          data-tutorial="dashboard.hodlDock"
          className="pointer-events-auto min-h-0 min-w-0 w-full max-w-[min(19.5rem,calc((100vw-75rem)/2-0.75rem))]"
        >
          {panel}
        </aside>
      </div>,
      document.body
    );
  }

  return (
    <div className="hidden min-w-0 max-w-full lg:block min-[1536px]:hidden">
      <aside className="w-full max-w-full" data-tutorial="dashboard.hodlDock">
        {panel}
      </aside>
    </div>
  );
}
