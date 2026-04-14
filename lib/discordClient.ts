import type { Client } from "discord.js";

type TextChannelLike = {
  name?: string | null;
  isTextBased?: () => boolean;
  send?: (content: string) => Promise<unknown>;
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
          intents: [GatewayIntentBits.Guilds],
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

