import { PublicKey } from "@solana/web3.js";
import bs58 from "bs58";
import { getServerSession } from "next-auth";
import nacl from "tweetnacl";
import { authOptions } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseNonceFromMessage(message: string): string | null {
  const m = message.match(/^Nonce:\s*(.+)$/m);
  const raw = m?.[1]?.trim();
  return raw && raw.length > 0 ? raw : null;
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const discordId = session?.user?.id?.trim() ?? "";
    if (!discordId) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return Response.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const o = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
    const walletPubkey = typeof o.walletPubkey === "string" ? o.walletPubkey.trim() : "";
    const message = typeof o.message === "string" ? o.message : "";
    const signatureB58 = typeof o.signature === "string" ? o.signature.trim() : "";

    if (!walletPubkey || !message || !signatureB58) {
      return Response.json({ error: "Missing fields" }, { status: 400 });
    }

    let pk: PublicKey;
    try {
      pk = new PublicKey(walletPubkey);
    } catch {
      return Response.json({ error: "Invalid wallet address" }, { status: 400 });
    }

    const nonce = parseNonceFromMessage(message);
    if (!nonce) {
      return Response.json({ error: "Invalid message format" }, { status: 400 });
    }

    if (!message.includes(`Discord: ${discordId}`)) {
      return Response.json({ error: "Message does not match session" }, { status: 400 });
    }

    const db = getSupabaseAdmin();
    if (!db) {
      return Response.json({ error: "Database not configured" }, { status: 503 });
    }

    const { data: ch, error: chErr } = await db
      .from("wallet_link_challenges")
      .select("id, nonce, expires_at")
      .eq("discord_id", discordId)
      .eq("nonce", nonce)
      .maybeSingle();

    if (chErr || !ch) {
      return Response.json({ error: "Invalid or expired challenge" }, { status: 400 });
    }

    const exp = new Date(String((ch as Record<string, unknown>).expires_at ?? 0)).getTime();
    if (!Number.isFinite(exp) || Date.now() > exp) {
      await db.from("wallet_link_challenges").delete().eq("id", (ch as { id: string }).id);
      return Response.json({ error: "Challenge expired" }, { status: 400 });
    }

    let sigBytes: Uint8Array;
    try {
      sigBytes = bs58.decode(signatureB58);
    } catch {
      return Response.json({ error: "Invalid signature encoding" }, { status: 400 });
    }

    const msgBytes = new TextEncoder().encode(message);
    const ok = nacl.sign.detached.verify(msgBytes, sigBytes, pk.toBytes());
    if (!ok) {
      return Response.json({ error: "Signature verification failed" }, { status: 400 });
    }

    const nowIso = new Date().toISOString();

    await db.from("dashboard_linked_wallets").delete().eq("wallet_pubkey", pk.toBase58());
    await db.from("dashboard_linked_wallets").delete().eq("discord_id", discordId);

    const { error: upErr } = await db.from("dashboard_linked_wallets").insert({
      discord_id: discordId,
      chain: "solana",
      wallet_pubkey: pk.toBase58(),
      verified_at: nowIso,
      updated_at: nowIso,
    });

    if (upErr) {
      console.error("[me/wallet/verify] insert:", upErr);
      return Response.json({ error: "Could not save wallet" }, { status: 500 });
    }

    await db.from("wallet_link_challenges").delete().eq("discord_id", discordId);

    return Response.json({
      ok: true,
      wallet: {
        chain: "solana",
        walletPubkey: pk.toBase58(),
        verifiedAt: nowIso,
      },
    });
  } catch (e) {
    console.error("[me/wallet/verify] POST:", e);
    return Response.json({ error: "Internal error" }, { status: 500 });
  }
}
