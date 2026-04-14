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
  userId?: string
): Promise<ProcessCallResult> {
  console.log("STEP 1: Starting call", contractAddress);

  const client = await getDiscordClient();
  if (!client) {
    throw new Error("Discord client is not available");
  }
  console.log("STEP 2: Got Discord client");

  const channel = client.channels.cache.find(
    (c: any) => c.name === "token-calls"
  ) as any;

  console.log("STEP 3: Channel found:", channel?.name);

  if (!channel) {
    throw new Error("Channel not found: token-calls");
  }

  console.log("Using channel:", (channel as any)?.name);

  if (!channel.isTextBased?.()) {
    throw new Error('Discord channel "token-calls" is not text-based');
  }

  const fakeMessage = {
    id: "dashboard-call",
    author: {
      id: userId || "dashboard_user",
    },
    member: null,
    channel,
    guild: channel.guild,
    reply: async (payload: any) => {
      return await channel.send(payload);
    },
  };

  console.log("STEP 4: Calling handleCallCommand");
  try {
    await handleCallCommand(fakeMessage, contractAddress, "dashboard");
    console.log("STEP 5: handleCallCommand completed");
  } catch (err) {
    console.error("STEP 5 ERROR:", err);
    throw err;
  }

  return {
    success: true,
    scan: null,
    trackedCall: null,
  };
}

