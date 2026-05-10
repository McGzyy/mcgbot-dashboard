import type { Connection } from "@solana/web3.js";

export async function waitForSignature(connection: Connection, signature: string, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const r = await connection.getSignatureStatuses([signature], { searchTransactionHistory: true });
    const s = r.value[0];
    if (s?.err) throw new Error(`tx_err:${JSON.stringify(s.err)}`);
    const st = s?.confirmationStatus;
    if (st === "confirmed" || st === "finalized") return;
    await new Promise((res) => setTimeout(res, 750));
  }
  throw new Error("confirmation_timeout");
}
