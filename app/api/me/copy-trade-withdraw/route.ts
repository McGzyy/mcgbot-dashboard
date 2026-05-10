import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sendNativeLamportsTransfer } from "@/lib/copyTrade/execution/nativeSolTransfer";
import { solToLamportsBigInt } from "@/lib/copyTrade/sellRules";
import { loadCopyTradeUserKeypair } from "@/lib/copyTrade/userWalletService";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { Connection, PublicKey } from "@solana/web3.js";
import { solanaRpcUrlServer } from "@/lib/solanaEnv";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CONFIRM_MS = 60_000;

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    const uid = session?.user?.id?.trim() ?? "";
    if (!uid) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return Response.json({ error: "Invalid JSON" }, { status: 400 });

    const destRaw = typeof body.destination === "string" ? body.destination.trim() : "";
    const solRaw = body.sol;
    const sol = typeof solRaw === "number" ? solRaw : Number(solRaw);
    if (!destRaw) return Response.json({ error: "destination required" }, { status: 400 });
    if (!Number.isFinite(sol) || sol <= 0) return Response.json({ error: "sol must be a positive number" }, { status: 400 });

    let destination: PublicKey;
    try {
      destination = new PublicKey(destRaw);
    } catch {
      return Response.json({ error: "Invalid destination address" }, { status: 400 });
    }

    const db = getSupabaseAdmin();
    if (!db) return Response.json({ error: "Database not configured" }, { status: 503 });

    const { count, error: cErr } = await db
      .from("copy_trade_positions")
      .select("id", { count: "exact", head: true })
      .eq("discord_user_id", uid)
      .eq("status", "open");
    if (cErr) {
      console.error("[copy-trade-withdraw] count open", cErr);
      return Response.json({ error: "Could not verify positions" }, { status: 500 });
    }
    if (typeof count === "number" && count > 0) {
      return Response.json(
        { error: "Withdrawals are blocked while you have open copy-trade positions. Close them first." },
        { status: 400 }
      );
    }

    const kp = await loadCopyTradeUserKeypair(db, uid);
    if (!kp) return Response.json({ error: "Create your copy trade wallet first." }, { status: 400 });

    const lamports = solToLamportsBigInt(sol);
    if (lamports <= BigInt(0)) {
      return Response.json({ error: "Amount too small" }, { status: 400 });
    }

    const rpc = solanaRpcUrlServer();
    const connection = new Connection(rpc, "confirmed");
    const xfer = await sendNativeLamportsTransfer({
      connection,
      from: kp,
      to: destination,
      lamports,
      confirmMs: CONFIRM_MS,
    });

    if (!xfer.ok) {
      return Response.json({ ok: false, error: xfer.error }, { status: 400 });
    }
    return Response.json({ ok: true, signature: xfer.signature, sentLamports: xfer.sentLamports.toString() });
  } catch (e) {
    console.error("[copy-trade-withdraw POST]", e);
    return Response.json({ error: "Internal error" }, { status: 500 });
  }
}
