import { PublicKey } from "@solana/web3.js";
import nacl from "tweetnacl";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requirePremiumAndDiscord } from "@/app/api/pnl/_lib/pnlGate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function textBytes(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

function b64ToBytes(b64: string): Uint8Array | null {
  try {
    const buf = Buffer.from(b64, "base64");
    return new Uint8Array(buf);
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  const gate = await requirePremiumAndDiscord();
  if (!gate.ok) return gate.response;

  const db = getSupabaseAdmin();
  if (!db) {
    return Response.json({ success: false, error: "Database not configured" }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ success: false, error: "Invalid JSON" }, { status: 400 });
  }
  const o = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const walletPubkey = typeof o.walletPubkey === "string" ? o.walletPubkey.trim() : "";
  const signatureB64 = typeof o.signatureB64 === "string" ? o.signatureB64.trim() : "";
  const proofNonce = typeof o.nonce === "string" ? o.nonce.trim() : "";
  if (!walletPubkey || !signatureB64 || !proofNonce) {
    return Response.json({ success: false, error: "Missing wallet proof" }, { status: 400 });
  }

  let pk: PublicKey;
  try {
    pk = new PublicKey(walletPubkey);
  } catch {
    return Response.json({ success: false, error: "Invalid wallet pubkey" }, { status: 400 });
  }

  const message = `Link wallet to McGBot Terminal\n\nDiscord: ${gate.discordId}\nNonce: ${proofNonce}`;
  const sigBytes = b64ToBytes(signatureB64);
  if (!sigBytes) {
    return Response.json({ success: false, error: "Invalid signature" }, { status: 400 });
  }

  const ok = nacl.sign.detached.verify(textBytes(message), sigBytes, pk.toBytes());
  if (!ok) {
    return Response.json({ success: false, error: "Signature verification failed" }, { status: 400 });
  }

  const { error } = await db.from("pnl_wallets").upsert(
    {
      discord_id: gate.discordId,
      wallet_pubkey: pk.toBase58(),
      proof_nonce: proofNonce,
      proof_signature: signatureB64,
    },
    { onConflict: "discord_id,wallet_pubkey" }
  );

  if (error) {
    console.error("[pnl/wallets/confirm-link] upsert:", error);
    return Response.json({ success: false, error: "Failed to link wallet" }, { status: 500 });
  }

  // Also link this wallet for dashboard features (Wallet PnL, token activity, etc.).
  try {
    const nowIso = new Date().toISOString();
    await db.from("dashboard_linked_wallets").delete().eq("wallet_pubkey", pk.toBase58());
    await db.from("dashboard_linked_wallets").delete().eq("discord_id", gate.discordId);
    const { error: dashErr } = await db.from("dashboard_linked_wallets").insert({
      discord_id: gate.discordId,
      chain: "solana",
      wallet_pubkey: pk.toBase58(),
      verified_at: nowIso,
      updated_at: nowIso,
    });
    if (dashErr) console.error("[pnl/wallets/confirm-link] dashboard_linked_wallets insert:", dashErr);
  } catch (e) {
    console.error("[pnl/wallets/confirm-link] dashboard link:", e);
  }

  return Response.json({ success: true });
}

