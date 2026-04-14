import { createRequire } from "module";
import { getDiscordClient } from "./discordClient";

type ProcessCallResult = {
  success: true;
  scan: unknown;
  trackedCall: unknown;
};

const require = createRequire(import.meta.url);

// Imported from existing bot command implementation (CommonJS).
const {
  handleCallCommand,
}: {
  handleCallCommand: (
    message: any,
    contractAddress: string,
    source?: string
  ) => Promise<unknown>;
} = require("../commands/basicCommands.js");

export async function processCall(
  contractAddress: string,
  _userId?: string
): Promise<ProcessCallResult> {
  console.log("Submitting call:", contractAddress);

  const client = await getDiscordClient();
  if (!client) {
    throw new Error("Discord client is not available");
  }

  const channel = client.channels.cache.find(
    (c: any) => c.name === "token-calls"
  );

  console.log("Channel found:", !!channel);

  if (!channel) {
    throw new Error("Channel not found: token-calls");
  }

  console.log("Using channel:", (channel as any)?.name);

  if (!channel.isTextBased?.()) {
    throw new Error('Discord channel "token-calls" is not text-based');
  }

  const fakeMessage = {
    author: { id: "dashboard_user" },
    member: null,
    channel,
    guild: (channel as any).guild,
    reply: async (payload: any) => {
      return await (channel as any).send(payload);
    },
  };

  try {
    await handleCallCommand(fakeMessage, contractAddress, "dashboard");
  } catch (err) {
    console.error("Call failed:", err);
    throw err;
  }

  console.log("Call command executed");

  return {
    success: true,
    scan: null,
    trackedCall: null,
  };
}

