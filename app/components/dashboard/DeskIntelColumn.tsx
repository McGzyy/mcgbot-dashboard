"use client";

import { DashboardRefreshBar } from "@/app/components/dashboard/DashboardRefreshBar";
import { PanelCard } from "@/app/components/PanelCard";
import { TokenCallThumb } from "@/components/TokenCallThumb";
import { useTokenChartModal } from "@/app/contexts/TokenChartModalContext";
import type { DeskPulseTopHit } from "@/lib/deskPulseStats";
import type { DeskPulseStats } from "@/lib/deskPulseStats";
import type { DeskRankMover } from "@/lib/deskRankMovers";
import type { DeskRecentHit } from "@/lib/deskRecentHits";
import type { DeskYouStats } from "@/lib/deskYouStats";
import { formatJoinedAt, multipleClass } from "@/lib/callDisplayFormat";
import { userProfileHref } from "@/lib/userProfileHref";
import Link from "next/link";
import { useEffect, useState } from "react";

type InboxRow = {
  id: string;
  title: string;
  body: string;
  kind: string;
  createdAt: string;
  readAt: string | null;
};

function formatDeskX(v: number): string {
  if (!Number.isFinite(v) || v <= 0) return "—";
  return `${v.toFixed(v >= 10 ? 1 : 2)}×`;
}

function DeskPulseTile({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="min-w-0 rounded-lg border border-zinc-800/80 bg-zinc-950/50 px-2.5 py-2 sm:px-3 sm:py-2.5">
      <div className="text-[9px] font-bold uppercase tracking-[0.18em] text-zinc-500">{label}</div>
      <div className="mt-1 truncate text-lg font-bold tabular-nums tracking-tight text-zinc-50 sm:text-xl">
        {value}
      </div>
      {hint ? <div className="mt-0.5 truncate text-[10px] text-zinc-500">{hint}</div> : null}
    </div>
  );
}

function DeskBriefLine({
  pulse,
  you,
}: {
  pulse: DeskPulseStats | null;
  you: DeskYouStats | null;
}) {
  if (!pulse || pulse.calls === 0) {
    return (
      <p className="text-xs leading-relaxed text-zinc-500">
        No verified desk calls in the last 24 hours yet. The live feed below will populate as
        members log calls.
      </p>
    );
  }

  return (
    <p className="text-xs leading-relaxed text-zinc-400">
      <span className="font-semibold text-zinc-200">{pulse.calls.toLocaleString("en-US")}</span>{" "}
      verified calls in the last 24 hours · desk avg{" "}
      <span className="font-semibold text-[color:var(--accent)]">{formatDeskX(pulse.avgX)}</span>
      {you && you.calls > 0 ? (
        <>
          {" "}
          · you{" "}
          <span className="font-semibold text-[color:var(--accent)]">{formatDeskX(you.avgX)}</span>
          {you.rank != null ? (
            <>
              {" "}
              · rank <span className="font-semibold text-zinc-200">#{you.rank}</span>
            </>
          ) : null}
        </>
      ) : null}
    </p>
  );
}

function YouVsDeskBar({
  you,
  pulse,
}: {
  you: DeskYouStats | null;
  pulse: DeskPulseStats | null;
}) {
  if (!you || you.calls === 0 || !pulse || pulse.avgX <= 0) return null;
  const ratio = Math.min(1.5, you.avgX / pulse.avgX);
  const pct = Math.round(ratio * 100);
  const ahead = you.avgX >= pulse.avgX;
  return (
    <div className="mt-3 rounded-lg border border-zinc-800/70 bg-zinc-950/40 px-3 py-2.5">
      <div className="flex items-center justify-between gap-2 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
        <span>Your avg vs desk</span>
        <span className={ahead ? "text-emerald-300/90" : "text-zinc-400"}>
          {ahead ? "Above desk" : "Below desk"}
        </span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-zinc-800/80">
        <div
          className={`h-full rounded-full transition-all ${
            ahead ? "bg-gradient-to-r from-emerald-600/80 to-[color:var(--accent)]" : "bg-zinc-600"
          }`}
          style={{ width: `${Math.min(100, pct)}%` }}
        />
      </div>
      <p className="mt-1.5 text-[11px] text-zinc-500">
        {formatDeskX(you.avgX)} you · {formatDeskX(pulse.avgX)} desk
      </p>
    </div>
  );
}

