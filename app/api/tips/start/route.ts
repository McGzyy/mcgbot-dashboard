import { encodeURL } from "@solana/pay";
import { getServerSession } from "next-auth";
import BigNumber from "bignumber.js";
import { Connection, Keypair, LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import { authOptions } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { solanaClusterFromEnv, solanaRpcUrlServer } from "@/lib/solanaEnv";
import { TIP_MEMO, tipsTreasuryPubkeyFromEnv } from "@/lib/tipsConfig";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseAmountSol(body: unknown): number | null {
  if (!body || typeof body !== "object") return null;
  const raw = (body as Record<string, unknown>).amountSol;
  const n =
    typeof raw === "number"
      ? raw
      : typeof raw === "string"
        ? Number.parseFloat(raw)
        : Number.NaN;
  if (!Number.isFinite(n) || n <= 0 || n > 1_000) return null;
  return n;
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const discordId = session?.user?.id?.trim() ?? "";
    if (!discordId) {
      return Response.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => null);
    const amountSol = parseAmountSol(body);
    if (amountSol == null) {
      return Response.json({ success: false, error: "Invalid amount." }, { status: 400 });
    }

    const treasuryStr = tipsTreasuryPubkeyFromEnv();
    if (!treasuryStr) {
      return Response.json(
        {
          success: false,
          error:
            "Tips are not configured. Set SOLANA_TIPS_TREASURY_PUBKEY (or SOLANA_TREASURY_PUBKEY) to your funded Solana address.",
        },
        { status: 503 }
      );
    }

    let treasury: PublicKey;
    try {
      treasury = new PublicKey(treasuryStr);
    } catch {
      return Response.json(
        { success: false, error: "Invalid treasury public key in environment." },
        { status: 503 }
      );
    }

    const connection = new Connection(solanaRpcUrlServer(), { commitment: "confirmed" });
    const treasuryInfo = await connection.getAccountInfo(treasury);
    if (!treasuryInfo) {
      const cluster = solanaClusterFromEnv();
      return Response.json(
        {
          success: false,
          error: `Treasury has no on-chain account on ${cluster}. Send any amount of SOL to that treasury address once so it exists, then retry. Also ensure NEXT_PUBLIC_SOLANA_CLUSTER matches that network.`,
        },
        { status: 400 }
      );
    }

    const db = getSupabaseAdmin();
    if (!db) {
      return Response.json({ success: false, error: "Database not configured" }, { status: 503 });
    }

    const reference = Keypair.generate();
    const refStr = reference.publicKey.toBase58();
    const lamports = new BigNumber(amountSol)
      .times(LAMPORTS_PER_SOL)
      .integerValue(BigNumber.ROUND_FLOOR)
      .toNumber();

    const { error: insErr } = await db.from("bot_tips").insert({
      discord_id: discordId,
      amount_sol: amountSol,
      amount_lamports: lamports,
      reference_pubkey: refStr,
      treasury_pubkey: treasuryStr,
      memo: TIP_MEMO,
      status: "pending",
    });

    if (insErr) {
      console.error("[tips/start] insert:", insErr);
      return Response.json({ success: false, error: "Could not create tip session." }, { status: 500 });
    }

    const amountBn = new BigNumber(amountSol);
    const solanaPayUrl = encodeURL({
      recipient: treasury,
      amount: amountBn,
      reference: reference.publicKey,
      memo: TIP_MEMO,
      label: "McGBot",
      message: "Tip for McGBot",
    }).toString();

    const amountSolOut = amountBn.toFixed(9).replace(/\.?0+$/, "") || "0";

    return Response.json({
      success: true,
      solanaPayUrl,
      reference: refStr,
      treasury: treasuryStr,
      amountSol: amountSolOut,
      memo: TIP_MEMO,
    });
  } catch (e) {
    console.error("[tips/start]", e);
    return Response.json({ success: false, error: "Internal error" }, { status: 500 });
  }
}
