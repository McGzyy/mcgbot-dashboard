"use client";

export function LeaderboardUserTableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="space-y-1.5 pt-2" aria-busy="true" aria-label="Loading leaderboard">
      {Array.from({ length: rows }, (_, i) => (
        <div
          key={i}
          className="flex animate-pulse items-center justify-between gap-3 rounded-xl border border-emerald-500/10 bg-emerald-950/10 px-2.5 py-2 sm:px-3"
        >
          <div className="flex min-w-0 flex-1 items-center gap-2.5 pr-1">
            <div className="h-4 w-7 shrink-0 rounded bg-zinc-800/50" />
            <div className="h-8 w-8 shrink-0 rounded-full bg-zinc-800/50" />
            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="h-3.5 w-32 max-w-[70%] rounded bg-zinc-800/45" />
              <div className="h-2.5 w-24 rounded bg-zinc-800/35" />
            </div>
          </div>
          <div className="h-4 w-8 shrink-0 rounded bg-zinc-800/45" />
          <div className="flex shrink-0 gap-2 sm:gap-3">
            <div className="h-4 w-14 rounded bg-zinc-800/40" />
            <div className="h-4 w-14 rounded bg-zinc-800/40" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function TopCallsPanelSkeleton({ tone = "default" }: { tone?: "default" | "bot" }) {
  const ring =
    tone === "bot"
      ? "border-sky-500/20 bg-sky-950/10 ring-sky-500/10"
      : "border-emerald-500/20 bg-emerald-950/10 ring-emerald-500/10";
  return (
    <div className={`relative rounded-xl border px-3 py-3 ring-1 ${ring}`} aria-busy="true" aria-label="Loading top calls">
      <ul className="space-y-1">
        {Array.from({ length: 6 }, (_, i) => (
          <li key={i}>
            <div className="flex animate-pulse items-center justify-between gap-3 rounded-lg border border-zinc-800/60 bg-zinc-900/25 px-3 py-2">
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <div className="w-8 shrink-0 text-right text-[10px] text-transparent">#</div>
                <div className="h-8 w-8 shrink-0 rounded-md bg-zinc-800/50" />
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="h-3.5 w-20 rounded bg-zinc-800/50" />
                  <div className="h-2.5 w-40 max-w-[90%] rounded bg-zinc-800/40" />
                </div>
              </div>
              <div className="h-6 w-14 shrink-0 rounded bg-zinc-800/45" />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function BotFeedListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <ul className="space-y-0.5" aria-busy="true" aria-label="Loading bot feed">
      {Array.from({ length: rows }, (_, i) => (
        <li key={i}>
          <div className="flex animate-pulse items-center justify-between gap-3 rounded-lg border border-sky-500/10 bg-sky-950/10 px-3 py-2">
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <div className="h-9 w-9 shrink-0 rounded-lg bg-zinc-800/50" />
              <div className="min-w-0 flex-1 space-y-2">
                <div className="h-3 w-28 rounded bg-zinc-800/45" />
                <div className="h-2.5 w-36 rounded bg-zinc-800/35" />
              </div>
            </div>
            <div className="h-3 w-12 shrink-0 rounded bg-zinc-800/40" />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function CallTapeTableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }, (_, i) => (
        <tr key={i} className="animate-pulse">
          <td className="px-4 py-2.5">
            <div className="h-3 w-14 rounded bg-zinc-800/50" />
          </td>
          <td className="max-w-[min(420px,55vw)] px-4 py-2.5">
            <div className="flex min-w-0 gap-2">
              <div className="mt-0.5 h-8 w-8 shrink-0 rounded-lg bg-zinc-800/50" />
              <div className="min-w-0 flex-1 space-y-1.5 pt-1">
                <div className="h-3.5 max-w-full rounded bg-zinc-800/45" />
              </div>
            </div>
          </td>
          <td className="px-4 py-2.5 text-right">
            <div className="ml-auto h-4 w-10 rounded bg-zinc-800/45" />
          </td>
          <td className="px-4 py-2.5 text-right">
            <div className="ml-auto h-4 w-10 rounded bg-zinc-800/40" />
          </td>
          <td className="px-4 py-2.5">
            <div className="h-5 w-16 rounded bg-zinc-800/40" />
          </td>
          <td className="px-4 py-2.5">
            <div className="h-5 w-14 rounded bg-zinc-800/40" />
          </td>
          <td className="px-4 py-2.5 text-right">
            <div className="ml-auto flex justify-end gap-2">
              <div className="h-7 w-14 rounded bg-zinc-800/40" />
              <div className="h-7 w-12 rounded bg-zinc-800/35" />
            </div>
          </td>
        </tr>
      ))}
    </>
  );
}

export function WatchlistContractRowsSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-2" aria-busy="true" aria-label="Loading watchlist">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="h-14 w-full animate-pulse rounded-xl bg-zinc-900/40" />
      ))}
    </div>
  );
}

export function TradeJournalCardSkeleton({ cards = 3 }: { cards?: number }) {
  return (
    <ul className="space-y-4" aria-busy="true" aria-label="Loading journal">
      {Array.from({ length: cards }, (_, i) => (
        <li
          key={i}
          className="animate-pulse overflow-hidden rounded-2xl border border-zinc-800/85 bg-gradient-to-br from-zinc-900/55 via-zinc-950/90 to-zinc-950 px-5 py-4 sm:pl-6"
        >
          <div className="h-5 w-48 max-w-[80%] rounded bg-zinc-800/50" />
          <div className="mt-3 h-3 w-full max-w-[95%] rounded bg-zinc-800/40" />
          <div className="mt-2 h-3 w-[70%] max-w-md rounded bg-zinc-800/35" />
          <div className="mt-4 flex gap-2">
            <div className="h-6 w-16 rounded-full bg-zinc-800/45" />
            <div className="h-6 w-14 rounded-full bg-zinc-800/40" />
          </div>
        </li>
      ))}
    </ul>
  );
}
