import {
  callTimeMs,
  formatCalledSnapshotLine,
  formatJoinedAt,
} from "@/lib/callDisplayFormat";

export type ProfileCallStripPoint = {
  key: string;
  label: string;
  multiple: number;
  fill: string;
  timeMs: number;
  summary: string;
  timeLabel: string;
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

export function buildProfileCallStripSeries(
  calls: {
    multiple: number;
    time: unknown;
    excludedFromStats?: boolean;
    tokenName?: string | null;
    tokenTicker?: string | null;
    callMarketCapUsd?: number | null;
    token?: string;
  }[],
  limit = 20,
  nowMs = Date.now()
): ProfileCallStripPoint[] {
  const eligible = (calls || []).filter(
    (c) =>
      c.excludedFromStats !== true &&
      typeof c.multiple === "number" &&
      Number.isFinite(c.multiple)
  );
  const sorted = [...eligible].sort(
    (a, b) => callTimeMs(a.time) - callTimeMs(b.time)
  );
  const slice = sorted.slice(-Math.max(1, limit));

  return slice.map((c, i) => {
    const timeMs = callTimeMs(c.time);
    const summary = formatCalledSnapshotLine({
      tokenName: c.tokenName,
      tokenTicker: c.tokenTicker,
      callMarketCapUsd: c.callMarketCapUsd ?? null,
      callCa: c.token,
    });
    return {
      key: `${timeMs}-${i}`,
      label: String(i + 1),
      multiple: Math.max(0, c.multiple),
      fill: multipleBarFill(c.multiple),
      timeMs,
      summary,
      timeLabel: formatJoinedAt(timeMs, nowMs, "compact"),
    };
  });
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
