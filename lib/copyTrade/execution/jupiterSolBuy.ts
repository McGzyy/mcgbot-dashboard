/**
 * Jupiter legacy v6 quote + swap (keyless public `quote-api.jup.ag`).
 * Override base with `JUPITER_SWAP_API_BASE` (e.g. `https://quote-api.jup.ag/v6`) if Jupiter moves hosts.
 */

const DEFAULT_JUPITER_V6_BASE = "https://quote-api.jup.ag/v6";

/** Native / wrapped SOL mint on Solana. */
export const SOL_MINT_MAINNET = "So11111111111111111111111111111111111111112";

export type JupiterQuote = Record<string, unknown>;

function jupiterBaseUrl(): string {
  const raw = process.env.JUPITER_SWAP_API_BASE?.trim() || DEFAULT_JUPITER_V6_BASE;
  return raw.replace(/\/$/, "");
}

export async function jupiterQuoteSolToMint(params: {
  outputMint: string;
  amountLamports: bigint;
  slippageBps: number;
  signal?: AbortSignal;
}): Promise<{ ok: true; quote: JupiterQuote } | { ok: false; error: string }> {
  const amount = params.amountLamports.toString();
  const slip = Math.max(0, Math.min(5000, Math.floor(params.slippageBps)));
  const u = new URL(`${jupiterBaseUrl()}/quote`);
  u.searchParams.set("inputMint", SOL_MINT_MAINNET);
  u.searchParams.set("outputMint", params.outputMint.trim());
  u.searchParams.set("amount", amount);
  u.searchParams.set("slippageBps", String(slip));

  let res: Response;
  try {
    res = await fetch(u.toString(), {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: params.signal,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: `jupiter_quote_fetch: ${msg}` };
  }

  if (!res.ok) {
    const t = await res.text().catch(() => "");
    return { ok: false, error: `jupiter_quote_http_${res.status}: ${t.slice(0, 400)}` };
  }

  let quote: unknown;
  try {
    quote = await res.json();
  } catch {
    return { ok: false, error: "jupiter_quote_invalid_json" };
  }

  if (!quote || typeof quote !== "object") {
    return { ok: false, error: "jupiter_quote_empty" };
  }

  const q = quote as Record<string, unknown>;
  if (typeof q.error === "string" && q.error.trim()) {
    return { ok: false, error: `jupiter_quote_error: ${q.error.trim().slice(0, 300)}` };
  }

  return { ok: true, quote: q };
}

export async function jupiterSwapTransactionBase64(params: {
  quote: JupiterQuote;
  userPublicKey: string;
  signal?: AbortSignal;
}): Promise<{ ok: true; swapTransaction: string } | { ok: false; error: string }> {
  let res: Response;
  try {
    res = await fetch(`${jupiterBaseUrl()}/swap`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      signal: params.signal,
      body: JSON.stringify({
        quoteResponse: params.quote,
        userPublicKey: params.userPublicKey.trim(),
        wrapAndUnwrapSol: true,
        dynamicComputeUnitLimit: true,
        prioritizationFeeLamports: "auto",
      }),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: `jupiter_swap_fetch: ${msg}` };
  }

  if (!res.ok) {
    const t = await res.text().catch(() => "");
    return { ok: false, error: `jupiter_swap_http_${res.status}: ${t.slice(0, 400)}` };
  }

  let body: unknown;
  try {
    body = await res.json();
  } catch {
    return { ok: false, error: "jupiter_swap_invalid_json" };
  }

  if (!body || typeof body !== "object") {
    return { ok: false, error: "jupiter_swap_empty" };
  }

  const st = body as Record<string, unknown>;
  const swapTx = st.swapTransaction;
  if (typeof swapTx !== "string" || !swapTx.trim()) {
    const err = st.error;
    const errStr = typeof err === "string" ? err : JSON.stringify(err);
    return { ok: false, error: `jupiter_swap_no_tx: ${errStr?.slice(0, 300) ?? "unknown"}` };
  }

  return { ok: true, swapTransaction: swapTx.trim() };
}
