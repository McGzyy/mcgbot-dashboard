import type { ReactNode } from "react";

const MOCK_CALLS = [
  { token: "SOLXYZ", multiple: 3.4, caller: "user1" },
  { token: "ABC", multiple: 2.1, caller: "user2" },
  { token: "DEV123", multiple: 4.8, caller: "user3" },
] as const;

function PanelCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-[#1a1a1a] bg-[#0a0a0a] px-4 py-3 shadow-sm shadow-black/20 backdrop-blur-sm">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">
        {title}
      </h2>
      {children}
    </div>
  );
}

function topRankClass(rank: number): string {
  if (rank === 0) return "text-yellow-400";
  if (rank === 1) return "text-zinc-300";
  if (rank === 2) return "text-orange-400";
  return "text-zinc-200";
}

export default function LiveTrackedCallsPanel() {
  const rows = [...MOCK_CALLS].sort((a, b) => b.multiple - a.multiple);

  return (
    <PanelCard title="Live Tracked Calls">
      <ul className="mt-2 text-sm">
        {rows.map((row, idx) => (
          <li
            key={`${row.token}-${row.caller}-${idx}`}
            className="flex items-center justify-between gap-3 border-b border-[#1a1a1a] py-2 last:border-b-0"
          >
            <div className="min-w-0">
              <p className={`truncate font-semibold ${topRankClass(idx)}`}>
                {row.token}
              </p>
              <p className="mt-0.5 truncate text-xs text-zinc-500">
                {row.caller}
              </p>
            </div>
            <div className="shrink-0 text-right tabular-nums">
              <span className="font-semibold text-[#39FF14]">
                {row.multiple.toFixed(1)}x
              </span>
            </div>
          </li>
        ))}
      </ul>
    </PanelCard>
  );
}

export { LiveTrackedCallsPanel };

