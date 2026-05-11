import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { verifyHodlWalletLinkSignature } from "@/lib/hodl/walletLinkMessage";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  const discordId = session?.user?.id?.trim() ?? "";
  if (!discordId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session?.user?.hasDashboardAccess !== true) {
    return Response.json({ error: "Subscription required" }, { status: 402 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const o = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const nonce = typeof o.nonce === "string" ? o.nonce.trim() : "";
  const walletPubkey = typeof o.walletPubkey === "string" ? o.walletPubkey.trim() : "";
  const signatureBs58 = typeof o.signatureBs58 === "string" ? o.signatureBs58.trim() : "";
  if (!nonce || !walletPubkey || !signatureBs58) {
    return Response.json({ error: "Missing nonce, walletPubkey, or signatureBs58" }, { status: 400 });
  }

  const db = getSupabaseAdmin();
  if (!db) {
    return Response.json({ error: "Database not configured" }, { status: 503 });
  }

  const { data: ch, error: chErr } = await db
    .from("hodl_wallet_challenges")
    .select("id, expires_at")
    .eq("discord_id", discordId)
    .eq("nonce", nonce)
    .maybeSingle();

  if (chErr || !ch) {
    return Response.json({ error: "Invalid or expired challenge" }, { status: 400 });
  }
  const exp = new Date(String((ch as { expires_at?: string }).expires_at ?? "")).getTime();
  if (!Number.isFinite(exp) || exp < Date.now()) {
    return Response.json({ error: "Challenge expired" }, { status: 400 });
  }

  if (!verifyHodlWalletLinkSignature({ discordId, nonce, walletPubkeyBs58: walletPubkey, signatureBs58 })) {
    return Response.json({ error: "Signature verification failed" }, { status: 400 });
  }

  const { data: dash } = await db
    .from("dashboard_linked_wallets")
    .select("wallet_pubkey")
    .eq("discord_id", discordId)
    .maybeSingle();
  const dashPk =
    dash && typeof (dash as { wallet_pubkey?: string }).wallet_pubkey === "string"
      ? (dash as { wallet_pubkey: string }).wallet_pubkey.trim()
      : "";
  if (dashPk && dashPk === walletPubkey) {
    return Response.json(
      {
        error: "This wallet is already your primary linked wallet. Choose “Primary linked wallet” instead.",
      },
      { status: 400 }
    );
  }

  const { data: otherUser } = await db
    .from("dashboard_linked_wallets")
    .select("discord_id")
    .eq("wallet_pubkey", walletPubkey)
    .maybeSingle();
  if (otherUser && (otherUser as { discord_id?: string }).discord_id !== discordId) {
    return Response.json({ error: "That wallet is linked to another McGBot account." }, { status: 409 });
  }

  const { data: hodlOther } = await db
    .from("hodl_linked_wallets")
    .select("discord_id")
    .eq("wallet_pubkey", walletPubkey)
    .maybeSingle();
  if (hodlOther && (hodlOther as { discord_id?: string }).discord_id !== discordId) {
    return Response.json({ error: "That wallet is already used for HODL by another account." }, { status: 409 });
  }

  const nowIso = new Date().toISOString();
  const { error: upErr } = await db.from("hodl_linked_wallets").upsert(
    {
      discord_id: discordId,
      wallet_pubkey: walletPubkey,
      verified_at: nowIso,
      updated_at: nowIso,
    },
    { onConflict: "discord_id" }
  );
  if (upErr) {
    console.error("[hodl/wallet/verify upsert]", upErr);
    return Response.json({ error: "Could not save HODL wallet" }, { status: 500 });
  }

  await db.from("hodl_wallet_challenges").delete().eq("nonce", nonce);

  return Response.json({
    success: true,
    wallet: { walletPubkey, verifiedAt: nowIso, scope: "hodl_only" as const },
  });
}
