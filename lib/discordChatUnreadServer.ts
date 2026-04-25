import {
  canUseModDashboardChatAsync,
  resolveDashboardChatChannelId,
} from "@/lib/dashboardChat";

function requireEnv(name: string): string {
  return (process.env[name] ?? "").trim();
}

export function resolveDiscordBotTokenForChat(): string {
  return requireEnv("DISCORD_TOKEN") || requireEnv("DISCORD_BOT_TOKEN") || "";
}

function asObj(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : null;
}

function str(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() ? v : undefined;
}

export function snowflakeCmp(a: string, b: string): number {
  try {
    const ba = BigInt(a.trim());
    const bb = BigInt(b.trim());
    if (ba < bb) return -1;
    if (ba > bb) return 1;
    return 0;
  } catch {
    return 0;
  }
}

async function discordGetJson(
  token: string,
  pathWithQuery: string
): Promise<{ ok: boolean; status: number; json: unknown }> {
  const res = await fetch(`https://discord.com/api/v10${pathWithQuery}`, {
    headers: { Authorization: `Bot ${token}` },
    cache: "no-store",
  });
  const json = await res.json().catch(() => null);
  return { ok: res.ok, status: res.status, json };
}

/** Newest message id in the channel, or null if empty / missing. */
export async function fetchLatestDiscordMessageId(
  token: string,
  channelId: string | null
): Promise<string | null> {
  if (!channelId || !token) return null;
  const qs = new URLSearchParams();
  qs.set("limit", "1");
  const { ok, json } = await discordGetJson(
    token,
    `/channels/${encodeURIComponent(channelId)}/messages?${qs.toString()}`
  );
  if (!ok || !Array.isArray(json) || json.length === 0) return null;
  const first = asObj(json[0]);
  const id = str(first?.id);
  return id ?? null;
}

export type UnreadSnapshot = {
  unread: number;
  latestId: string | null;
  capped: boolean;
};

/**
 * Count messages strictly newer than `lastRead` (Discord snowflake), capped at 100.
 * If `lastRead` is null/empty, returns unread 0 and still reports `latestId`.
 */
export async function unreadSnapshotForChannel(
  token: string,
  channelId: string | null,
  lastRead: string | null
): Promise<UnreadSnapshot> {
  if (!channelId || !token) {
    return { unread: 0, latestId: null, capped: false };
  }

  const latestId = await fetchLatestDiscordMessageId(token, channelId);
  if (!latestId) {
    return { unread: 0, latestId: null, capped: false };
  }

  const lr = (lastRead ?? "").trim();
  if (!lr) {
    return { unread: 0, latestId, capped: false };
  }

  if (snowflakeCmp(lr, latestId) >= 0) {
    return { unread: 0, latestId, capped: false };
  }

  const qs = new URLSearchParams();
  qs.set("after", lr);
  qs.set("limit", "100");
  const { ok, json } = await discordGetJson(
    token,
    `/channels/${encodeURIComponent(channelId)}/messages?${qs.toString()}`
  );
  if (!ok || !Array.isArray(json)) {
    return { unread: 0, latestId, capped: false };
  }

  const n = json.length;
  return { unread: n, latestId, capped: n >= 100 };
}

export async function buildDashboardChatUnreadPayload(opts: {
  userId: string;
  token: string;
  generalLastRead: string | null;
  modLastRead: string | null;
}): Promise<{
  general: UnreadSnapshot;
  mod?: UnreadSnapshot;
}> {
  const generalChannel = resolveDashboardChatChannelId("general");
  const modChannel = resolveDashboardChatChannelId("mod");

  const general = await unreadSnapshotForChannel(
    opts.token,
    generalChannel,
    opts.generalLastRead
  );

  const canMod = await canUseModDashboardChatAsync(opts.userId);
  if (!canMod) {
    return { general };
  }

  const mod = await unreadSnapshotForChannel(opts.token, modChannel, opts.modLastRead);
  return { general, mod };
}
