type TextChannelLike = {
  name?: string;
  isTextBased?: () => boolean;
  send?: (content: string) => Promise<unknown>;
};

type DiscordClientLike = {
  isReady?: () => boolean;
  login?: (token: string) => Promise<unknown>;
  once?: (event: string, cb: () => void) => void;
  channels?: { cache?: { find?: (fn: (c: any) => boolean) => any } };
};

let _clientPromise: Promise<DiscordClientLike | null> | null = null;

export async function getDiscordClient(): Promise<DiscordClientLike | null> {
  const token = process.env.DISCORD_TOKEN;
  if (!token) return null;

  if (_clientPromise) return _clientPromise;

  _clientPromise = (async () => {
    const { Client, GatewayIntentBits } = await import("discord.js");
    const client: DiscordClientLike = new Client({
      intents: [GatewayIntentBits.Guilds],
    }) as unknown as DiscordClientLike;

    await client.login?.(token);

    return client;
  })().catch(() => null);

  return _clientPromise;
}

export async function postBotCallMessage(contractAddress: string): Promise<void> {
  const client = await getDiscordClient();
  if (!client) return;

  const channel = client.channels?.cache?.find?.(
    (c: TextChannelLike) => c?.name === "bot-calls"
  ) as TextChannelLike | undefined;

  if (channel && channel.isTextBased?.()) {
    await channel.send?.(`📍 New call: ${contractAddress}`);
  }
}

