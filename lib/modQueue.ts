export type ModQueueCallApproval = {
  contractAddress: string;
  tokenName: string | null;
  ticker: string | null;
  approvalRequestedAt: string | null;
  approvalMessageId: string | null;
  approvalGuildId?: string | null;
  approvalChannelId?: string | null;
  /** Opens the #mod-approvals message in Discord when guild/channel/message ids are present. */
  discordJumpUrl?: string | null;
  firstCallerUsername: string | null;
  callSourceType: string | null;
  chain: string | null;
  /** ATH multiple from first print (same basis as bot approval ladder). */
  athMultipleX?: number | null;
  approvalTriggerX?: number | null;
  /** Highest ladder rung the spot currently satisfies. */
  eligibleTopMilestoneX?: number | null;
  /** Milestone rung associated with this approval cycle when set. */
  lastApprovalTriggerX?: number | null;
  approvalMilestonesTriggered?: number[];
};

export type ModQueueDevSubmission = {
  id: string;
  createdAt: string;
  updatedAt: string | null;
  submitterId: string | null;
  submitterUsername: string | null;
  nickname: string | null;
  walletAddresses: unknown;
  coinAddresses: unknown;
  tags: unknown;
  notes: string | null;
  approvalMessageId: string | null;
  approvalChannelId: string | null;
  approvalGuildId?: string | null;
  discordJumpUrl?: string | null;
};

export type ModQueuePayload = {
  success: boolean;
  /** Tracked calls pending staff review where `callSourceType === "bot_call"` (scanner / McGBot path). */
  callApprovals: ModQueueCallApproval[];
  /** Tracked calls pending review from non-bot sources (e.g. member/watch paths) — same #mod-approvals ladder, different origin. */
  callApprovalsUser?: ModQueueCallApproval[];
  /** Dev roster rows the bot has posted into #mod-approvals. */
  devSubmissions: ModQueueDevSubmission[];
  counts: {
    callApprovals: number;
    callApprovalsUser?: number;
    devSubmissions: number;
    total: number;
  };
  error?: string;
};
