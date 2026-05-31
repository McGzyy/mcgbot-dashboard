import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { staffTierFromDiscord } from "@/lib/discordStaffTier";
import {
  meetsModerationMinTier,
  resolveHelpTier,
  resolveHelpTierWithSource,
} from "@/lib/helpRole";
import { getModStaffByDiscordId } from "@/lib/mod/modStaffDb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  const id = session?.user?.id?.trim();
  if (!id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const envTier = resolveHelpTier(id);
  const discordTierRaw = await staffTierFromDiscord(id);
  const { tier: role, source: staffSource } = await resolveHelpTierWithSource(id);
  const modChatConfigured = !!(process.env.DISCORD_MOD_CHAT_CHANNEL_ID ?? "").trim();
  const guildStaffConfigured = !!(
    (process.env.DISCORD_GUILD_ID ?? "").trim() &&
    ((process.env.DISCORD_BOT_TOKEN ?? "").trim() || (process.env.DISCORD_TOKEN ?? "").trim())
  );
  const roleIdsConfigured = !!(
    (process.env.DISCORD_ADMIN_ROLE_IDS ?? "").trim() ||
    (process.env.DISCORD_MOD_ROLE_IDS ?? "").trim()
  );
  const envAllowlistConfigured = !!(
    (process.env.DISCORD_ADMIN_IDS ?? "").trim() || (process.env.DISCORD_MOD_IDS ?? "").trim()
  );
  const canModerate = meetsModerationMinTier(role);
  const moderationMinTier =
    (process.env.MODERATION_MIN_TIER ?? "mod").trim().toLowerCase() === "admin" ? "admin" : "mod";
  const staffRow = canModerate ? await getModStaffByDiscordId(id) : null;

  return Response.json({
    role,
    canModerate,
    staffRoleTier: staffRow?.roleTier ?? null,
    staffStatus: staffRow?.status ?? null,
    moderationMinTier,
    modChatConfigured,
    staffSource,
    guildStaffConfigured,
    envTier,
    discordTier: discordTierRaw,
    roleIdsConfigured,
    envAllowlistConfigured,
  });
}
