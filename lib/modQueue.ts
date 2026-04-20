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
  /** McGBot `bot_call` rows pending mod review (X posting gate). */
  callApprovals: ModQueueCallApproval[];
  /** User/watch (non–bot_call) pendings still visible for staff parity with Discord. */
  callApprovalsUser?: ModQueueCallApproval[];
  devSubmissions: ModQueueDevSubmission[];
  counts: {
    callApprovals: number;
    callApprovalsUser?: number;
    devSubmissions: number;
    total: number;
  };
  error?: string;
};