function StandoutHitCard({
  hit,
  onChart,
}: {
  hit: DeskPulseTopHit;
  onChart: () => void;
}) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-yellow-500/20 bg-gradient-to-br from-yellow-500/10 via-zinc-950/80 to-zinc-950 p-3 sm:p-4">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(234,179,8,0.12),transparent_55%)]" />
      <p className="relative text-[9px] font-bold uppercase tracking-[0.2em] text-yellow-200/80">
        Standout · 24h
      </p>
      <div className="relative mt-3 flex items-center gap-3">
        <TokenCallThumb
          mint={hit.callCa}
          symbol={hit.symbol}
          tokenImageUrl={hit.tokenImageUrl}
          tone="default"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-lg font-bold text-zinc-50">${hit.symbol}</p>
          <p className="mt-0.5 truncate text-xs text-zinc-400">
            by <span className="font-medium text-zinc-200">{hit.username}</span>
          </p>
          <p className={`mt-1 text-2xl font-black tabular-nums ${multipleClass(hit.multiple)}`}>
            {formatDeskX(hit.multiple)}
          </p>
        </div>
        {hit.callCa ? (
          <button
            type="button"
            onClick={onChart}
            className="shrink-0 rounded-lg border border-zinc-700/80 bg-zinc-900/50 px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-300 transition hover:border-zinc-600 hover:text-white"
          >
            Chart
          </button>
        ) : null}
      </div>
    </div>
  );
}

