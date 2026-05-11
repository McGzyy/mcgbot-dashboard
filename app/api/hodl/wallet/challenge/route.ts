import { randomBytes } from "crypto";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hodlWalletLinkMessage } from "@/lib/hodl/walletLinkMessage";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const session = await getServerSession(authOptions);
  const discordId = session?.user?.id?.trim() ?? "";
  if (!discordId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session?.user?.hasDashboardAccess !== true) {
    return Response.json({ error: "Subscription required" }, { status: 402 });
  }

  const db = getSupabaseAdmin();
  if (!db) {
    return Response.json({ error: "Database not configured" }, { status: 503 });
  }

  const nonce = randomBytes(24).toString("base64url");
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

  const { error } = await db.from("hodl_wallet_challenges").insert({
    discord_id: discordId,
    nonce,
    expires_at: expiresAt,
  });
  if (error) {
    console.error("[hodl/wallet/challenge]", error);
    return Response.json({ error: "Could not create challenge" }, { status: 500 });
  }

  const messageUtf8 = new TextDecoder().decode(hodlWalletLinkMessage(nonce, discordId));

  return Response.json({
    nonce,
    expiresAt,
    message: messageUtf8,
  });
}
