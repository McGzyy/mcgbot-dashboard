"use client";

import { useMemo, useState } from "react";

type TabId = "bot-calls" | "user-calls" | "referrals";

const TABS: { id: TabId; label: string }[] = [
  { id: "bot-calls", label: "Bot Calls" },
  { id: "user-calls", label: "User Calls" },
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

type Row = { rank: number; name: string; metric: string; score: string };

const MOCK_BY_TAB: Record<
  TabId,
  { metricColumn: string; rows: Row[] }
> = {
  "bot-calls": {
    metricColumn: "Avg X",
    rows: [
      { rank: 1, name: "mcgzzy", metric: "Avg X", score: "4.2x" },
      { rank: 2, name: "user2", metric: "Avg X", score: "3.8x" },
      { rank: 3, name: "alpha_caller", metric: "Avg X", score: "3.4x" },
      { rank: 4, name: "degen_dev", metric: "Avg X", score: "3.1x" },
      { rank: 5, name: "sol_scanner", metric: "Avg X", score: "2.9x" },
    ],
  },
  "user-calls": {
    metricColumn: "Win rate",
    rows: [
      { rank: 1, name: "caller_one", metric: "Win rate", score: "68%" },
      { rank: 2, name: "user2", metric: "Win rate", score: "61%" },
      { rank: 3, name: "whale_watcher", metric: "Win rate", score: "55%" },
      { rank: 4, name: "meme_lord", metric: "Win rate", score: "52%" },
      { rank: 5, name: "quiet_trader", metric: "Win rate", score: "48%" },
    ],
  },
  referrals: {
    metricColumn: "Referrals",
    rows: [
      { rank: 1, name: "mcgzzy", metric: "Referrals", score: "42" },
      { rank: 2, name: "user2", metric: "Referrals", score: "31" },
      { rank: 3, name: "invite_king", metric: "Referrals", score: "28" },
      { rank: 4, name: "community_mod", metric: "Referrals", score: "19" },
      { rank: 5, name: "new_member", metric: "Referrals", score: "12" },
    ],
  },
};

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
  const [activeTab, setActiveTab] = useState<TabId>("bot-calls");

  const { metricColumn, rows } = useMemo(
    () => MOCK_BY_TAB[activeTab],
    [activeTab]
  );

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
                    {metricColumn}
                  </th>
                  <th
                    scope="col"
                    className="pb-2.5 text-[10px] font-medium uppercase tracking-widest text-zinc-600 sm:text-[11px]"
                  >
                    Score
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/40 text-zinc-300">
                {rows.map((row) => (
                  <tr
                    key={`${activeTab}-${row.rank}-${row.name}`}
                    className="transition-colors duration-150 hover:bg-zinc-800/45"
                  >
                    <td className="py-3 pr-4 tabular-nums text-zinc-400">
                      #{row.rank}
                    </td>
                    <td className="py-3 pr-4 font-medium text-zinc-200">
                      {row.name}
                    </td>
                    <td className="py-3 pr-4 text-zinc-400">{row.metric}</td>
                    <td className="py-3 font-semibold tabular-nums text-zinc-100">
                      {row.score}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}
