"use client";

import { useEffect, useMemo, useState } from "react";
import PanelCard from "@/components/PanelCard";
import { terminalSurface } from "@/lib/terminalDesignTokens";

type Point = { day: string; sol: number };

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

function sparkPath(values: number[], w: number, h: number): string {
  if (values.length === 0) return "";
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(1e-9, max - min);
  const dx = values.length <= 1 ? 0 : w / (values.length - 1);
  const pts = values.map((v, i) => {
    const x = i * dx;
    const y = h - ((v - min) / span) * h;
    return { x, y };
  });
  return pts
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
    .join(" ");
}

export default function WalletPnlPanel() {
  const [loading, setLoading] = useState(true);
  const [linked, setLinked] = useState<boolean | null>(null);
  const [walletPubkey, setWalletPubkey] = useState<string | null>(null);
  const [points, setPoints] = useState<Point[]>([]);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    setLoading(true);
    void (async () => {
      try {
        const res = await fetch("/api/me/wallet/balance-history", {
          credentials: "same-origin",
          signal: controller.signal,
        });
        const j = (await res.json().catch(() => null)) as
          | { linked?: boolean; walletPubkey?: string; points?: Point[] }
          | { error?: string }
          | null;
        if (cancelled) return;
        if (!res.ok || !j || typeof j !== "object") {
          setLinked(false);
          setWalletPubkey(null);
          setPoints([]);
          return;
        }
        const isLinked = (j as any).linked === true;
        setLinked(isLinked);
        setWalletPubkey(
          typeof (j as any).walletPubkey === "string" ? String((j as any).walletPubkey) : null
        );
        setPoints(Array.isArray((j as any).points) ? ((j as any).points as Point[]) : []);
      } catch {
        if (cancelled) return;
        setLinked(false);
        setWalletPubkey(null);
        setPoints([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, []);

  const { series, start, end, delta } = useMemo(() => {
    const s = [...points]
      .filter((p) => p && typeof p.day === "string" && Number.isFinite(p.sol))
      .slice(-7);
    const startV = s.length > 0 ? s[0].sol : null;
    const endV = s.length > 0 ? s[s.length - 1].sol : null;
    const d = startV != null && endV != null ? endV - startV : null;
    return { series: s, start: startV, end: endV, delta: d };
  }, [points]);

  const values = series.map((p) => p.sol);
  const path = sparkPath(values, 240, 56);
  const deltaColor =
    delta == null ? "text-zinc-500" : delta >= 0 ? "text-emerald-300" : "text-red-300";

  return (
    <PanelCard title="Wallet PnL" titleClassName="normal-case">
      <p className="mt-2 text-xs text-zinc-500">
        Last 7 days (SOL balance). USD valuation comes next.
      </p>

      <div
        className={`mt-3 rounded-xl border border-zinc-900 bg-zinc-950/40 p-3 ${terminalSurface.insetEdgeSoft}`}
      >
        {loading ? (
          <div className="space-y-2">
            <div className="h-14 animate-pulse rounded-lg bg-zinc-900/40" />
            <div className="h-4 w-40 animate-pulse rounded bg-zinc-900/25" />
          </div>
        ) : linked === false ? (
          <div className="py-8 text-center">
            <p className="text-sm font-semibold text-zinc-200">No linked wallet</p>
            <p className="mt-1 text-xs text-zinc-500">
              Link a wallet to start tracking balance changes.
            </p>
          </div>
        ) : series.length < 2 ? (
          <div className="py-8 text-center">
            <p className="text-sm font-semibold text-zinc-200">Not enough history yet</p>
            <p className="mt-1 text-xs text-zinc-500">
              We’ll build the 7-day chart as daily snapshots accumulate.
            </p>
            {walletPubkey ? (
              <p className="mt-2 font-mono text-[10px] text-zinc-600">{walletPubkey}</p>
            ) : null}
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                  Change
                </p>
                <p className={`mt-1 text-sm font-semibold tabular-nums ${deltaColor}`}>
                  {delta != null ? `${delta >= 0 ? "+" : ""}${delta.toFixed(3)} SOL` : "—"}
                </p>
                <p className="mt-1 text-[11px] tabular-nums text-zinc-500">
                  {start != null && end != null ? `${start.toFixed(3)} → ${end.toFixed(3)} SOL` : "—"}
                </p>
              </div>
              <div className="shrink-0">
                <svg
                  width="240"
                  height="56"
                  viewBox="0 0 240 56"
                  className="block"
                  aria-label="Wallet balance chart"
                >
                  <defs>
                    <linearGradient id="walletPnlGrad" x1="0" x2="1" y1="0" y2="0">
                      <stop offset="0%" stopColor="rgba(57,255,20,0.25)" />
                      <stop offset="100%" stopColor="rgba(56,189,248,0.18)" />
                    </linearGradient>
                  </defs>
                  <rect x="0" y="0" width="240" height="56" rx="10" fill="rgba(9,10,16,0.30)" />
                  {path ? (
                    <>
                      <path d={path} fill="none" stroke="url(#walletPnlGrad)" strokeWidth="2.5" />
                    </>
                  ) : null}
                </svg>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between text-[10px] text-zinc-600">
              <span>{series[0]?.day ?? ""}</span>
              <span>{series[series.length - 1]?.day ?? ""}</span>
            </div>
          </>
        )}
      </div>
    </PanelCard>
  );
}

