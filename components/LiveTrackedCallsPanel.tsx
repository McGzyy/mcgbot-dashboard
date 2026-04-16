'use client';

import { useEffect, useState } from "react";
import PanelCard from "@/components/PanelCard";

const MOCK_CALLS = [
  { token: "SOLXYZ", multiple: 3.4, caller: "user1" },
  { token: "ABC", multiple: 2.1, caller: "user2" },
  { token: "DEV123", multiple: 4.8, caller: "user3" },
];

export default function LiveTrackedCallsPanel() {
  const [calls, setCalls] = useState(MOCK_CALLS);

  useEffect(() => {
    const interval = setInterval(() => {
      setCalls((prev) =>
        prev.map((call) => ({
          ...call,
          multiple: Math.max(1, call.multiple + (Math.random() * 0.4 - 0.2)),
        }))
      );
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  const sorted = [...calls].sort((a, b) => b.multiple - a.multiple);

  return (
    <PanelCard title="📊 Live Calls">
      <ul className="mt-2 space-y-2">
        {sorted.map((call, i) => {
          let badgeStyle = "border-[#1a1a1a] bg-[#050505] text-zinc-200";

          if (i === 0)
            badgeStyle =
              "border-yellow-500/40 bg-yellow-500/10 text-yellow-300";
          else if (i === 1)
            badgeStyle = "border-zinc-400/40 bg-zinc-400/10 text-zinc-200";
          else if (i === 2)
            badgeStyle =
              "border-orange-500/40 bg-orange-500/10 text-orange-300";

          return (
            <li
              key={call.token}
              className="flex items-center justify-between rounded-lg border border-[#1a1a1a] bg-[#050505] px-3 py-2"
            >
              <div className="flex flex-col">
                <span className="font-medium text-zinc-100">
                  {call.token}
                </span>
                <span className="text-xs text-zinc-500">
                  {call.caller}
                </span>
              </div>

              <span
                className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${badgeStyle}`}
              >
                {call.multiple.toFixed(1)}x
              </span>
            </li>
          );
        })}
      </ul>
    </PanelCard>
  );
}

