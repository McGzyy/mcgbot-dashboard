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
  callApprovals: ModQueueCallApproval[];
  devSubmissions: ModQueueDevSubmission[];
  counts: {
    callApprovals: number;
    devSubmissions: number;
    total: number;
  };
  error?: string;
};
