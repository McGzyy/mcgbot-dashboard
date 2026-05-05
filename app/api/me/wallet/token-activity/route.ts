import { Connection } from "@solana/web3.js";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { solanaRpcUrlServer, usdcMintForCluster } from "@/lib/solanaEnv";
import { fetchWalletTokenActivityRows } from "@/lib/walletTokenActivity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CACHE_MS = 45_000;
const cache = new Map<string, { at: number; payload: unknown }>();

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const discordId = session?.user?.id?.trim() ?? "";
    if (!discordId) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const cached = cache.get(discordId);
    if (cached && Date.now() - cached.at < CACHE_MS) {
      return Response.json(cached.payload);
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
      console.error("[me/wallet/token-activity] select:", error);
      return Response.json({ error: "Could not load wallet link" }, { status: 500 });
    }

    const pkStr =
      row && typeof row === "object" && typeof (row as Record<string, unknown>).wallet_pubkey === "string"
        ? String((row as Record<string, unknown>).wallet_pubkey).trim()
        : "";

    if (!pkStr) {
      const payload = { linked: false as const, rows: [] as unknown[] };
      cache.set(discordId, { at: Date.now(), payload });
      return Response.json(payload);
    }

    const conn = new Connection(solanaRpcUrlServer(), "confirmed");
    const usdc = usdcMintForCluster();

    const rows = await fetchWalletTokenActivityRows(conn, pkStr, usdc, {
      signatureScan: 25,
      txDepth: 10,
    });

    const payload = {
      linked: true as const,
      walletPubkey: pkStr,
      rows: rows.map((r) => ({
        signature: r.signature,
        blockTime: r.blockTime,
        mints: r.mints,
        explorerUrl: `https://solscan.io/tx/${encodeURIComponent(r.signature)}`,
      })),
      hint:
        "Heuristic from your linked wallet + Solana RPC (token accounts touched). May miss some swaps or list unrelated mints — always verify before journaling.",
    };

    cache.set(discordId, { at: Date.now(), payload });
    return Response.json(payload);
  } catch (e) {
    console.error("[me/wallet/token-activity] GET:", e);
    return Response.json({ error: "Could not load activity" }, { status: 500 });
  }
}