function DeskRecentHitsStrip({
  hits,
  onChart,
}: {
  hits: DeskRecentHit[];
  onChart: (hit: DeskRecentHit) => void;
}) {
  if (hits.length === 0) return null;
  return (
    <div className="mt-3 border-t border-zinc-800/50 pt-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-zinc-500">
          Recent 2×+ hits
        </p>
        <Link
          href="/leaderboard?period=rolling24h"
          className="text-[10px] font-semibold text-zinc-500 hover:text-zinc-300"
        >
          All →
        </Link>
      </div>
      <ul className="mt-2 flex gap-2 overflow-x-auto pb-1 no-scrollbar">
        {hits.map((hit) => (
          <li key={`${hit.callCa}-${hit.multiple}`} className="shrink-0">
            <button
              type="button"
              onClick={() => onChart(hit)}
              className="flex w-[8.5rem] flex-col rounded-lg border border-zinc-800/80 bg-zinc-950/60 p-2 text-left transition hover:border-zinc-600 hover:bg-zinc-900/50 sm:w-[9.25rem]"
            >
              <div className="flex items-center gap-2">
                <TokenCallThumb
                  mint={hit.callCa}
                  symbol={hit.symbol}
                  tokenImageUrl={hit.tokenImageUrl}
                  tone="default"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-bold text-zinc-100">${hit.symbol}</p>
                  <p className={`text-sm font-black tabular-nums ${multipleClass(hit.multiple)}`}>
                    {formatDeskX(hit.multiple)}
                  </p>
                </div>
              </div>
              <p className="mt-1.5 truncate text-[10px] text-zinc-500">{hit.username}</p>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function DeskMoversStrip({ movers }: { movers: DeskRankMover[] }) {
  if (movers.length === 0) return null;
  return (
    <div className="mt-3 border-t border-zinc-800/50 pt-3">
      <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-zinc-500">Climbing</p>
      <ul className="mt-2 flex flex-wrap gap-2">
        {movers.slice(0, 4).map((m) => {
          const moveLabel =
            m.spotsUp == null ? "new" : m.spotsUp === 1 ? "↑1" : `↑${m.spotsUp}`;
          return (
            <li key={m.discordId}>
              <Link
                href={userProfileHref({ discordId: m.discordId, displayName: m.username })}
                className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-zinc-800/80 bg-zinc-950/60 px-2.5 py-1 text-[11px] font-medium text-zinc-200 transition hover:border-zinc-600 hover:text-white"
              >
                <span className="max-w-[7rem] truncate">{m.username}</span>
                <span className="shrink-0 rounded border border-emerald-500/25 bg-emerald-500/10 px-1 py-0.5 text-[9px] font-bold uppercase text-emerald-200/90">
                  {moveLabel}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/**
 * One desk intel card (replaces social feed). Top performers + activity wins cover hits and ranks.
 */
export function DeskIntelColumn({ refreshNonce = 0 }: { refreshNonce?: number }) {
  const { openTokenChart } = useTokenChartModal();
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [pulse, setPulse] = useState<DeskPulseStats | null>(null);
  const [you, setYou] = useState<DeskYouStats | null>(null);
  const [rankMovers, setRankMovers] = useState<DeskRankMover[]>([]);
  const [recentHits, setRecentHits] = useState<DeskRecentHit[]>([]);
  const [pulseLoading, setPulseLoading] = useState(true);
  const [pulseRefreshing, setPulseRefreshing] = useState(false);
  const [inboxRows, setInboxRows] = useState<InboxRow[]>([]);
  const [inboxUnread, setInboxUnread] = useState(0);
  const [inboxLoading, setInboxLoading] = useState(true);

  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadPulse = (background: boolean) => {
      if (background) setPulseRefreshing(true);
      else setPulseLoading(true);

      fetch("/api/desk-pulse", { credentials: "same-origin", cache: "no-store" })
        .then((res) => res.json().catch(() => ({})))
        .then((j: unknown) => {
          if (cancelled) return;
          const o = j && typeof j === "object" ? (j as Record<string, unknown>) : null;
          const ok = o?.success === true && o.pulse && typeof o.pulse === "object";
          if (!ok) {
            setPulse(null);
            setYou(null);
            setRankMovers([]);
            setRecentHits([]);
            return;
          }
          setPulse(o.pulse as DeskPulseStats);
          setYou(o.you && typeof o.you === "object" ? (o.you as DeskYouStats) : null);
          setRankMovers(
            Array.isArray(o.rankMovers) ? (o.rankMovers as DeskRankMover[]) : [],
          );
          setRecentHits(
            Array.isArray(o.recentHits) ? (o.recentHits as DeskRecentHit[]) : [],
          );
        })
        .catch(() => {
          if (!cancelled) {
            setPulse(null);
            setYou(null);
            setRankMovers([]);
            setRecentHits([]);
          }
        })
        .finally(() => {
          if (!cancelled) {
            setPulseLoading(false);
            setPulseRefreshing(false);
          }
        });
    };

    loadPulse(false);
    const interval = window.setInterval(() => loadPulse(true), 60_000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [refreshNonce]);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/me/inbox?limit=8", { credentials: "same-origin", cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((json: unknown) => {
        if (cancelled) return;
        const o = json && typeof json === "object" ? (json as Record<string, unknown>) : null;
        const rowsRaw = o && Array.isArray(o.rows) ? (o.rows as unknown[]) : [];
        const parsed: InboxRow[] = [];
        for (const r of rowsRaw) {
          if (!r || typeof r !== "object") continue;
          const row = r as Record<string, unknown>;
          parsed.push({
            id: String(row.id ?? ""),
            title: String(row.title ?? ""),
            body: String(row.body ?? ""),
            kind: String(row.kind ?? "info"),
            createdAt: String(row.createdAt ?? ""),
            readAt: row.readAt == null ? null : String(row.readAt),
          });
        }
        const unread = parsed.filter((r) => !r.readAt);
        setInboxUnread(typeof o?.unread === "number" ? o.unread : unread.length);
        setInboxRows(unread.slice(0, 5));
      })
      .catch(() => {
        if (!cancelled) {
          setInboxRows([]);
          setInboxUnread(0);
        }
      })
      .finally(() => {
        if (!cancelled) setInboxLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [refreshNonce]);

  const showInbox = !inboxLoading && inboxRows.length > 0;
  const pulseReady = !pulseLoading ? pulse : null;
  const youReady = !pulseLoading ? you : null;
  const topHit = pulseReady?.topHit ?? null;

  const openHitChart = (hit: { callCa: string; symbol: string; tokenImageUrl: string | null }) => {
    if (!hit.callCa) return;
    openTokenChart({
      chain: "solana",
      contractAddress: hit.callCa,
      symbolLabel: hit.symbol ? `$${hit.symbol}` : undefined,
      tokenTicker: hit.symbol,
      tokenImageUrl: hit.tokenImageUrl,
    });
  };

  const openStandoutChart = () => {
    if (topHit) openHitChart(topHit);
  };

  return (
    <div className="flex min-w-0 max-w-full flex-col gap-4" data-tutorial="dashboard.deskIntel">
      <PanelCard
        title="Desk intel"
        titleClassName="normal-case"
        titleRight={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Link
              href="/leaderboard?period=rolling24h"
              className="text-[11px] font-semibold text-zinc-500 transition hover:text-zinc-200"
            >
              Leaderboard
            </Link>
            <span className="rounded-full border border-zinc-800/80 bg-zinc-900/40 px-2 py-0.5 text-[10px] font-semibold tabular-nums text-zinc-500">
              24h
            </span>
          </div>
        }
        className="relative min-w-0 overflow-hidden"
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-sky-500/30 via-[color:var(--accent)]/35 to-transparent" />
        <DashboardRefreshBar active={pulseRefreshing && pulse !== null} />
        <p className="mt-1 text-[11px] text-zinc-500">
          Room pulse and your standing — scroll for live calls, top callers, and wins below.
        </p>
        <div className="mt-2">
          <DeskBriefLine pulse={pulseReady} you={youReady} />
        </div>
        {pulseLoading ? (
          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            <div className="h-32 animate-pulse rounded-xl border border-zinc-800/60 bg-zinc-900/30" />
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="h-[4.25rem] animate-pulse rounded-lg border border-zinc-800/60 bg-zinc-900/30"
                />
              ))}
            </div>
          </div>
        ) : (
          <>
            <div
              className={`mt-3 grid gap-3 ${topHit ? "lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]" : ""}`}
            >
              {topHit ? (
                <StandoutHitCard hit={topHit} onChart={openStandoutChart} />
              ) : null}
              <div
                className={
                  topHit
                    ? "grid grid-cols-2 gap-2 sm:grid-cols-3"
                    : "grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6"
                }
              >
                <DeskPulseTile label="Calls" value={pulse ? String(pulse.calls) : "—"} />
                <DeskPulseTile label="Avg ATH" value={pulse ? formatDeskX(pulse.avgX) : "—"} />
                <DeskPulseTile label="Median" value={pulse ? formatDeskX(pulse.medianX) : "—"} />
                <DeskPulseTile
                  label="2×+"
                  value={pulse ? String(pulse.hits2xPlus) : "—"}
                  hint="Hits"
                />
                <DeskPulseTile
                  label="5×+"
                  value={pulse ? String(pulse.hits5xPlus) : "—"}
                  hint="Hits"
                />
                <DeskPulseTile
                  label="Callers"
                  value={pulse ? String(pulse.activeCallers) : "—"}
                  hint={
                    pulse && pulse.memberCalls + pulse.botCalls > 0
                      ? `${pulse.memberCalls} mem · ${pulse.botCalls} bot`
                      : undefined
                  }
                />
              </div>
            </div>
            <YouVsDeskBar you={youReady} pulse={pulseReady} />
            <DeskMoversStrip movers={rankMovers} />
            <DeskRecentHitsStrip hits={recentHits} onChart={openHitChart} />
          </>
        )}
      </PanelCard>

      {showInbox ? (
        <PanelCard
          title="Action inbox"
          titleClassName="normal-case"
          titleRight={
            inboxUnread > 0 ? (
              <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold tabular-nums text-amber-200/95">
                {inboxUnread} unread
              </span>
            ) : null
          }
          className="min-w-0 overflow-hidden"
        >
          <ul className="mt-2 space-y-2">
            {inboxRows.map((row) => {
              const tMs = row.createdAt ? Date.parse(row.createdAt) : NaN;
              const when = Number.isFinite(tMs) ? formatJoinedAt(tMs, nowMs, "compact") : "";
              return (
                <li
                  key={row.id}
                  className="rounded-lg border border-zinc-800/80 bg-zinc-950/40 px-3 py-2.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold text-zinc-100">{row.title || "Update"}</p>
                    {when ? (
                      <time className="shrink-0 text-[10px] tabular-nums text-zinc-500">{when}</time>
                    ) : null}
                  </div>
                  {row.body ? (
                    <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-zinc-500">
                      {row.body}
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </PanelCard>
      ) : null}
    </div>
  );
}
