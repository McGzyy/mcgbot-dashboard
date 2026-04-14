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
  const client = await getDiscordClient();
  if (!client) {
    throw new Error("Discord client is not available");
  }

  const channel = client.channels?.cache?.find?.(
    (c: any) => c?.name === "bot-calls"
  );

  if (!channel || !channel.isTextBased?.()) {
    throw new Error('Discord channel "bot-calls" not found');
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

  await handleCallCommand(fakeMessage, contractAddress, "dashboard");

  return {
    success: true,
    scan: null,
    trackedCall: null,
  };
}

