import { randomBytes } from "crypto";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CHALLENGE_TTL_MS = 15 * 60 * 1000;

export async function POST() {
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

    const nonce = randomBytes(24).toString("base64url");
    const expiresAt = new Date(Date.now() + CHALLENGE_TTL_MS).toISOString();

    await db.from("wallet_link_challenges").delete().eq("discord_id", discordId);

    const { error } = await db.from("wallet_link_challenges").insert({
      discord_id: discordId,
      nonce,
      expires_at: expiresAt,
    });

    if (error) {
      console.error("[me/wallet/nonce] insert:", error);
      return Response.json({ error: "Could not start link" }, { status: 500 });
    }

    const message = [
      "Link wallet to McGBot Terminal",
      `Discord: ${discordId}`,
      `Nonce: ${nonce}`,
      `Expires (UTC): ${expiresAt}`,
    ].join("\n");

    return Response.json({ nonce, message, expiresAt });
  } catch (e) {
    console.error("[me/wallet/nonce] POST:", e);
    return Response.json({ error: "Internal error" }, { status: 500 });
  }
}
