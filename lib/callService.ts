import { createRequire } from "module";
import { postBotCallMessage } from "./discordClient";

type ProcessCallResult = {
  success: true;
  scan: unknown;
  trackedCall: unknown;
};

const require = createRequire(import.meta.url);

// Imported from existing bot command implementation (CommonJS).
const {
  runQuickCa,
  normalizeRealDataToScan,
  applyTrackedCallState,
}: {
  runQuickCa: (contractAddress: string) => Promise<unknown>;
  normalizeRealDataToScan: (realData: unknown) => any;
  applyTrackedCallState: (
    contractAddress: string,
    message: unknown,
    marketCap: number,
    liveScanData: unknown,
    options?: { callSourceType?: string }
  ) => Promise<{ trackedCall: unknown }>;
} = require("../commands/basicCommands.js");

export async function processCall(
  contractAddress: string,
  _userId?: string
): Promise<ProcessCallResult> {
  const realData = await runQuickCa(contractAddress);
  const scan = normalizeRealDataToScan(realData);

  const { trackedCall } = await applyTrackedCallState(
    contractAddress,
    null,
    scan.marketCap || 0,
    scan,
    { callSourceType: "user_call" }
  );

  try {
    await postBotCallMessage(contractAddress);
  } catch {
    // Best-effort: call processing should succeed even if Discord send fails.
  }

  return {
    success: true,
    scan,
    trackedCall,
  };
}

