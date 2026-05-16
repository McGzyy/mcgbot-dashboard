"use client";

import { DashboardRefreshBar } from "@/app/components/dashboard/DashboardRefreshBar";
import { PanelCard } from "@/app/components/PanelCard";
import { TokenCallThumb } from "@/components/TokenCallThumb";
import { useTokenChartModal } from "@/app/contexts/TokenChartModalContext";
import type { DeskPulseStats } from "@/lib/deskPulseStats";
import type { DeskRankMover } from "@/lib/deskRankMovers";
import type { DeskYouStats } from "@/lib/deskYouStats";
import { formatJoinedAt, multipleClass } from "@/lib/callDisplayFormat";
import { userProfileHref } from "@/lib/userProfileHref";
import { terminalSurface } from "@/lib/terminalDesignTokens";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type MilestoneRow = {
  id: string;
  symbol: string;
  callCa: string;
  tokenImageUrl: string | null;
  multiplier: number;
  username: string;
  callTimeIso: string;
};

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

function YouVsDeskPanel({
  you,
  pulse,
  loading,
}: {
  you: DeskYouStats | null;
  pulse: DeskPulseStats | null;
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="mt-2 h-20 animate-pulse rounded-lg border border-zinc-800/60 bg-zinc-900/30" />
    );
  }

  if (!you || you.calls === 0) {
    return (
      <p className="mt-2 text-xs leading-relaxed text-zinc-500">
        Log a verified call in the last 24 hours to see how you compare to the desk.
      </p>
    );
  }

  const deskAvg = pulse?.avgX ?? 0;
  const delta = you.avgX - deskAvg;
  const deltaLabel =
    !Number.isFinite(delta) || deskAvg <= 0
      ? "—"
      : delta >= 0
        ? `+${delta.toFixed(2)}× vs desk`
        : `${delta.toFixed(2)}× vs desk`;

  return (
    <div className="mt-2 grid gap-2 sm:grid-cols-3">
      <div className="rounded-lg border border-zinc-800/80 bg-zinc-950/50 px-3 py-2.5">
        <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-zinc-500">Your avg ATH</p>
        <p className="mt-1 text-lg font-bold tabular-nums text-[color:var(--accent)]">
          {formatDeskX(you.avgX)}
        </p>
        <p className="mt-0.5 text-[10px] text-zinc-500">{deltaLabel}</p>
      </div>
      <div className="rounded-lg border border-zinc-800/80 bg-zinc-950/50 px-3 py-2.5">
        <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-zinc-500">Desk avg ATH</p>
        <p className="mt-1 text-lg font-bold tabular-nums text-zinc-100">
          {pulse ? formatDeskX(pulse.avgX) : "—"}
        </p>
        <p className="mt-0.5 text-[10px] text-zinc-500">All verified calls</p>
      </div>
      <div className="rounded-lg border border-zinc-800/80 bg-zinc-950/50 px-3 py-2.5">
        <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-zinc-500">Your rank</p>
        <p className="mt-1 text-lg font-bold tabular-nums text-zinc-100">
          {you.rank != null ? `#${you.rank}` : "—"}
        </p>
        <p className="mt-0.5 text-[10px] text-zinc-500">
          {you.totalRanked > 0
            ? `of ${you.totalRanked} active · ${you.calls} call${you.calls === 1 ? "" : "s"}`
            : "Rolling 24h board"}
        </p>
      </div>
    </div>
  );
}

