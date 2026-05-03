import { Connection, PublicKey } from "@solana/web3.js";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { isDiscordGuildMember } from "@/lib/discordGuildMember";
import { liveDashboardAccessForDiscordId } from "@/lib/dashboardGate";
import { solanaRpcUrlServer } from "@/lib/solanaEnv";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseBigint(v: unknown): bigint {
  if (typeof v === "bigint") return v;
  if (typeof v === "number" && Number.isFinite(v)) return BigInt(Math.floor(v));
  const s = typeof v === "string" ? v.trim() : String(v ?? "").trim();
  try {
    return BigInt(s || "0");
  } catch {
    return BigInt(0);
  }
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  const discordId = session?.user?.id?.trim() ?? "";
  if (!discordId) {
    return Response.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const hasAccess =
    session?.user?.hasDashboardAccess === true ||
    session?.user?.subscriptionExempt === true ||
    (await liveDashboardAccessForDiscordId(discordId).catch(() => false));
  if (!hasAccess) {
    return Response.json({ success: false, error: "Subscription required" }, { status: 402 });
  }

  const inGuild = await isDiscordGuildMember(discordId);
  if (inGuild !== true) {
    return Response.json(
      { success: false, error: "Discord membership required" },
      { status: 403 }
    );
  }

  const url = new URL(req.url);
  const reference = (url.searchParams.get("reference") ?? "").trim();
  if (!reference) {
    return Response.json({ success: false, error: "Missing reference" }, { status: 400 });
  }

  const db = getSupabaseAdmin();
  if (!db) {
    return Response.json({ success: false, error: "Database not configured" }, { status: 503 });
  }

  const { data: tip, error } = await db
    .from("bot_tips")
    .select("id, discord_id, amount_lamports, treasury_pubkey, status, signature, from_wallet, confirmed_at")
    .eq("reference_pubkey", reference)
    .maybeSingle();

  if (error) {
    console.error("[tips/status] select:", error);
    return Response.json({ success: false, error: "Could not load tip" }, { status: 500 });
  }

  if (!tip || String((tip as any).discord_id ?? "") !== discordId) {
    return Response.json({ success: false, error: "Not found" }, { status: 404 });
  }

  const status = String((tip as any).status ?? "pending");
  const existingSig = typeof (tip as any).signature === "string" ? (tip as any).signature.trim() : "";
  if (status === "confirmed" && existingSig) {
    return Response.json({
      success: true,
      status: "confirmed",
      signature: existingSig,
      fromWallet: (tip as any).from_wallet ?? null,
      confirmedAt: (tip as any).confirmed_at ?? null,
    });
  }

  let refPk: PublicKey;
  let treasuryPk: PublicKey;
  try {
    refPk = new PublicKey(reference);
    treasuryPk = new PublicKey(String((tip as any).treasury_pubkey ?? ""));
  } catch {
    return Response.json({ success: false, error: "Invalid reference" }, { status: 400 });
  }

  const needLamports = parseBigint((tip as any).amount_lamports);
  const conn = new Connection(solanaRpcUrlServer(), "confirmed");

  // Look for a transaction that mentions the reference (as an extra account) and pays the treasury.
  const sigs = await conn.getSignaturesForAddress(refPk, { limit: 20 }).catch(() => []);
  for (const s of sigs) {
    const sig = s.signature;
    if (!sig) continue;
    const tx = await conn.getParsedTransaction(sig, { maxSupportedTransactionVersion: 0 }).catch(() => null);
    if (!tx) continue;

    const messageKeys = tx.transaction.message.accountKeys.map((k) => k.pubkey.toBase58());
    if (!messageKeys.includes(treasuryPk.toBase58())) continue;

    let matched = false;
    let fromWallet: string | null = null;

    // Parsed instructions: look for system transfer to treasury.
    for (const ix of tx.transaction.message.instructions) {
      if ("parsed" in ix) {
        const parsed: any = (ix as any).parsed;
        if (parsed?.type !== "transfer") continue;
        const info = parsed?.info;
        if (!info) continue;
        const dst = String(info.destination ?? "");
        const src = String(info.source ?? "");
        const lamports = parseBigint(info.lamports);
        if (dst === treasuryPk.toBase58() && lamports >= needLamports) {
          matched = true;
          fromWallet = src || null;
          break;
        }
      }
    }

    if (!matched) continue;

    const nowIso = new Date().toISOString();
    const { error: upErr } = await db
      .from("bot_tips")
      .update({
        status: "confirmed",
        signature: sig,
        from_wallet: fromWallet,
        confirmed_at: nowIso,
      })
      .eq("reference_pubkey", reference)
      .eq("discord_id", discordId);

    if (upErr) {
      console.error("[tips/status] update:", upErr);
    }

    return Response.json({
      success: true,
      status: "confirmed",
      signature: sig,
      fromWallet,
      confirmedAt: nowIso,
    });
  }

  return Response.json({ success: true, status: "pending" });
}

