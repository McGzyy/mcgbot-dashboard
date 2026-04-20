import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isDiscordGuildMember } from "@/lib/discordGuildMember";
import { liveDashboardAccessForDiscordId } from "@/lib/dashboardGate";

export async function requirePremiumAndDiscord() {
  const session = await getServerSession(authOptions);
  const discordId = session?.user?.id?.trim() ?? "";
  if (!discordId) {
    return { ok: false as const, response: Response.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const hasAccess =
    session?.user?.hasDashboardAccess === true ||
    session?.user?.subscriptionExempt === true ||
    (await liveDashboardAccessForDiscordId(discordId).catch(() => false));
  if (!hasAccess) {
    return { ok: false as const, response: Response.json({ error: "Subscription required" }, { status: 402 }) };
  }

  const inGuild = await isDiscordGuildMember(discordId);
  if (inGuild !== true) {
    return {
      ok: false as const,
      response: Response.json(
        { error: "Discord membership required", code: inGuild === null ? "guild_unavailable" : "not_in_guild" },
        { status: 403 }
      ),
    };
  }

  return { ok: true as const, discordId, session };
}

