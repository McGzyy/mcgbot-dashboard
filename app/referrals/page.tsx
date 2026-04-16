"use client";

import { useEffect, useState } from "react";

type Referral = {
  username: string;
  joinedAt: string;
};

type TopCoin = {
  symbol: string;
  multiplier: number;
  image: string | null;
};

type ReferralPerformance = {
  username: string;
  calls: number;
  avgX: number;
  bestX: number;
  active: boolean;
  topCoins?: TopCoin[];
};

export default function ReferralsPage() {
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [performance, setPerformance] = useState<ReferralPerformance[]>([]);

  const topReferral = performance
    .filter((p) => p.calls > 0)
    .sort((a, b) => b.avgX - a.avgX)[0];

  useEffect(() => {
    // placeholder mock data for now
    setReferrals([
      { username: "user_1", joinedAt: "2 hours ago" },
      { username: "user_2", joinedAt: "5 hours ago" },
      { username: "user_3", joinedAt: "1 day ago" },
    ]);

    setPerformance([
      {
        username: "user_1",
        calls: 5,
        avgX: 2.8,
        bestX: 4.2,
        active: true,
        topCoins: [
          {
            symbol: "SOLX",
            multiplier: 4.2,
            image: null,
          },
          {
            symbol: "ALPHA",
            multiplier: 3.1,
            image: null,
          },
          {
            symbol: "DGN",
            multiplier: 2.7,
            image: null,
          },
        ],
      },
    ]);
  }, []);

  return (
    <div className="mx-auto w-full max-w-[1100px] space-y-4 px-4 py-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-zinc-100">Referrals</h1>
        <p className="text-sm text-zinc-500">Invite others and track your growth</p>
      </div>

      {/* Referral Link */}
      <div className="rounded-xl border border-[#1a1a1a] bg-[#0a0a0a] p-4">
        <p className="mb-2 text-sm text-zinc-500">Your Referral Link</p>
        <div className="flex items-center justify-between rounded-lg bg-zinc-800/60 px-3 py-2">
          <span className="truncate text-sm text-zinc-200">
            https://mcgbot.xyz/ref/your-id
          </span>
          <button className="text-xs font-medium text-[#39FF14] hover:underline">
            Copy
          </button>
        </div>
      </div>

      <p className="mb-2 text-xs text-zinc-600">Your Network</p>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {topReferral && (
          <div className="rounded-xl border border-[#2a2415] bg-[#0a0a0a] p-4 shadow-[0_0_20px_rgba(255,215,0,0.08)] hover:shadow-[0_0_30px_rgba(255,215,0,0.15)] transition-shadow">
            <p className="mb-1 text-xs text-zinc-600">🏆 Top Referral</p>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-zinc-100">{topReferral.username}</p>
                <p className="text-xs text-zinc-600">{topReferral.calls} calls</p>
              </div>

              <div className="text-right text-xs leading-tight">
                <p className="text-[#39FF14]">
                  <span className="mr-1 text-zinc-600">avg</span>
                  {topReferral.avgX}x
                </p>
                <p className="text-amber-300">
                  <span className="mr-1 text-zinc-600">best</span>
                  {topReferral.bestX}x
                </p>
              </div>
            </div>

            {/* Mini coins */}
            <div className="mt-3 flex gap-2">
              {(topReferral.topCoins ?? []).slice(0, 3).map((coin) => (
                <div
                  key={coin.symbol}
                  className="flex items-center gap-1 rounded-md border border-[#1a1a1a] bg-[#050505] px-2 py-1 text-[11px]"
                >
                  <span className="text-zinc-300">{coin.symbol}</span>
                  <span className="text-[#39FF14]">{coin.multiplier}x</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="rounded-xl border border-[#1a1a1a] bg-[#0a0a0a] p-4">
          <p className="text-xs text-zinc-600">Total Referrals</p>
          <p className="text-lg font-semibold text-zinc-100">{referrals.length}</p>
        </div>

        <div className="rounded-xl border border-[#1a1a1a] bg-[#0a0a0a] p-4">
          <p className="text-xs text-zinc-600">Active Users</p>
          <p className="text-lg font-semibold text-zinc-100">{referrals.length}</p>
        </div>

        <div className="rounded-xl border border-[#1a1a1a] bg-[#0a0a0a] p-4">
          <p className="text-xs text-zinc-600">Conversion Rate</p>
          <p className="text-lg font-semibold text-zinc-100">—%</p>
        </div>
      </div>

      {/* How it works */}
      <div className="rounded-xl border border-[#1a1a1a] bg-[#0a0a0a] px-4 py-3 text-xs text-zinc-600">
        Share your link → users join → their activity contributes to rewards
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* LEFT */}
        <div className="space-y-4">
          {/* Recent Referrals */}
          <div className="rounded-xl border border-[#1a1a1a] bg-[#0a0a0a] p-4">
            <p className="mb-3 text-sm font-medium text-zinc-200">Recent Referrals</p>

            <div className="space-y-2">
              {referrals.map((ref, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between rounded-lg border border-[#1a1a1a] bg-[#050505] px-3 py-2"
                >
                  <span className="text-sm text-zinc-200">{ref.username}</span>
                  <span className="text-xs text-zinc-600">{ref.joinedAt}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT */}
        <div className="space-y-4">
          <div className="rounded-xl border border-[#1a1a1a] bg-[#0a0a0a] p-4">
            <p className="mb-3 text-sm font-medium text-zinc-200">Referral Performance</p>

            <div className="space-y-2">
              {performance.map((p, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between rounded-lg border border-[#1a1a1a] bg-[#050505] px-3 py-3"
                >
                  <div className="flex flex-col">
                    <span className="text-sm text-zinc-200">{p.username}</span>
                    <span className="text-xs text-zinc-600">{p.calls} calls</span>
                  </div>

                  <div className="flex items-center gap-4 text-xs">
                    <span className="text-zinc-400">
                      Avg:{" "}
                      <span className="text-[#39FF14] drop-shadow-[0_0_6px_rgba(57,255,20,0.25)]">
                        {p.avgX > 0 ? `${p.avgX}x` : "—"}
                      </span>
                    </span>

                    <span className="text-zinc-400">
                      Best:{" "}
                      <span className="text-amber-300">
                        {p.bestX > 0 ? `${p.bestX}x` : "—"}
                      </span>
                    </span>

                    <span
                      className={
                        p.active
                          ? "text-[#39FF14] drop-shadow-[0_0_6px_rgba(57,255,20,0.25)]"
                          : "text-zinc-600"
                      }
                    >
                      {p.active ? "Active" : "Inactive"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Rewards (Locked) */}
      <div className="rounded-xl border border-[#1a1a1a] bg-[#0a0a0a] p-4">
        <p className="mb-2 text-sm font-medium text-zinc-200">Rewards</p>

        <div className="rounded-lg border border-dashed border-[#1a1a1a] bg-[#050505] p-4 text-center">
          <p className="text-sm text-zinc-500">🔒 Rewards are currently locked</p>
          <p className="mt-1 text-xs text-zinc-600">
            Reach referral milestones to unlock rewards
          </p>
        </div>
      </div>
    </div>
  );
}
