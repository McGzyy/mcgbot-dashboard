export type ModStatBuckets = {
  approvals: number;
  denies: number;
  excludes: number;
  other: number;
  total: number;
};

export type ModStatsPayload = {
  success?: boolean;
  site?: { month: ModStatBuckets; allTime: ModStatBuckets };
  yours?: { month: ModStatBuckets; allTime: ModStatBuckets };
  actionCount?: number;
  generatedAt?: string;
  error?: string;
  code?: string;
  detail?: string;
  botApiBase?: string;
  steps?: string[];
};