function RankMoversPanel({
  movers,
  loading,
}: {
  movers: DeskRankMover[];
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="mt-2 space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-9 animate-pulse rounded-lg bg-zinc-900/35" />
        ))}
      </div>
    );
  }

  if (movers.length === 0) {
    return (
      <p className="mt-2 text-xs text-zinc-500">
        No big rank jumps in the last 24h vs the prior window yet.
      </p>
    );
  }

  return (
    <ul className="mt-2 divide-y divide-zinc-800/45">
      {movers.map((m) => {
        const moveLabel =
          m.spotsUp == null
            ? "New in top 10"
            : m.spotsUp === 1
              ? "↑ 1 spot"
              : `↑ ${m.spotsUp} spots`;
        return (
          <li key={m.discordId} className="flex items-center justify-between gap-2 py-2">
            <div className="min-w-0">
              <Link
                href={userProfileHref({ discordId: m.discordId, displayName: m.username })}
                className="truncate text-sm font-semibold text-zinc-100 hover:text-white"
              >
                {m.username}
              </Link>
              <p className="text-[10px] text-zinc-500">
                #{m.rankNow} now
                {m.rankPrior != null ? ` · was #${m.rankPrior}` : ""} · {formatDeskX(m.avgX)} avg
              </p>
            </div>
            <span className="shrink-0 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-200/95">
              {moveLabel}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function DeskBriefLine({ pulse }: { pulse: DeskPulseStats | null }) {
  if (!pulse || pulse.calls === 0) {
    return (
      <p className="text-xs leading-relaxed text-zinc-500">
        No verified desk calls in the last 24 hours yet. Activity will show here as members log
        calls.
      </p>
    );
  }

  const hit = pulse.topHit;
  return (
    <p className="text-xs leading-relaxed text-zinc-400">
      <span className="font-semibold text-zinc-200">{pulse.calls.toLocaleString("en-US")}</span>{" "}
      verified calls ·{" "}
      <span className="font-semibold text-[color:var(--accent)]">{formatDeskX(pulse.avgX)}</span>{" "}
      avg ATH
      {hit ? (
        <>
          {" "}
          · Standout{" "}
          <span className="font-semibold text-zinc-200">${hit.symbol}</span> at{" "}
          <span className={`font-semibold tabular-nums ${multipleClass(hit.multiple)}`}>
            {formatDeskX(hit.multiple)}
          </span>{" "}
          by <span className="font-semibold text-zinc-200">{hit.username}</span>
        </>
      ) : null}
    </p>
  );
}

function MilestoneRowItem({
  row,
  rank,
  nowMs,
  onChart,
}: {
  row: MilestoneRow;
  rank: number;
  nowMs: number;
  onChart: (row: MilestoneRow) => void;
}) {
  const tMs = row.callTimeIso ? Date.parse(row.callTimeIso) : NaN;
  const timeLabel = Number.isFinite(tMs) ? formatJoinedAt(tMs, nowMs, "compact") : "—";

  return (
    <li className="flex items-center gap-2 border-b border-zinc-800/45 py-2 pl-1 pr-1 last:border-b-0 sm:gap-2.5 sm:pl-1.5 sm:pr-2">
      <span className="w-5 shrink-0 text-center text-[10px] font-bold tabular-nums text-zinc-500">
        {rank}
      </span>
      <TokenCallThumb
        mint={row.callCa}
        symbol={row.symbol}
        tokenImageUrl={row.tokenImageUrl}
        tone="default"
      />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
          <span className="text-sm font-semibold text-zinc-100">${row.symbol}</span>
          <span className="text-[11px] text-zinc-500">{row.username}</span>
        </div>
        <div className="mt-0.5 text-[10px] text-zinc-500">{timeLabel}</div>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <span className={`text-sm font-bold tabular-nums ${multipleClass(row.multiplier)}`}>
          {formatDeskX(row.multiplier)}
        </span>
        {row.callCa ? (
          <button
            type="button"
            onClick={() => onChart(row)}
            className="rounded border border-zinc-700/80 bg-zinc-900/40 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-zinc-400 transition hover:border-zinc-600 hover:text-zinc-200"
          >
            Chart
          </button>
        ) : null}
      </div>
    </li>
  );
}

/** Desk context + ranked milestones + inbox — replaces social feed on home. */
export function DeskIntelColumn({ refreshNonce = 0 }: { refreshNonce?: number }) {
  const { openTokenChart } = useTokenChartModal();
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [pulse, setPulse] = useState<DeskPulseStats | null>(null);
  const [you, setYou] = useState<DeskYouStats | null>(null);
  const [rankMovers, setRankMovers] = useState<DeskRankMover[]>([]);
  const [pulseLoading, setPulseLoading] = useState(true);
  const [pulseRefreshing, setPulseRefreshing] = useState(false);
  const [milestones, setMilestones] = useState<MilestoneRow[]>([]);
  const [milestonesLoading, setMilestonesLoading] = useState(true);
  const [milestonesRefreshing, setMilestonesRefreshing] = useState(false);
  const [inboxRows, setInboxRows] = useState<InboxRow[]>([]);
  const [inboxUnread, setInboxUnread] = useState(0);
  const [inboxLoading, setInboxLoading] = useState(true);

  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const openChart = useCallback(
    (row: MilestoneRow) => {
      if (!row.callCa.trim()) return;
      openTokenChart({
        chain: "solana",
        contractAddress: row.callCa.trim(),
        tokenTicker: row.symbol,
        tokenName: row.symbol,
        tokenImageUrl: row.tokenImageUrl,
      });
    },
    [openTokenChart]
  );

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
            return;
          }
          setPulse(o.pulse as DeskPulseStats);
          setYou(o.you && typeof o.you === "object" ? (o.you as DeskYouStats) : null);
          setRankMovers(
            Array.isArray(o.rankMovers) ? (o.rankMovers as DeskRankMover[]) : [],
          );
        })
        .catch(() => {
          if (!cancelled) {
            setPulse(null);
            setYou(null);
            setRankMovers([]);
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

    const loadMilestones = (background: boolean) => {
      if (background) setMilestonesRefreshing(true);
      else setMilestonesLoading(true);

      fetch("/api/leaderboard/top-calls?period=rolling24h&limit=10&type=user", {
        credentials: "same-origin",
        cache: "no-store",
      })
        .then((res) => (res.ok ? res.json() : null))
        .then((json: unknown) => {
          if (cancelled) return;
          const rowsRaw =
            json && typeof json === "object" && Array.isArray((json as { rows?: unknown }).rows)
              ? ((json as { rows: unknown[] }).rows as unknown[])
              : [];
          const parsed: MilestoneRow[] = [];
          for (const r of rowsRaw) {
            if (!r || typeof r !== "object") continue;
            const o = r as Record<string, unknown>;
            const multiplier =
              typeof o.multiplier === "number" ? o.multiplier : Number(o.multiplier) || 0;
            if (multiplier < 2) continue;
            const callCa = typeof o.callCa === "string" ? o.callCa.trim() : "";
            parsed.push({
              id: String(o.id ?? callCa ?? parsed.length),
              symbol: typeof o.symbol === "string" ? o.symbol : "—",
              callCa,
              tokenImageUrl:
                typeof o.tokenImageUrl === "string" && o.tokenImageUrl.trim()
                  ? o.tokenImageUrl.trim()
                  : null,
              multiplier,
              username: typeof o.username === "string" ? o.username : "—",
              callTimeIso: typeof o.callTimeIso === "string" ? o.callTimeIso : "",
            });
          }
          parsed.sort((a, b) => b.multiplier - a.multiplier);
          setMilestones(parsed.slice(0, 8));
        })
        .catch(() => {
          if (!cancelled) setMilestones([]);
        })
        .finally(() => {
          if (!cancelled) {
            setMilestonesLoading(false);
            setMilestonesRefreshing(false);
          }
        });
    };

    loadMilestones(false);
    const interval = window.setInterval(() => loadMilestones(true), 60_000);

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

  return (
    <div className="flex min-w-0 max-w-full flex-col gap-4" data-tutorial="dashboard.deskIntel">
      <PanelCard
        title="Desk pulse"
        titleClassName="normal-case"
        titleRight={
          <span className="rounded-full border border-zinc-800/80 bg-zinc-900/40 px-2 py-0.5 text-[10px] font-semibold tabular-nums text-zinc-500">
            Rolling 24h
          </span>
        }
        className="relative min-w-0 overflow-hidden"
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-sky-500/30 via-[color:var(--accent)]/35 to-transparent" />
        <DashboardRefreshBar active={pulseRefreshing && pulse !== null} />
        <div className="mt-2">
          <DeskBriefLine pulse={pulseLoading ? null : pulse} />
        </div>
        {pulseLoading ? (
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="h-[4.25rem] animate-pulse rounded-lg border border-zinc-800/60 bg-zinc-900/30"
              />
            ))}
          </div>
        ) : (
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
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
        )}
      </PanelCard>

      <PanelCard title="You vs desk" titleClassName="normal-case" className="min-w-0 overflow-hidden">
        <p className="mt-1 text-[11px] text-zinc-500">
          Your rolling 24h performance against the full desk average.
        </p>
        <YouVsDeskPanel you={you} pulse={pulse} loading={pulseLoading} />
      </PanelCard>

      <PanelCard
        title="Rank movers"
        titleClassName="normal-case"
        titleRight={
          <Link
            href="/leaderboard?period=rolling24h"
            className="text-[11px] font-semibold text-zinc-500 transition hover:text-zinc-200"
          >
            Board →
          </Link>
        }
        className="min-w-0 overflow-hidden"
      >
        <p className="mt-1 text-[11px] text-zinc-500">
          Callers who climbed the avg-X board vs the previous 24 hours.
        </p>
        <RankMoversPanel movers={rankMovers} loading={pulseLoading} />
      </PanelCard>

      <PanelCard
        title="Milestone board"
        titleClassName="normal-case"
        titleRight={
          <Link
            href="/leaderboard"
            className="text-[11px] font-semibold text-zinc-500 transition hover:text-zinc-200"
          >
            Leaderboard →
          </Link>
        }
        className="relative min-w-0 overflow-hidden"
      >
        <p className="mt-1 text-[11px] text-zinc-500">
          Top verified ATH multiples in the last 24 hours (2× minimum).
        </p>
        <div className={`relative mt-2 min-w-0 ${terminalSurface.dashboardListWell}`}>
          <DashboardRefreshBar active={milestonesRefreshing && milestones.length > 0} />
          {milestonesLoading ? (
            <div className="space-y-2 p-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-10 animate-pulse rounded-lg bg-zinc-900/35" />
              ))}
            </div>
          ) : milestones.length === 0 ? (
            <div className="flex min-h-[8rem] flex-col items-center justify-center px-3 py-8 text-center">
              <p className="text-sm font-medium text-zinc-300">No 2×+ hits yet</p>
              <p className="mt-1 max-w-[16rem] text-xs text-zinc-500">
                Standout calls will rank here by ATH multiple.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-zinc-800/45">
              {milestones.map((row, i) => (
                <MilestoneRowItem
                  key={row.id}
                  row={row}
                  rank={i + 1}
                  nowMs={nowMs}
                  onChart={openChart}
                />
              ))}
            </ul>
          )}
        </div>
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
