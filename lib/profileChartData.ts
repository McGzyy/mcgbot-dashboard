import {
  callTimeMs,
  formatCalledSnapshotLine,
  formatJoinedAt,
} from "@/lib/callDisplayFormat";

export type ProfileTrackMetric =
  | "avg_x"
  | "win_rate"
  | "total_calls"
  | "rate_2x"
  | "rate_4x";

export type ProfileChartPoint = {
  key: string;
  label: string;
  value: number;
  fill: string;
  detail?: string;
};

export type ProfileChartView = {
  title: string;
  subtitle: string;
  kind: "bar" | "donut";
  points: ProfileChartPoint[];
  valueSuffix: "x" | "%" | "calls";
};

export type ProfileDistributionSegment = {
  key: string;
  label: string;
  count: number;
  fill: string;
};

export function multipleBarFill(multiple: number): string {
  if (multiple >= 2) return "#34d399";
  if (multiple < 1) return "#f87171";
  return "#94a3b8";
}

const DISTRIBUTION_FILLS = {
  under1: "#f87171",
  oneToTwo: "#94a3b8",
  twoToFive: "#34d399",
  fivePlus: "#22d3ee",
} as const;

type RecentCallForChart = {
  multiple: number;
  time: unknown;
  excludedFromStats?: boolean;
  tokenName?: string | null;
  tokenTicker?: string | null;
  callMarketCapUsd?: number | null;
  token?: string;
};

function eligibleCalls(calls: RecentCallForChart[]) {
  return (calls || []).filter(
    (c) =>
      c.excludedFromStats !== true &&
      typeof c.multiple === "number" &&
      Number.isFinite(c.multiple)
  );
}

export function buildProfileTrackChartView(
  metric: ProfileTrackMetric,
  input: {
    recentCalls: RecentCallForChart[];
    callDistribution?: {
      under1: number;
      oneToTwo: number;
      twoToFive: number;
      fivePlus: number;
      total: number;
    };
    stats: { avgX: number; winRate: number; totalCalls: number };
    hitRates: { rate2x: number | null; rate4x: number | null };
  },
  nowMs = Date.now()
): ProfileChartView {
  const calls = eligibleCalls(input.recentCalls);
  const winPct = Math.max(0, Math.min(100, input.stats.winRate));
  const lossPct = Math.max(0, 100 - winPct);
  const rate2x = input.hitRates.rate2x ?? 0;
  const rate4x = input.hitRates.rate4x ?? 0;

  switch (metric) {
    case "avg_x": {
      const sorted = [...calls].sort(
        (a, b) => callTimeMs(a.time) - callTimeMs(b.time)
      );
      const slice = sorted.slice(-20);
      return {
        title: "Recent multiples",
        subtitle: "Last calls · oldest → newest",
        kind: "bar",
        valueSuffix: "x",
        points: slice.map((c, i) => ({
          key: `${callTimeMs(c.time)}-${i}`,
          label: String(i + 1),
          value: Math.max(0, c.multiple),
          fill: multipleBarFill(c.multiple),
          detail: formatCalledSnapshotLine({
            tokenName: c.tokenName,
            tokenTicker: c.tokenTicker,
            callMarketCapUsd: c.callMarketCapUsd ?? null,
            callCa: c.token,
          }),
        })),
      };
    }
    case "win_rate":
      return {
        title: "Win vs loss",
        subtitle: "Share of calls above 1×",
        kind: "donut",
        valueSuffix: "%",
        points: [
          { key: "win", label: "Wins", value: winPct, fill: "#34d399" },
          { key: "loss", label: "Losses", value: lossPct, fill: "#f87171" },
        ],
      };
    case "total_calls": {
      const d = input.callDistribution;
      const buckets = d
        ? [
            { key: "under1", label: "<1×", count: d.under1, fill: DISTRIBUTION_FILLS.under1 },
            {
              key: "oneToTwo",
              label: "1–2×",
              count: d.oneToTwo,
              fill: DISTRIBUTION_FILLS.oneToTwo,
            },
            {
              key: "twoToFive",
              label: "2–5×",
              count: d.twoToFive,
              fill: DISTRIBUTION_FILLS.twoToFive,
            },
            {
              key: "fivePlus",
              label: "5×+",
              count: d.fivePlus,
              fill: DISTRIBUTION_FILLS.fivePlus,
            },
          ]
        : [];
      return {
        title: "Call buckets",
        subtitle: d
          ? `${d.total.toLocaleString()} calls by multiple range`
          : "Distribution across all recorded calls",
        kind: "bar",
        valueSuffix: "calls",
        points: buckets.map((b) => ({
          key: b.key,
          label: b.label,
          value: b.count,
          fill: b.fill,
        })),
      };
    }
    case "rate_2x":
      return {
        title: "2× hit rate",
        subtitle: "Calls reaching at least 2×",
        kind: "donut",
        valueSuffix: "%",
        points: [
          { key: "hit", label: "Hit 2×+", value: rate2x, fill: "#34d399" },
          {
            key: "miss",
            label: "Below 2×",
            value: Math.max(0, 100 - rate2x),
            fill: "#71717a",
          },
        ],
      };
    case "rate_4x":
      return {
        title: "4× hit rate",
        subtitle: "Calls reaching at least 4×",
        kind: "donut",
        valueSuffix: "%",
        points: [
          { key: "hit", label: "Hit 4×+", value: rate4x, fill: "#22d3ee" },
          {
            key: "miss",
            label: "Below 4×",
            value: Math.max(0, 100 - rate4x),
            fill: "#71717a",
          },
        ],
      };
    default:
      return buildProfileTrackChartView("avg_x", input, nowMs);
  }
}

export function buildProfileDistributionSegments(dist: {
  under1: number;
  oneToTwo: number;
  twoToFive: number;
  fivePlus: number;
  total: number;
}): ProfileDistributionSegment[] {
  return [
    { key: "under1", label: "<1×", count: dist.under1, fill: DISTRIBUTION_FILLS.under1 },
    {
      key: "oneToTwo",
      label: "1–2×",
      count: dist.oneToTwo,
      fill: DISTRIBUTION_FILLS.oneToTwo,
    },
    {
      key: "twoToFive",
      label: "2–5×",
      count: dist.twoToFive,
      fill: DISTRIBUTION_FILLS.twoToFive,
    },
    { key: "fivePlus", label: "5×+", count: dist.fivePlus, fill: DISTRIBUTION_FILLS.fivePlus },
  ];
}
