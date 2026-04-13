"use client";

import { FollowButton } from "@/app/components/FollowButton";
import { useFollowingIds } from "@/app/hooks/useFollowingIds";
import Link from "next/link";
import { useEffect, useState } from "react";

const PROFILE_LINK_CLASS =
  "font-medium text-zinc-200 transition-colors hover:text-cyan-400 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/50";

type TabId = "user" | "bot" | "referrals";

const TABS: { id: TabId; label: string }[] = [
  { id: "user", label: "User Calls" },
  { id: "bot", label: "Bot Calls" },
  { id: "referrals", label: "Referrals" },
];

const TOP_WEEKLY = {
  name: "mcgzzy",
  metric: "Avg 4.2x",
  label: "Weekly" as const,
};

const TOP_MONTHLY = {
  name: "SignalKing",
  metric: "12 wins",
  label: "Monthly" as const,
};

type ApiLeaderRow = {
  rank: number;
  discordId: string;
  username: string;
  avgX: number;
  totalCalls: number;
  wins: number;
};

function formatAvgX(avgX: number): string {
  const n = Number(avgX);
  if (!Number.isFinite(n)) return "—";
  return `${n.toFixed(1)}x`;
}

function PerformerCard({
  name,
  metric,
  periodLabel,
  leaderTitle,
}: {
  name: string;
  metric: string;
  periodLabel: string;
  leaderTitle: string;
}) {
  return (
    <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/60 p-5 shadow-sm shadow-black/20 backdrop-blur-sm">
      <p className="text-xs font-medium text-zinc-500">{leaderTitle}</p>
      <p className="mt-3 text-lg font-semibold text-zinc-100">{name}</p>
      <p className="mt-1 text-sm text-zinc-400">{metric}</p>
      <p className="mt-4 text-[10px] font-medium uppercase tracking-widest text-zinc-600">
        {periodLabel}
      </p>
    </div>
  );
}

export default function LeaderboardPage() {
  const [activeTab, setActiveTab] = useState("user");
  const [data, setData] = useState<ApiLeaderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const { followingIds, setFollowing } = useFollowingIds();

  useEffect(() => {
    if (activeTab === "referrals") {
      setData([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        const res = await fetch(`/api/leaderboard?type=${activeTab}`);
        if (!res.ok) {
          if (!cancelled) setData([]);
          return;
        }
        const json: unknown = await res.json();
        if (cancelled) return;
        if (!Array.isArray(json)) {
          setData([]);
          return;
        }
        const parsed: ApiLeaderRow[] = json
          .map((item) => {
            if (!item || typeof item !== "object") return null;
            const o = item as Record<string, unknown>;
            const discordId = String(o.discordId ?? o.discord_id ?? "").trim();
            return {
              rank: typeof o.rank === "number" ? o.rank : Number(o.rank) || 0,
              discordId,
              username: String(o.username ?? ""),
              avgX: typeof o.avgX === "number" ? o.avgX : Number(o.avgX) || 0,
              totalCalls:
                typeof o.totalCalls === "number"
                  ? o.totalCalls
                  : Number(o.totalCalls) || 0,
              wins: typeof o.wins === "number" ? o.wins : Number(o.wins) || 0,
            };
          })
          .filter((r): r is ApiLeaderRow => r !== null && r.username !== "");
        setData(parsed);
      } catch {
        if (!cancelled) setData([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeTab]);

  const scoreColumnLabel = activeTab === "user" ? "Wins" : "Calls";
  const showApiTable = activeTab !== "referrals";

  return (
    <div className="mx-auto max-w-[1100px]">
      <h1 className="text-xl font-semibold tracking-tight text-zinc-50 sm:text-2xl">
        Leaderboard
      </h1>

      <section className="mt-10">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-zinc-500">
          Top performers
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <PerformerCard
            leaderTitle="Weekly Leader"
            name={TOP_WEEKLY.name}
            metric={TOP_WEEKLY.metric}
            periodLabel={TOP_WEEKLY.label}
          />
          <PerformerCard
            leaderTitle="Monthly Leader"
            name={TOP_MONTHLY.name}
            metric={TOP_MONTHLY.metric}
            periodLabel={TOP_MONTHLY.label}
          />
        </div>
      </section>

      <section className="mt-12">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-zinc-500">
          Rankings
        </h2>
        <div className="flex flex-wrap gap-2">
          {TABS.map(({ id, label }) => {
            const active = activeTab === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setActiveTab(id)}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                  active
                    ? "bg-zinc-700 text-zinc-50"
                    : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-zinc-100"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>

        <div className="mt-6 w-full overflow-hidden rounded-xl border border-zinc-800/80 bg-zinc-900/60 p-4 shadow-sm shadow-black/20 backdrop-blur-sm sm:p-5">
          {loading && showApiTable ? (
            <div className="flex min-h-[120px] items-center justify-center py-10">
              <p className="text-sm text-zinc-500">Loading leaderboard...</p>
            </div>
          ) : activeTab === "referrals" ? (
            <div className="flex min-h-[120px] items-center justify-center py-10">
              <p className="text-sm text-zinc-500">
                Referrals leaderboard is not available yet.
              </p>
            </div>
          ) : data.length === 0 ? (
            <div className="flex min-h-[120px] items-center justify-center py-10">
              <p className="text-sm text-zinc-500">No leaderboard data yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[320px] border-separate border-spacing-0 text-left text-sm">
                <thead>
                  <tr className="border-b border-zinc-800/50">
                    <th
                      scope="col"
                      className="pb-2.5 pr-4 text-[10px] font-medium uppercase tracking-widest text-zinc-600 sm:text-[11px]"
                    >
                      Rank
                    </th>
                    <th
                      scope="col"
                      className="pb-2.5 pr-4 text-[10px] font-medium uppercase tracking-widest text-zinc-600 sm:text-[11px]"
                    >
                      User
                    </th>
                    <th
                      scope="col"
                      className="pb-2.5 pr-4 text-[10px] font-medium uppercase tracking-widest text-zinc-600 sm:text-[11px]"
                    >
                      Avg X
                    </th>
                    <th
                      scope="col"
                      className="pb-2.5 text-[10px] font-medium uppercase tracking-widest text-zinc-600 sm:text-[11px]"
                    >
                      {scoreColumnLabel}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/40 text-zinc-300">
                  {data.map((row) => (
                    <tr
                      key={`${activeTab}-${row.rank}-${row.discordId}`}
                      className="transition-colors duration-150 hover:bg-zinc-800/45"
                    >
                      <td className="py-3 pr-4 tabular-nums text-zinc-400">
                        #{row.rank}
                      </td>
                      <td className="py-3 pr-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <Link
                            href={`/user/${encodeURIComponent(row.discordId)}`}
                            className={PROFILE_LINK_CLASS}
                          >
                            {row.username}
                          </Link>
                          <FollowButton
                            targetDiscordId={row.discordId}
                            following={followingIds.has(row.discordId)}
                            onFollowingChange={(next) =>
                              setFollowing(row.discordId, next)
                            }
                          />
                        </div>
                      </td>
                      <td className="py-3 pr-4 font-semibold tabular-nums text-zinc-100">
                        {formatAvgX(row.avgX)}
                      </td>
                      <td className="py-3 tabular-nums text-zinc-400">
                        {activeTab === "user" ? row.wins : row.totalCalls}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
