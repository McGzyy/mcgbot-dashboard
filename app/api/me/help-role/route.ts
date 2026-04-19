import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { meetsModerationMinTier, resolveHelpTierWithSource } from "@/lib/helpRole";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  const id = session?.user?.id?.trim();
  if (!id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { tier: role, source: staffSource } = await resolveHelpTierWithSource(id);
  const modChatConfigured = !!(process.env.DISCORD_MOD_CHAT_CHANNEL_ID ?? "").trim();
  const guildStaffConfigured = !!(
    (process.env.DISCORD_GUILD_ID ?? "").trim() &&
    ((process.env.DISCORD_BOT_TOKEN ?? "").trim() || (process.env.DISCORD_TOKEN ?? "").trim())
  );
  const canModerate = meetsModerationMinTier(role);
  const moderationMinTier =
    (process.env.MODERATION_MIN_TIER ?? "mod").trim().toLowerCase() === "admin" ? "admin" : "mod";

  return Response.json({
    role,
    canModerate,
    moderationMinTier,
    modChatConfigured,
    staffSource,
    guildStaffConfigured,
  });
}
