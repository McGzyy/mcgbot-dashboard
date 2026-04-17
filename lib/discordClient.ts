import type { Client } from "discord.js";

type TextChannelLike = {
  id?: string;
  name?: string | null;
  isTextBased?: () => boolean;
  send?: (content: string) => Promise<unknown>;
  messages?: {
    fetch?: (opts?: { limit?: number }) => Promise<unknown>;
  };
};

export type DiscordChatMessage = {
  id: string;
  authorName: string;
  authorHandle?: string;
  content: string;
  createdAt: number;
};

let _clientPromise: Promise<Client> | null = null;

export async function getDiscordClient(): Promise<Client | null> {
  const token = process.env.DISCORD_TOKEN;
  if (!token) return null;

  if (_clientPromise) return _clientPromise;

  _clientPromise = new Promise((resolve, reject) => {
    void (async () => {
      try {
        const { Client, GatewayIntentBits } = await import("discord.js");
        const client = new Client({
          intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
        });

        client.once("ready", () => resolve(client));

        await client.login(token);
      } catch {
        reject(new Error("Failed to initialize Discord client"));
      }
    })();
  });

  return _clientPromise.catch(() => null);
}

function resolveTargetChannel(client: any): TextChannelLike | null {
  const byId = (process.env.DISCORD_GENERAL_CHAT_CHANNEL_ID ?? "").trim();
  if (byId) {
    const ch = client.channels?.cache?.get?.(byId);
    if (ch && ch.isTextBased?.()) return ch as TextChannelLike;
  }

  const byName = (
    process.env.DISCORD_GENERAL_CHAT_CHANNEL_NAME ??
    process.env.DISCORD_CHAT_CHANNEL_NAME ??
    "general-chat"
  )
    .trim()
    .toLowerCase();

  const ch = client.channels?.cache?.find?.(
    (c: any) => c?.isTextBased?.() && String(c?.name ?? "").toLowerCase() === byName
  );
  return ch ? (ch as TextChannelLike) : null;
}

export async function fetchGeneralChatMessages(
  limit = 25
): Promise<DiscordChatMessage[]> {
  const client = await getDiscordClient();
  if (!client) return [];
  const channel = resolveTargetChannel(client);
  if (!channel?.isTextBased?.() || !channel.messages?.fetch) return [];

  try {
    const raw: any = await channel.messages.fetch({ limit });
    const list: any[] = Array.isArray(raw)
      ? raw
      : raw?.values
        ? Array.from(raw.values())
        : raw?.map
          ? raw.map((x: any) => x)
          : [];

    return list
      .filter((m) => m && typeof m === "object")
      .map((m) => {
        const id = String(m.id ?? "");
        const content = String(m.content ?? "").trim();
        const createdAt =
          m.createdTimestamp != null ? Number(m.createdTimestamp) : Date.now();
        const authorName = String(m.author?.globalName ?? m.author?.username ?? "Unknown");
        const authorHandle = m.author?.username ? `@${String(m.author.username)}` : undefined;
        return { id, content, createdAt, authorName, authorHandle };
      })
      .filter((m) => m.id && m.content)
      .sort((a, b) => a.createdAt - b.createdAt);
  } catch {
    return [];
  }
}

export async function sendGeneralChatMessage(content: string): Promise<void> {
  const client = await getDiscordClient();
  if (!client) throw new Error("Discord client not configured");
  const channel = resolveTargetChannel(client);
  if (!channel?.isTextBased?.() || !channel.send) {
    throw new Error("General chat channel not found");
  }
  const msg = content.trim();
  if (!msg) return;
  await channel.send(msg);
}

export async function postBotCallMessage(contractAddress: string): Promise<void> {
  const client = await getDiscordClient();
  if (!client) return;

  const channel = client.channels.cache.find(
    (c: any) => c?.name === "bot-calls"
  ) as unknown as TextChannelLike | undefined;

  if (channel && channel.isTextBased?.()) {
    await channel.send?.(`📍 New call: ${contractAddress}`);
  }
}

