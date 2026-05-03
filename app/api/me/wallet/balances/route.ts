import { Connection, PublicKey } from "@solana/web3.js";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { solanaRpcUrlServer, usdcMintForCluster } from "@/lib/solanaEnv";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CACHE_MS = 25_000;
const cache = new Map<string, { at: number; payload: Record<string, unknown> }>();

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const discordId = session?.user?.id?.trim() ?? "";
    if (!discordId) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const db = getSupabaseAdmin();
    if (!db) {
      return Response.json({ error: "Database not configured" }, { status: 503 });
    }

    const { data: row, error } = await db
      .from("dashboard_linked_wallets")
      .select("wallet_pubkey")
      .eq("discord_id", discordId)
      .maybeSingle();

    if (error) {
      console.error("[me/wallet/balances] select:", error);
      return Response.json({ error: "Could not load link" }, { status: 500 });
    }

    const pkStr =
      row && typeof row === "object" && typeof (row as Record<string, unknown>).wallet_pubkey === "string"
        ? String((row as Record<string, unknown>).wallet_pubkey).trim()
        : "";

    if (!pkStr) {
      return Response.json({ linked: false, sol: null, usdc: null });
    }

    const cached = cache.get(discordId);
    if (cached && Date.now() - cached.at < CACHE_MS) {
      return Response.json(cached.payload);
    }

    let owner: PublicKey;
    try {
      owner = new PublicKey(pkStr);
    } catch {
      return Response.json({ error: "Invalid linked pubkey" }, { status: 400 });
    }

    const mint = new PublicKey(usdcMintForCluster());
    const conn = new Connection(solanaRpcUrlServer(), "confirmed");

    const lamports = await conn.getBalance(owner, "confirmed");

    let usdcUi: number | null = null;
    let accounts: unknown[] = [];
    try {
      const tokenRes = await conn.getParsedTokenAccountsByOwner(owner, { mint }, "confirmed");
      accounts = tokenRes.value ?? [];
    } catch {
      accounts = [];
    }
    for (const a of accounts) {
      if (!a || typeof a !== "object") continue;
      const parsed = (a as Record<string, unknown>).account as Record<string, unknown> | undefined;
      const pdata = parsed?.data as Record<string, unknown> | undefined;
      const parsedInfo = pdata?.parsed as Record<string, unknown> | undefined;
      const info = parsedInfo?.info as Record<string, unknown> | undefined;
      const amt = info?.tokenAmount as Record<string, unknown> | undefined;
      const ui = amt?.uiAmount;
      if (typeof ui === "number" && Number.isFinite(ui)) {
        usdcUi = (usdcUi ?? 0) + ui;
      }
    }

    const sol = lamports / 1e9;
    const payload = {
      linked: true,
      walletPubkey: pkStr,
      sol: Number.isFinite(sol) ? sol : null,
      usdc: usdcUi != null && Number.isFinite(usdcUi) ? usdcUi : null,
    };

    cache.set(discordId, { at: Date.now(), payload });
    return Response.json(payload);
  } catch (e) {
    console.error("[me/wallet/balances] GET:", e);
    return Response.json({ error: "Could not load balances" }, { status: 500 });
  }
}
