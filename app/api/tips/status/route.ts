import { getServerSession } from "next-auth";
import { Connection, PublicKey } from "@solana/web3.js";
import { authOptions } from "@/lib/auth";
import { validateAndMarkTipConfirmed, type BotTipRow } from "@/lib/dashboardTipConfirm";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { solanaRpcUrlServer } from "@/lib/solanaEnv";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function rowToBotTip(row: Record<string, unknown>): BotTipRow | null {
  const id = typeof row.id === "string" ? row.id : "";
  const discord_id = typeof row.discord_id === "string" ? row.discord_id : "";
  const treasury_pubkey = typeof row.treasury_pubkey === "string" ? row.treasury_pubkey : "";
  const reference_pubkey = typeof row.reference_pubkey === "string" ? row.reference_pubkey : "";
  if (!id || !discord_id || !treasury_pubkey || !reference_pubkey) return null;
  return {
    id,
    discord_id,
    treasury_pubkey,
    amount_sol: row.amount_sol,
    amount_lamports: row.amount_lamports,
    reference_pubkey,
    memo: typeof row.memo === "string" ? row.memo : null,
  };
}

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const discordId = session?.user?.id?.trim() ?? "";
    if (!discordId) {
      return Response.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const ref = new URL(req.url).searchParams.get("reference")?.trim() ?? "";
    if (!ref || ref.length > 88) {
      return Response.json({ success: false, error: "Bad reference" }, { status: 400 });
    }

    const db = getSupabaseAdmin();
    if (!db) {
      return Response.json({ success: false, error: "Database not configured" }, { status: 503 });
    }

    const { data, error } = await db
      .from("bot_tips")
      .select(
        "id, discord_id, status, signature, from_wallet, treasury_pubkey, amount_sol, amount_lamports, reference_pubkey, memo"
      )
      .eq("reference_pubkey", ref)
      .maybeSingle();

    if (error || !data || typeof data !== "object") {
      return Response.json({ success: false, error: "Not found" }, { status: 404 });
    }

    const row = data as Record<string, unknown>;
    if (String(row.discord_id) !== discordId) {
      return Response.json({ success: false, error: "Not found" }, { status: 404 });
    }

    if (row.status === "confirmed") {
      return Response.json({
        success: true,
        status: "confirmed",
        signature: typeof row.signature === "string" ? row.signature : "",
        fromWallet: typeof row.from_wallet === "string" ? row.from_wallet : null,
      });
    }

    const botRow = rowToBotTip(row);
    if (botRow) {
      try {
        const connection = new Connection(solanaRpcUrlServer(), { commitment: "confirmed" });
        const sigs = await connection.getSignaturesForAddress(new PublicKey(ref), { limit: 10 });
        for (const s of sigs) {
          if (!s.signature || s.err) continue;
          const r = await validateAndMarkTipConfirmed({
            connection,
            db,
            row: botRow,
            signature: s.signature,
          });
          if (r.ok) {
            return Response.json({
              success: true,
              status: "confirmed",
              signature: s.signature,
              fromWallet: r.fromWallet,
            });
          }
        }
      } catch (e) {
        console.warn("[tips/status] chain probe:", e);
      }
    }

    return Response.json({ success: true, status: "pending" });
  } catch (e) {
    console.error("[tips/status]", e);
    return Response.json({ success: false, error: "Internal error" }, { status: 500 });
  }
}
