import type { Connection, PublicKey } from "@solana/web3.js";

type RpcParsedTokenAccount = {
  account?: {
    data?: {
      parsed?: {
        info?: {
          tokenAmount?: { amount?: string };
        };
      };
    };
  };
};

/**
 * Executor SPL balance (raw amount) via `getTokenAccountsByOwner` JSON-RPC — no `@solana/spl-token` dep.
 */
export async function getTokenRawBalanceForMint(
  connection: Connection,
  owner: PublicKey,
  mint: PublicKey
): Promise<bigint> {
  const endpoint = connection.rpcEndpoint;
  const body = {
    jsonrpc: "2.0",
    id: 1,
    method: "getTokenAccountsByOwner",
    params: [
      owner.toBase58(),
      { mint: mint.toBase58() },
      { encoding: "jsonParsed" },
    ],
  };
  let res: Response;
  try {
    res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    return BigInt(0);
  }
  if (!res.ok) return BigInt(0);
  let json: unknown;
  try {
    json = await res.json();
  } catch {
    return BigInt(0);
  }
  if (!json || typeof json !== "object") return BigInt(0);
  const o = json as Record<string, unknown>;
  const result = o.result as Record<string, unknown> | undefined;
  const value = result?.value;
  if (!Array.isArray(value) || value.length === 0) return BigInt(0);
  const first = value[0] as RpcParsedTokenAccount;
  const amt = first?.account?.data?.parsed?.info?.tokenAmount?.amount;
  if (typeof amt !== "string" || !/^\d+$/.test(amt)) return BigInt(0);
  try {
    return BigInt(amt);
  } catch {
    return BigInt(0);
  }
}
